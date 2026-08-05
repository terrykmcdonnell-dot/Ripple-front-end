import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ringIcons } from '@/assets/icons/alarm-ring-icons';
import { RingActionButton } from '@/components/alarm-ring/RingActionButton';
import { RingPulse } from '@/components/alarm-ring/RingPulse';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { useBottomSafePadding } from '@/lib/screen-safe-area';
import { useDefaultSnoozeMinutes } from '@/hooks/use-default-snooze-minutes';
import { useDefaultVibrationEnabled } from '@/hooks/use-default-vibration-enabled';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { resolveCategoryMeta, useAlarmCategories } from '@/lib/alarm-categories';
import { formatScheduledLocalParts, resolveAlarmCategoryIcon } from '@/lib/alarm-format';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { parseAlarmFireBatchParam } from '@/lib/alarm-fire-notification-data';
import { notifyAuthMessage } from '@/lib/auth-notify';
import { markAlarmFiresDelivered, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { isFreeTierRingDeliveryBlocked, isFreeRingLimitReached, openFreeTierRingLimitPaywall } from '@/lib/alarm-free-ring-limit';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';
import {
  recordAlarmHistoryDismissed,
  recordAlarmHistoryMissed,
  recordAlarmHistorySnoozed,
} from '@/lib/alarm-history-sync';
import { recordSuccessfulAlarmDismiss } from '@/lib/in-app-review';
import { startRingAlarmSound, stopRingAlarmSound } from '@/lib/ring-alarm-sound';

function paramOne(v: string | string[] | undefined): string | undefined {
  if (v == null) {
    return undefined;
  }
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim().length > 0 ? s.trim() : undefined;
}

function parsedFromParams(params: {
  batch?: string | string[];
  batchAlarms?: string | string[];
  alarmId?: string | string[];
  fireAt?: string | string[];
  label?: string | string[];
  category?: string | string[];
  categoryId?: string | string[];
  categoryIcon?: string | string[];
  soundId?: string | string[];
  userId?: string | string[];
  occurrenceFireAt?: string | string[];
}): ParsedAlarmFireData[] {
  const batchFlag = paramOne(params.batch);
  const batchRaw = paramOne(params.batchAlarms);
  if (batchFlag === '1' && batchRaw) {
    return parseAlarmFireBatchParam(batchRaw) ?? [];
  }

  const alarmIdRaw = paramOne(params.alarmId);
  const fireAt = paramOne(params.fireAt);
  if (!alarmIdRaw || !fireAt) {
    return [];
  }
  const alarmId = Number(alarmIdRaw);
  if (!Number.isFinite(alarmId)) {
    return [];
  }
  const label = paramOne(params.label)?.trim() || 'Alarm';
  const category = paramOne(params.category)?.trim() ?? '';
  const categoryIcon = paramOne(params.categoryIcon)?.trim();
  const categoryIdRaw = paramOne(params.categoryId);
  const categoryId = categoryIdRaw != null ? Number(categoryIdRaw) : NaN;
  const soundId = paramOne(params.soundId);
  const uidRaw = paramOne(params.userId);
  const uid = uidRaw != null ? Number(uidRaw) : NaN;
  const occurrenceFireAt = paramOne(params.occurrenceFireAt);
  return [
    {
      alarmId,
      fireAt,
      label,
      category,
      ...(Number.isFinite(categoryId) ? { categoryId } : {}),
      ...(categoryIcon ? { categoryIcon } : {}),
      ...(soundId ? { soundId } : {}),
      ...(Number.isFinite(uid) ? { userId: uid } : {}),
      ...(occurrenceFireAt ? { occurrenceFireAt } : {}),
    },
  ];
}

export default function AlarmRingScreen() {
  useRequireAuth();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const initialAlarms = useMemo(
    () => parsedFromParams(rawParams),
    [
      rawParams.batch,
      rawParams.batchAlarms,
      rawParams.alarmId,
      rawParams.fireAt,
      rawParams.label,
      rawParams.category,
      rawParams.categoryId,
      rawParams.categoryIcon,
      rawParams.soundId,
      rawParams.userId,
      rawParams.occurrenceFireAt,
    ],
  );

  const [pendingAlarms, setPendingAlarms] = useState<ParsedAlarmFireData[]>(initialAlarms);
  const { limitsApply } = useSubscriptionStatus();
  const { categories } = useAlarmCategories();
  const defaultSnoozeMinutes = useDefaultSnoozeMinutes();
  const vibrationEnabled = useDefaultVibrationEnabled();
  const snoozePendingRef = useRef<Set<number>>(new Set());
  const bootstrappedRef = useRef(false);

  const isBatch = pendingAlarms.length > 1;
  const leader = pendingAlarms[0] ?? initialAlarms[0] ?? null;
  const soundIdParam = paramOne(rawParams.soundId) ?? leader?.soundId;

  const heroClock = useMemo(() => {
    if (!leader?.fireAt) {
      return { time: '7:00', ampm: 'AM' as const };
    }
    return formatScheduledLocalParts(leader.fireAt);
  }, [leader?.fireAt]);

  const heroDate = useMemo(() => {
    if (!leader?.fireAt) {
      return 'Demo preview · create alarms on the Alarms tab';
    }
    const d = new Date(leader.fireAt);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [leader?.fireAt]);

  const palette = useAlarmTheme();
  const bottomPad = useBottomSafePadding(24);
  const styles = useMemo(() => createRingStyles(palette), [palette]);

  useEffect(() => {
    setPendingAlarms(initialAlarms);
    bootstrappedRef.current = false;
  }, [initialAlarms]);

  const finishRingSession = useCallback(
    async (alarm: ParsedAlarmFireData) => {
      void stopRingAlarmSound();
      if (limitsApply && (await isFreeRingLimitReached(alarm.alarmId))) {
        openFreeTierRingLimitPaywall();
        return;
      }
      router.replace('/alarm');
    },
    [limitsApply, router],
  );

  const onDismissAlarm = useCallback(
    (alarm: ParsedAlarmFireData) => {
      void recordAlarmHistoryDismissed(alarm).catch(() => undefined);
      void recordSuccessfulAlarmDismiss();
      setPendingAlarms((current) => {
        const next = current.filter((item) => item.alarmId !== alarm.alarmId);
        if (next.length === 0) {
          void finishRingSession(alarm);
        }
        void syncAlarmFireNotifications();
        return next;
      });
    },
    [finishRingSession],
  );

  const onSnoozeAlarm = useCallback(
    (alarm: ParsedAlarmFireData) => {
      if (snoozePendingRef.current.has(alarm.alarmId)) {
        return;
      }
      snoozePendingRef.current.add(alarm.alarmId);

      void (async () => {
        try {
          const result = await scheduleSnoozeNotification({
            minutes: defaultSnoozeMinutes,
            alarmTitle: alarm.label,
            alarmData: alarm,
          });
          if (!result.ok) {
            notifyAuthMessage('Snooze', result.message);
            return;
          }
          await recordAlarmHistorySnoozed(alarm, defaultSnoozeMinutes).catch(() => undefined);
          setPendingAlarms((current) => {
            const next = current.filter((item) => item.alarmId !== alarm.alarmId);
            if (next.length === 0) {
              void finishRingSession(alarm);
            }
            void syncAlarmFireNotifications();
            return next;
          });
          if (vibrationEnabled) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } finally {
          snoozePendingRef.current.delete(alarm.alarmId);
        }
      })();
    },
    [defaultSnoozeMinutes, finishRingSession, vibrationEnabled],
  );

  useEffect(() => {
    if (initialAlarms.length === 0 || bootstrappedRef.current) {
      return;
    }

    let cancelled = false;
    bootstrappedRef.current = true;

    void (async () => {
      const allowed: ParsedAlarmFireData[] = [];
      for (const alarm of initialAlarms) {
        if (await isFreeTierRingDeliveryBlocked(alarm.alarmId)) {
          continue;
        }
        allowed.push(alarm);
      }

      if (allowed.length === 0) {
        await stopRingAlarmSound();
        if (!cancelled) {
          openFreeTierRingLimitPaywall();
          void syncAlarmFireNotifications();
        }
        return;
      }

      if (!cancelled) {
        setPendingAlarms(allowed);
      }

      void startRingAlarmSound(soundIdParam, allowed[0]);
      await markAlarmFiresDelivered(allowed);
      for (const alarm of allowed) {
        void recordAlarmHistoryMissed(alarm);
      }
    })();

    return () => {
      cancelled = true;
      void stopRingAlarmSound();
    };
  }, [initialAlarms, router, soundIdParam]);

  useEffect(() => {
    if (pendingAlarms.length === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      void (async () => {
        await stopRingAlarmSound();
        for (const alarm of pendingAlarms) {
          await recordAlarmHistoryMissed(alarm).catch(() => undefined);
        }
        await syncAlarmFireNotifications();
        router.replace('/alarm');
      })();
    }, 5 * 60 * 1_000);
    return () => clearTimeout(timeout);
  }, [pendingAlarms, router]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && leader) {
        void startRingAlarmSound(soundIdParam, leader);
      }
    });
    return () => sub.remove();
  }, [leader, soundIdParam]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.content, { backgroundColor: palette.accentDim, paddingBottom: bottomPad }]}>
        {isBatch ? (
          <>
            <View style={styles.batchHeader}>
              <View style={styles.batchIconRow}>
                {pendingAlarms.map((alarm) => {
                  const meta = resolveCategoryMeta(categories, {
                    categoryId: alarm.categoryId,
                    categoryName: alarm.category,
                    categoryIcon: alarm.categoryIcon,
                  });
                  return (
                    <View key={`batch-icon-${alarm.alarmId}`} style={styles.batchIconBubble}>
                      <Text style={styles.batchIconText}>{resolveAlarmCategoryIcon(meta.name, meta.icon)}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.alarmLabel}>{`${pendingAlarms.length} alarms`}</Text>
              <View style={styles.heroClockRow}>
                <Text style={styles.time}>{heroClock.time}</Text>
                <Text style={styles.ampm}>{heroClock.ampm}</Text>
              </View>
              <Text style={styles.date}>{heroDate}</Text>
            </View>

            <ScrollView
              style={styles.batchList}
              contentContainerStyle={styles.batchListContent}
              showsVerticalScrollIndicator={false}>
              {pendingAlarms.map((alarm) => {
                const meta = resolveCategoryMeta(categories, {
                  categoryId: alarm.categoryId,
                  categoryName: alarm.category,
                  categoryIcon: alarm.categoryIcon,
                });
                const icon = resolveAlarmCategoryIcon(meta.name, meta.icon);
                return (
                  <View key={`batch-row-${alarm.alarmId}`} style={styles.batchCard}>
                    <View style={styles.batchCardHeader}>
                      <Text style={styles.batchCardIcon}>{icon}</Text>
                      <View style={styles.batchCardTextWrap}>
                        <Text style={styles.batchCardTitle}>{alarm.label}</Text>
                        {alarm.category ? <Text style={styles.batchCardCategory}>{alarm.category}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.batchCardActions}>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.batchSnoozeBtn, pressed && styles.batchBtnPressed]}
                        onPress={() => onSnoozeAlarm(alarm)}>
                        <Text style={styles.batchSnoozeText}>Snooze {defaultSnoozeMinutes}m</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.batchDismissBtn, pressed && styles.batchBtnPressed]}
                        onPress={() => onDismissAlarm(alarm)}>
                        <Text style={styles.batchDismissText}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.footerHint}>
              Each alarm has its own Snooze and Dismiss — handle them one at a time.
            </Text>
          </>
        ) : (
          <ScrollView
            contentContainerStyle={styles.singleScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.singleBody}>
              {leader ? (
                <RingPulse
                  icon={resolveAlarmCategoryIcon(
                    resolveCategoryMeta(categories, {
                      categoryId: leader.categoryId,
                      categoryName: leader.category,
                      categoryIcon: leader.categoryIcon,
                    }).name,
                    leader.categoryIcon,
                  )}
                />
              ) : null}

              <Text style={styles.alarmLabel}>Alarm</Text>
              <View style={styles.heroClockRow}>
                <Text style={styles.time}>{heroClock.time}</Text>
                <Text style={styles.ampm}>{heroClock.ampm}</Text>
              </View>
              <Text style={styles.date}>{heroDate}</Text>

              <View style={styles.titleBlock}>
                <Text style={styles.name}>{leader?.label ?? 'Alarm'}</Text>
                {leader?.category ? <Text style={styles.categoryHint}>{leader.category}</Text> : null}
              </View>

              <View style={styles.actions}>
                <RingActionButton
                  icon={ringIcons.snooze}
                  label={`Snooze ${defaultSnoozeMinutes}m`}
                  variant="snooze"
                  onPress={() => leader && onSnoozeAlarm(leader)}
                />
                <RingActionButton
                  icon={ringIcons.dismiss}
                  label="Dismiss"
                  variant="dismiss"
                  onPress={() => leader && onDismissAlarm(leader)}
                />
              </View>

              <Text style={styles.footerHint}>
                {leader
                  ? 'Swipe away from the banner still keeps this screen until you tap Dismiss or Snooze.'
                  : 'Ring screen opens automatically when an alarm fires while the app is open.'}
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function createRingStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: alarmTheme.bg,
    },
    content: {
      flex: 1,
      width: '100%',
      paddingHorizontal: 24,
    },
    singleScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: 16,
    },
    singleBody: {
      width: '100%',
      alignItems: 'center',
    },
    batchHeader: {
      width: '100%',
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 8,
    },
    batchIconRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 12,
    },
    batchIconBubble: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    batchIconText: {
      fontSize: 26,
    },
    alarmLabel: {
      color: alarmTheme.muted,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1.3,
      marginBottom: 8,
      fontFamily: 'monospace',
      textAlign: 'center',
      width: '100%',
    },
    heroClockRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 4,
      alignSelf: 'center',
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
    date: {
      color: alarmTheme.muted,
      fontSize: 13,
      marginBottom: 12,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    batchList: {
      width: '100%',
      flex: 1,
    },
    batchListContent: {
      gap: 12,
      paddingBottom: 8,
      flexGrow: 1,
    },
    batchCard: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface,
      padding: 14,
      gap: 12,
    },
    batchCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    batchCardIcon: {
      fontSize: 28,
    },
    batchCardTextWrap: {
      flex: 1,
    },
    batchCardTitle: {
      color: alarmTheme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    batchCardCategory: {
      color: alarmTheme.accentBright,
      fontSize: 12,
      marginTop: 2,
    },
    batchCardActions: {
      flexDirection: 'row',
      gap: 10,
    },
    batchSnoozeBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    batchDismissBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: alarmTheme.accent,
    },
    batchSnoozeText: {
      color: alarmTheme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    batchDismissText: {
      color: alarmTheme.bg,
      fontSize: 14,
      fontWeight: '700',
    },
    batchBtnPressed: {
      opacity: 0.82,
    },
    titleBlock: {
      width: '100%',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 24,
    },
    name: {
      color: alarmTheme.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    categoryHint: {
      color: alarmTheme.accentBright,
      fontSize: 13,
      marginTop: 6,
      textAlign: 'center',
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
      width: '100%',
    },
  });
}
