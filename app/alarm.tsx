import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { navIcons } from '@/assets/icons/alarm-icons';
import { AlarmCard } from '@/components/alarms/AlarmCard';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { RichWordText } from '@/components/alarms/RichWordText';
import { alarmTheme } from '@/components/alarms/theme';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { fetchAlarms, patchAlarm } from '@/lib/alarm-api';
import {
  formatRepeatEveryTag,
  formatScheduledLocalParts,
  presentationForAlarmCategory,
  type AlarmListItem,
} from '@/lib/alarm-format';
import { ADD_ALARM_HIT_SLOP } from '@/lib/header-hit-slop';
import { notifyAuthError } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { stashAlarmForEdit } from '@/lib/alarm-navigation-cache';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import {
  nextCanonicalAlarmFire,
  syncUpcomingReminderNotifications,
} from '@/lib/upcoming-reminder-scheduler';
import { canAddAlarm, FREE_TIER_MAX_ALARMS } from '@/lib/subscription-access';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { fetchCurrentUserRowId } from '@/lib/users-table';

function formatDeviceClock(now: Date): { time: string; ampm: 'AM' | 'PM' } {
  const h24 = now.getHours();
  const m = now.getMinutes();
  const hour12 = h24 % 12 || 12;
  const time = `${hour12}:${String(m).padStart(2, '0')}`;
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  return { time, ampm };
}

function formatDeviceWeekdayLong(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Uses the same next-fire math as OS scheduling (`nextCanonicalAlarmFire`), not raw `scheduledAt`. */
function nextAlarmWords(alarms: AlarmListItem[], now: Date): { muted: string; accent: string } {
  const enabled = alarms.filter((a) => a.isEnabled);
  if (!enabled.length) {
    return { muted: 'Next alarm: ', accent: 'None enabled' };
  }

  let best: { alarm: AlarmListItem; fireAt: Date } | null = null;
  for (const alarm of enabled) {
    const fireAt = nextCanonicalAlarmFire(alarm, now);
    if (!fireAt) {
      continue;
    }
    if (!best || fireAt.getTime() < best.fireAt.getTime()) {
      best = { alarm, fireAt };
    }
  }

  if (!best) {
    return { muted: 'Next alarm: ', accent: 'None in range' };
  }

  const { time, ampm } = formatScheduledLocalParts(best.fireAt.toISOString());
  const lbl = best.alarm.label.trim();
  const dateHint = sameLocalCalendarDay(best.fireAt, now)
    ? ''
    : ` · ${best.fireAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  const timePart = `${time} ${ampm}${dateHint}`;
  return {
    muted: 'Next alarm: ',
    accent: lbl ? `${timePart} · ${lbl}` : timePart,
  };
}

export default function AlarmScreen() {
  useRequireAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const { isSubscriber } = useSubscriptionStatus();

  const [alarms, setAlarms] = useState<AlarmListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patchingIds, setPatchingIds] = useState<number[]>([]);
  const patchingIdsRef = useRef<Set<number>>(new Set());
  const firstFocus = useRef(true);

  const [clockTick, setClockTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const heroClock = useMemo(() => formatDeviceClock(now), [now]);
  const heroDate = useMemo(() => formatDeviceWeekdayLong(now), [now]);

  const nextWords = useMemo(() => nextAlarmWords(alarms, now), [alarms, now]);

  const loadAlarms = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setListError(null);
    }

    const { id: userId, error: userErr } = await fetchCurrentUserRowId();
    if (userErr || userId == null) {
      if (await shouldSkipAuthFailureAlerts()) {
        setInitialLoad(false);
        setRefreshing(false);
        return;
      }
      if (!silent) {
        notifyAuthError('Alarms', userErr ?? new Error('Missing user profile.'));
      }
      setListError(userErr?.message ?? 'Could not resolve your profile.');
      return;
    }

    try {
      const rows = await fetchAlarms(userId);
      setAlarms(rows);
      setListError(null);
      void syncUpcomingReminderNotifications(rows);
      void syncAlarmFireNotifications(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load alarms.';
      setListError(msg);
      if (!silent) {
        notifyAuthError('Alarms', e);
      }
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setClockTick(Date.now());
      invalidateSubscriptionCache();
      void loadAlarms({ silent: !firstFocus.current });
      firstFocus.current = false;
    }, [loadAlarms]),
  );

  const goCreateAlarm = useCallback(() => {
    if (!canAddAlarm(alarms.length, isSubscriber)) {
      showToast(`Free plan allows ${FREE_TIER_MAX_ALARMS} alarms. Upgrade to Pro for unlimited.`);
      router.push('/paywall');
      return;
    }
    router.push('/alarm-create');
  }, [alarms.length, isSubscriber, router, showToast]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadAlarms({ silent: true });
  };

  const toggleAlarmEnabled = useCallback(async (alarm: AlarmListItem) => {
    if (patchingIdsRef.current.has(alarm.id)) {
      return;
    }
    patchingIdsRef.current.add(alarm.id);
    setPatchingIds((ids) => (ids.includes(alarm.id) ? ids : [...ids, alarm.id]));

    const previous = alarm.isEnabled;
    const next = !previous;

    setAlarms((rows) => rows.map((a) => (a.id === alarm.id ? { ...a, isEnabled: next } : a)));

    try {
      await patchAlarm(alarm.id, { is_enabled: next });
      void syncUpcomingReminderNotifications();
      void syncAlarmFireNotifications();
    } catch (e) {
      setAlarms((rows) =>
        rows.map((a) => (a.id === alarm.id ? { ...a, isEnabled: previous } : a)),
      );
      notifyAuthError('Alarms', e);
    } finally {
      patchingIdsRef.current.delete(alarm.id);
      setPatchingIds((ids) => ids.filter((id) => id !== alarm.id));
    }
  }, []);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            Rip<Text style={styles.logoAccent}>ple</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add alarm"
            hitSlop={ADD_ALARM_HIT_SLOP}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={goCreateAlarm}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.clockWrap}>
        <View style={styles.heroClockRow}>
          <Text style={styles.bigClock}>{heroClock.time}</Text>
          <Text style={styles.heroAmpm}>{heroClock.ampm}</Text>
        </View>
        <Text style={styles.bigDate}>{heroDate}</Text>
      </View>

      <RichWordText
        style={styles.nextAlarm}
        words={[
          { text: nextWords.muted, color: alarmTheme.muted },
          { text: nextWords.accent, color: alarmTheme.accentBright },
        ]}
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={alarmTheme.accent}
            colors={[alarmTheme.accent]}
          />
        }>
        {listError && !refreshing ? (
          <Text style={styles.errorText}>{listError}</Text>
        ) : null}
        {alarms.length === 0 && !listError ? (
          <Text style={styles.emptyText}>No alarms yet. Tap + to create one.</Text>
        ) : null}
        {alarms.map((alarm) => {
          const { time, ampm } = formatScheduledLocalParts(alarm.scheduledAt);
          const tagText = formatRepeatEveryTag(alarm.interval, alarm.unit);
          const { icon, tone, toggleOnColor } = presentationForAlarmCategory(
            alarm.category,
            alarm.isEnabled,
          );
          return (
            <AlarmCard
              key={`alarm-${alarm.id}`}
              icon={icon}
              time={time}
              ampm={ampm}
              label={alarm.label || 'Alarm'}
              tagText={tagText}
              active={alarm.isEnabled}
              tone={tone}
              toggleOnColor={toggleOnColor}
              toggleDisabled={patchingIds.includes(alarm.id)}
              onToggle={() => void toggleAlarmEnabled(alarm)}
              onPress={() => {
                stashAlarmForEdit(alarm);
                router.push({
                  pathname: '/alarm-edit',
                  params: { id: String(alarm.id) },
                });
              }}
            />
          );
        })}
      </ScrollView>

      <FullScreenLoadingOverlay visible={initialLoad || refreshing} />

      <BottomNavbar
        items={[
          { icon: navIcons.alarms, label: 'Alarms', active: true, onPress: () => router.push('/alarm') },
          { icon: navIcons.history, label: 'History', onPress: () => router.push('/history') },
          { icon: navIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: navIcons.settings, label: 'Settings', onPress: () => router.push('/setting') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  headerSafe: {
    backgroundColor: alarmTheme.bg,
    zIndex: 2,
    elevation: 6,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  logo: {
    color: alarmTheme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  logoAccent: {
    color: alarmTheme.accentBright,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: alarmTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: alarmTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 22,
  },
  clockWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  heroClockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigClock: {
    color: alarmTheme.text,
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 58,
    letterSpacing: -1.2,
  },
  heroAmpm: {
    color: alarmTheme.muted,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  bigDate: {
    color: alarmTheme.muted,
    fontSize: 13,
    marginTop: 4,
  },
  nextAlarm: {
    textAlign: 'center',
    marginBottom: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    gap: 10,
    paddingBottom: 88,
    flexGrow: 1,
  },
  errorText: {
    color: alarmTheme.red,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  emptyText: {
    color: alarmTheme.muted,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    fontSize: 14,
  },
});
