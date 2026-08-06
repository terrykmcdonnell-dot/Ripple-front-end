import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
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
import { AppVersionCheckPrompt } from '@/components/bootstrap/AppVersionCheckPrompt';
import { AndroidLockScreenAlarmBanner } from '@/components/alarms/AndroidLockScreenAlarmBanner';
import { NotificationsDisabledBanner } from '@/components/alarms/NotificationsDisabledBanner';
import { BottomNavbar, useTabBarReservedHeight } from '@/components/alarms/BottomNavbar';
import { RichWordText } from '@/components/alarms/RichWordText';
import { isAlarmPaletteDark, alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
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
import { getAuthErrorDisplayText, notifyAuthError } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { stashAlarmForEdit } from '@/lib/alarm-navigation-cache';
import { promptAndroidFullScreenAlarmPermissionIfNeeded } from '@/lib/android-alarm-full-screen-setup';
import { hasAndroidAlarmPermissionWarnings } from '@/lib/android-alarm-permissions-status';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import {
  nextCanonicalAlarmFire,
  syncUpcomingReminderNotifications,
} from '@/lib/upcoming-reminder-scheduler';
import { canAddAlarm, FREE_TIER_MAX_ALARMS } from '@/lib/subscription-access';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { navigateToMainTab } from '@/lib/main-tab-navigation';
import { resolveCategoryMeta, useAlarmCategories } from '@/lib/alarm-categories';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { getAlarmListCache, setAlarmListCache } from '@/lib/alarm-list-cache';
import { tryShowPendingNativeStoreReview } from '@/lib/in-app-review';

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

/** Compact next-ring line for each list card (uses same schedule math as notifications). */
function formatNextFireSubtitle(alarm: AlarmListItem, now: Date): string {
  if (!alarm.isEnabled) {
    return 'Off';
  }
  const fireAt = nextCanonicalAlarmFire(alarm, now);
  if (!fireAt) {
    return 'No upcoming ring';
  }
  const { time, ampm } = formatScheduledLocalParts(fireAt.toISOString());
  if (sameLocalCalendarDay(fireAt, now)) {
    return `Next · Today · ${time} ${ampm}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameLocalCalendarDay(fireAt, tomorrow)) {
    return `Next · Tomorrow · ${time} ${ampm}`;
  }
  const dateStr = fireAt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `Next · ${dateStr} · ${time} ${ampm}`;
}

/** Uses the same next-fire math as OS scheduling (`nextCanonicalAlarmFire`), not raw `scheduledAt`. */
function nextAlarmWords(alarms: AlarmListItem[], now: Date): { muted: string; accent: string } {
  const enabled = alarms.filter((a) => a.isEnabled);
  if (!enabled.length) {
    return { muted: 'Next alarm: ', accent: 'None enabled' };
  }

  let earliestMs = Number.POSITIVE_INFINITY;
  const candidates: { alarm: AlarmListItem; fireAt: Date }[] = [];

  for (const alarm of enabled) {
    const fireAt = nextCanonicalAlarmFire(alarm, now);
    if (!fireAt) {
      continue;
    }
    const ms = fireAt.getTime();
    if (ms < earliestMs) {
      earliestMs = ms;
      candidates.length = 0;
      candidates.push({ alarm, fireAt });
    } else if (ms === earliestMs) {
      candidates.push({ alarm, fireAt });
    }
  }

  if (!candidates.length) {
    return { muted: 'Next alarm: ', accent: 'None in range' };
  }

  const fireAt = candidates[0].fireAt;
  const { time, ampm } = formatScheduledLocalParts(fireAt.toISOString());
  const dateHint = sameLocalCalendarDay(fireAt, now)
    ? ''
    : ` · ${fireAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  const timePart = `${time} ${ampm}${dateHint}`;
  const labels = candidates
    .map(({ alarm }) => alarm.label.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const muted = candidates.length > 1 ? 'Next alarms: ' : 'Next alarm: ';
  return {
    muted,
    accent: labels.length ? `${timePart} · ${labels.join(' · ')}` : timePart,
  };
}

function nextFireSortKey(alarm: AlarmListItem, now: Date): number {
  if (!alarm.isEnabled) {
    return Number.POSITIVE_INFINITY;
  }
  const fireAt = nextCanonicalAlarmFire(alarm, now);
  return fireAt ? fireAt.getTime() : Number.POSITIVE_INFINITY;
}

export default function AlarmScreen() {
  useRequireAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const { isSubscriber } = useSubscriptionStatus();

  const [alarms, setAlarms] = useState<AlarmListItem[]>(() => getAlarmListCache() ?? []);
  const [listError, setListError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(() => getAlarmListCache() == null);
  const [refreshing, setRefreshing] = useState(false);
  const [patchingIds, setPatchingIds] = useState<number[]>([]);
  const patchingIdsRef = useRef<Set<number>>(new Set());
  const alarmsRef = useRef<AlarmListItem[]>([]);
  const loadGenRef = useRef(0);

  useEffect(() => {
    alarmsRef.current = alarms;
  }, [alarms]);

  const [clockTick, setClockTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const heroClock = useMemo(() => formatDeviceClock(now), [now]);
  const heroDate = useMemo(() => formatDeviceWeekdayLong(now), [now]);

  const nextWords = useMemo(() => nextAlarmWords(alarms, now), [alarms, now]);

  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((a, b) => {
      const aKey = nextFireSortKey(a, now);
      const bKey = nextFireSortKey(b, now);
      if (aKey !== bKey) {
        return aKey - bKey;
      }
      // Tie-breakers for stable-ish ordering.
      if (a.isEnabled !== b.isEnabled) {
        return a.isEnabled ? -1 : 1;
      }
      const aSched = new Date(a.scheduledAt).getTime();
      const bSched = new Date(b.scheduledAt).getTime();
      if (aSched !== bSched) {
        return aSched - bSched;
      }
      return a.id - b.id;
    });
  }, [alarms, now]);

  const palette = useAlarmTheme();
  const { categories } = useAlarmCategories();
  const tabBarPad = useTabBarReservedHeight();
  const styles = useMemo(() => createAlarmStyles(palette), [palette]);

  const loadAlarms = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const gen = ++loadGenRef.current;
    const finishLoading = () => {
      if (loadGenRef.current === gen) {
        setInitialLoad(false);
        setRefreshing(false);
      }
    };

    try {
      if (!silent) {
        setListError(null);
      }

      const { id: userId, error: userErr } = await fetchCurrentUserRowId();
      if (userErr || userId == null) {
        if (await shouldSkipAuthFailureAlerts()) {
          return;
        }
        if (!silent) {
          notifyAuthError('Alarms', userErr ?? new Error('Missing user profile.'));
        }
        if (loadGenRef.current === gen) {
          setListError(getAuthErrorDisplayText(userErr ?? 'Could not resolve your profile.'));
        }
        return;
      }

      const rows = await fetchAlarms(userId);
      if (loadGenRef.current !== gen) {
        return;
      }
      setAlarms(rows);
      setAlarmListCache(userId, rows);
      setListError(null);
      void syncUpcomingReminderNotifications(rows);
      void syncAlarmFireNotifications(rows).then(() => {
        if (rows.some((alarm) => alarm.isEnabled)) {
          void promptAndroidFullScreenAlarmPermissionIfNeeded(showToast);
        }
      });
    } catch (e) {
      if (loadGenRef.current !== gen) {
        return;
      }
      setListError(getAuthErrorDisplayText(e));
      if (!silent) {
        notifyAuthError('Alarms', e);
      }
    } finally {
      finishLoading();
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      setClockTick(Date.now());
      invalidateSubscriptionCache();

      const hasCachedRows = getAlarmListCache() != null;
      let cancelled = false;

      const runLoad = () => {
        if (!cancelled) {
          void loadAlarms({ silent: hasCachedRows });
        }
      };

      // Cached rows are already on screen (see initial state above) — defer the background
      // refresh until interactions/animations settle so a fresh mount (e.g. right after saving
      // a new alarm) never flashes the full-screen spinner over data we already have.
      if (hasCachedRows) {
        const task = InteractionManager.runAfterInteractions(runLoad);
        return () => {
          cancelled = true;
          task.cancel();
          loadGenRef.current += 1;
        };
      }

      runLoad();
      return () => {
        cancelled = true;
        loadGenRef.current += 1;
      };
    }, [loadAlarms]),
  );

  useFocusEffect(
    useCallback(() => {
      void tryShowPendingNativeStoreReview();
    }, []),
  );

  const goCreateAlarm = useCallback(() => {
    if (!canAddAlarm(alarms.length, isSubscriber)) {
      showToast(`Free plan allows ${FREE_TIER_MAX_ALARMS} alarms. Upgrade to Pro for unlimited.`);
      router.push('/paywall?alarmLimit=1');
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
    const updatedRows = alarmsRef.current.map((a) =>
      a.id === alarm.id ? { ...a, isEnabled: next } : a,
    );

    alarmsRef.current = updatedRows;
    setAlarms(updatedRows);
    // Drop any in-flight loadAlarms() so it cannot re-schedule with stale API data
    // after this toggle has already cancelled OS notifications.
    loadGenRef.current += 1;

    // Keep the cross-mount cache in sync so a quick navigate-away-and-back does not
    // briefly show the pre-toggle state before the next background refresh lands.
    const { id: cacheUserId } = await fetchCurrentUserRowId();
    if (cacheUserId != null) {
      setAlarmListCache(cacheUserId, updatedRows);
    }

    try {
      await patchAlarm(alarm.id, { is_enabled: next });
      await syncUpcomingReminderNotifications(updatedRows);
      if (next) {
        void hasAndroidAlarmPermissionWarnings().then((needsSetup) => {
          if (needsSetup) {
            showToast(
              'Lock-screen alarm permissions are off. Check the banner at the top of Alarms to enable full-screen intent and Do Not Disturb access.',
            );
          }
        });
        await syncAlarmFireNotifications(updatedRows);
        void promptAndroidFullScreenAlarmPermissionIfNeeded(showToast);
      } else {
        await syncAlarmFireNotifications(updatedRows);
      }
    } catch (e) {
      const revertedRows = alarmsRef.current.map((a) =>
        a.id === alarm.id ? { ...a, isEnabled: previous } : a,
      );
      alarmsRef.current = revertedRows;
      setAlarms(revertedRows);
      if (cacheUserId != null) {
        setAlarmListCache(cacheUserId, revertedRows);
      }
      notifyAuthError('Alarms', e);
    } finally {
      patchingIdsRef.current.delete(alarm.id);
      setPatchingIds((ids) => ids.filter((id) => id !== alarm.id));
    }
  }, [showToast]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isAlarmPaletteDark(palette) ? 'light-content' : 'dark-content'} />

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

      <NotificationsDisabledBanner />
      <AndroidLockScreenAlarmBanner />

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
          { text: nextWords.muted, color: palette.muted },
          { text: nextWords.accent, color: palette.accentBright },
        ]}
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }>
        {listError && !refreshing ? (
          <Text style={styles.errorText}>{listError}</Text>
        ) : null}
        {alarms.length === 0 && !listError ? (
          <Text style={styles.emptyText}>No alarms yet. Tap + to create one.</Text>
        ) : null}
        {sortedAlarms.map((alarm) => {
          const nextFireText = formatNextFireSubtitle(alarm, now);
          const tagText = formatRepeatEveryTag(alarm.interval, alarm.unit);
          const categoryMeta = resolveCategoryMeta(categories, {
            categoryId: alarm.categoryId,
            categoryName: alarm.category,
            categoryIcon: alarm.categoryIcon,
            categoryColorKey: alarm.categoryColorKey,
          });
          const { icon, tone, toggleOnColor } = presentationForAlarmCategory(
            categoryMeta.name,
            alarm.isEnabled,
            palette,
            categoryMeta.icon,
            categoryMeta.colorKey,
          );
          return (
            <AlarmCard
              key={`alarm-${alarm.id}`}
              icon={icon}
              label={alarm.label || 'Alarm'}
              nextFireText={nextFireText}
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

      <FullScreenLoadingOverlay visible={refreshing} />
      <AppVersionCheckPrompt enabled={!initialLoad && !refreshing} />

      <BottomNavbar
        items={[
          { icon: navIcons.alarms, label: 'Alarms', active: true, onPress: () => navigateToMainTab(router, '/alarm') },
          { icon: navIcons.history, label: 'History', onPress: () => navigateToMainTab(router, '/history') },
          { icon: navIcons.templates, label: 'Templates', onPress: () => navigateToMainTab(router, '/templates') },
          { icon: navIcons.settings, label: 'Settings', onPress: () => navigateToMainTab(router, '/setting') },
        ]}
      />
    </View>
  );
}

function createAlarmStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  logo: {
    color: alarmTheme.text,
    fontSize: alarmTypography.title,
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
    fontSize: alarmTypography.titleSm,
    lineHeight: alarmTypography.titleSm,
  },
  clockWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  heroClockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigClock: {
    color: alarmTheme.text,
    fontSize: alarmTypography.displayTime,
    fontWeight: '800',
    lineHeight: alarmTypography.displayTime,
    letterSpacing: -1.2,
  },
  heroAmpm: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.bodyLarge,
    fontWeight: '600',
    marginBottom: 4,
  },
  bigDate: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.caption,
    marginTop: 6,
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
    gap: 12,
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
    fontSize: alarmTypography.body,
  },
});
}
