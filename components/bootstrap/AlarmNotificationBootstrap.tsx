import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import dismissNotificationAsync from 'expo-notifications/build/dismissNotificationAsync';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from 'expo-notifications/build/NotificationsEmitter';
import registerTaskAsync from 'expo-notifications/build/registerTaskAsync';
import setNotificationCategoryAsync from 'expo-notifications/build/setNotificationCategoryAsync';

import {
  ALARM_FIRE_CATEGORY_ID,
  ALARM_FIRE_DATA_TYPE,
  ALARM_NOTIFICATION_ACTION_DISMISS,
  ALARM_NOTIFICATION_ACTION_SNOOZE,
} from '@/lib/alarm-notification-constants';
import { ensureAllAndroidAlarmChannelsAsync, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { parseAlarmFireFromNotification } from '@/lib/alarm-fire-notification-data';
import { consumeInitialAlarmFireResponse } from '@/lib/android-alarm-cold-start';
import { stopNativeAlarmSound } from '@/lib/android-alarm-native-prefs';
import { stopRingAlarmSound } from '@/lib/ring-alarm-sound';
import { processPendingNativeAlarmActions } from '@/lib/android-native-alarm-actions';
import { handleAlarmFireNotificationResponse, openAlarmRingScreen } from '@/lib/alarm-notification-response';
import { isAlarmFireDeliveryAllowed } from '@/lib/alarm-fire-delivery-guard';
import { isAlarmFireOccurrenceDelivered, markAlarmFireDelivered } from '@/lib/alarm-fire-scheduler';
import { RIPPLE_ALARM_HISTORY_BG_TASK } from '@/lib/alarm-history-notification-task';
import { flushPendingAlarmHistoryWrites, recordAlarmHistoryMissed } from '@/lib/alarm-history-sync';

async function ensureAlarmFireCategoryRegistered(): Promise<void> {
  await setNotificationCategoryAsync(ALARM_FIRE_CATEGORY_ID, [
    {
      identifier: ALARM_NOTIFICATION_ACTION_DISMISS,
      buttonTitle: 'Dismiss',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ALARM_NOTIFICATION_ACTION_SNOOZE,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: false },
    },
  ]);
}

/**
 * Registers alarm notification action buttons (Dismiss / Snooze), records History outcomes,
 * and registers a background delivery task so `missed` is written at fire time when possible.
 */
export function AlarmNotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    let receivedSub: ReturnType<typeof addNotificationReceivedListener> | undefined;
    let responseSub: ReturnType<typeof addNotificationResponseReceivedListener> | undefined;
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void flushPendingAlarmHistoryWrites();
        void processPendingNativeAlarmActions();
      }
    });

    void (async () => {
      await ensureAlarmFireCategoryRegistered().catch(() => undefined);
      await ensureAllAndroidAlarmChannelsAsync().catch(() => undefined);
      await flushPendingAlarmHistoryWrites().catch(() => undefined);
      await processPendingNativeAlarmActions().catch(() => undefined);
      await registerTaskAsync(RIPPLE_ALARM_HISTORY_BG_TASK).catch(() => undefined);

      try {
        if (!cancelled) {
          await consumeInitialAlarmFireResponse();
        }
      } catch {
        /* native module unavailable */
      }

      if (cancelled) {
        return;
      }

      receivedSub = addNotificationReceivedListener((notification) => {
        const nData = notification.request.content.data as Record<string, unknown> | undefined;
        if (nData?.type !== ALARM_FIRE_DATA_TYPE) {
          return;
        }
        const parsed = parseAlarmFireFromNotification(notification);
        if (!parsed) {
          return;
        }
        void (async () => {
          if (!(await isAlarmFireDeliveryAllowed(parsed))) {
            await dismissNotificationAsync(notification.request.identifier).catch(() => undefined);
            stopNativeAlarmSound();
            await stopRingAlarmSound();
            await syncAlarmFireNotifications();
            return;
          }
          const fireAtMs = new Date(parsed.fireAt).getTime();
          if (Number.isFinite(fireAtMs)) {
            if (await isAlarmFireOccurrenceDelivered(parsed.alarmId, fireAtMs)) {
              return;
            }
            await markAlarmFireDelivered(parsed.alarmId, fireAtMs);
          }
          // Start ringing before any History/network work so foreground alarms
          // still sound immediately if the device/app audio is muted or slow.
          openAlarmRingScreen(parsed);
          // Create a durable History row as soon as the alarm is delivered. Later
          // Dismiss/Snooze actions upsert the same occurrence and replace Missed.
          await recordAlarmHistoryMissed(parsed);
        })();
      });

      responseSub = addNotificationResponseReceivedListener((response) => {
        void handleAlarmFireNotificationResponse(response);
      });
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
      appStateSub.remove();
    };
  }, []);

  return null;
}
