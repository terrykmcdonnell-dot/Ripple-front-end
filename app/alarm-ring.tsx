import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ringIcons } from '@/assets/icons/alarm-ring-icons';
import { RingActionButton } from '@/components/alarm-ring/RingActionButton';
import { RingPulse } from '@/components/alarm-ring/RingPulse';
import { alarmTheme } from '@/components/alarms/theme';
import { useDefaultSnoozeMinutes } from '@/hooks/use-default-snooze-minutes';
import { useDefaultVibrationEnabled } from '@/hooks/use-default-vibration-enabled';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { formatScheduledLocalParts } from '@/lib/alarm-format';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { notifyAuthMessage } from '@/lib/auth-notify';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';
import { recordAlarmHistoryDismissed, recordAlarmHistorySnoozed } from '@/lib/alarm-history-sync';

function paramOne(v: string | string[] | undefined): string | undefined {
  if (v == null) {
    return undefined;
  }
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim().length > 0 ? s.trim() : undefined;
}

function parsedFromParams(params: {
  alarmId?: string | string[];
  fireAt?: string | string[];
  label?: string | string[];
  category?: string | string[];
  userId?: string | string[];
}): ParsedAlarmFireData | null {
  const alarmIdRaw = paramOne(params.alarmId);
  const fireAt = paramOne(params.fireAt);
  if (!alarmIdRaw || !fireAt) {
    return null;
  }
  const alarmId = Number(alarmIdRaw);
  if (!Number.isFinite(alarmId)) {
    return null;
  }
  const label = paramOne(params.label)?.trim() || 'Alarm';
  const category = paramOne(params.category)?.trim() ?? '';
  const uidRaw = paramOne(params.userId);
  const uid = uidRaw != null ? Number(uidRaw) : NaN;
  return {
    alarmId,
    fireAt,
    label,
    category,
    ...(Number.isFinite(uid) ? { userId: uid } : {}),
  };
}

export default function AlarmRingScreen() {
  useRequireAuth();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const liveParsed = useMemo(() => parsedFromParams(rawParams), [rawParams]);

  const defaultSnoozeMinutes = useDefaultSnoozeMinutes();
  const vibrationEnabled = useDefaultVibrationEnabled();
  const snoozePendingRef = useRef(false);

  const alarmTitle = liveParsed?.label ?? 'Alarm';

  const heroClock = useMemo(() => {
    if (!liveParsed?.fireAt) {
      return { time: '7:00', ampm: 'AM' as const };
    }
    return formatScheduledLocalParts(liveParsed.fireAt);
  }, [liveParsed]);

  const heroDate = useMemo(() => {
    if (!liveParsed?.fireAt) {
      return 'Demo preview · create alarms on the Alarms tab';
    }
    const d = new Date(liveParsed.fireAt);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [liveParsed]);

  const onDismissPress = useCallback(() => {
    router.replace('/alarm');
    if (liveParsed) {
      void recordAlarmHistoryDismissed(liveParsed).catch(() => undefined);
      void syncAlarmFireNotifications();
    }
  }, [liveParsed, router]);

  const onSnoozePress = useCallback(() => {
    if (snoozePendingRef.current) {
      return;
    }
    snoozePendingRef.current = true;
    router.replace('/alarm');

    void (async () => {
      try {
        const result = await scheduleSnoozeNotification({
          minutes: defaultSnoozeMinutes,
          alarmTitle,
        });
        if (!result.ok) {
          notifyAuthMessage('Snooze', result.message);
          return;
        }
        if (liveParsed) {
          await recordAlarmHistorySnoozed(liveParsed, defaultSnoozeMinutes).catch(() => undefined);
        }
        void syncAlarmFireNotifications();
        if (vibrationEnabled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } finally {
        snoozePendingRef.current = false;
      }
    })();
  }, [alarmTitle, defaultSnoozeMinutes, liveParsed, router, vibrationEnabled]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <RingPulse icon={ringIcons.alarm} />

        <Text style={styles.alarmLabel}>Alarm</Text>
        <View style={styles.heroClockRow}>
          <Text style={styles.time}>{heroClock.time}</Text>
          <Text style={styles.ampm}>{heroClock.ampm}</Text>
        </View>
        <Text style={styles.date}>{heroDate}</Text>

        <Text style={styles.name}>{alarmTitle}</Text>
        {liveParsed?.category ? <Text style={styles.categoryHint}>{liveParsed.category}</Text> : null}

        <View style={styles.actions}>
          <RingActionButton
            icon={ringIcons.snooze}
            label={`Snooze ${defaultSnoozeMinutes}m`}
            variant="snooze"
            onPress={() => void onSnoozePress()}
          />
          <RingActionButton
            icon={ringIcons.dismiss}
            label="Dismiss"
            variant="dismiss"
            onPress={() => void onDismissPress()}
          />
        </View>

        <Text style={styles.footerHint}>
          {liveParsed
            ? 'Swipe away from the banner still keeps this screen until you tap Dismiss or Snooze.'
            : 'Ring screen opens automatically when an alarm fires while the app is open.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  alarmLabel: {
    color: alarmTheme.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  heroClockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  time: {
    color: alarmTheme.text,
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
    letterSpacing: -1.4,
  },
  ampm: {
    color: alarmTheme.muted,
    fontSize: 17,
    fontWeight: '700',
    paddingBottom: 6,
  },
  name: {
    color: alarmTheme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 28,
    marginBottom: 22,
    textAlign: 'center',
  },
  categoryHint: {
    color: alarmTheme.accentBright,
    fontSize: 13,
    marginTop: -18,
    marginBottom: 18,
  },
  date: {
    color: alarmTheme.muted,
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  footerHint: {
    color: alarmTheme.muted,
    fontSize: 11,
    marginTop: 20,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
