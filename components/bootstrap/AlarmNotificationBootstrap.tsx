import { useEffect } from 'react';
import { Platform } from 'react-native';

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
import { parseAlarmFireFromNotification } from '@/lib/alarm-fire-notification-data';
import { consumeInitialAlarmFireResponse } from '@/lib/android-alarm-cold-start';
import { handleAlarmFireNotificationResponse, openAlarmRingScreen } from '@/lib/alarm-notification-response';
import { RIPPLE_ALARM_HISTORY_BG_TASK } from '@/lib/alarm-history-notification-task';
import { recordAlarmHistoryMissed } from '@/lib/alarm-history-sync';

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

    void (async () => {
      await ensureAlarmFireCategoryRegistered().catch(() => undefined);
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
        void recordAlarmHistoryMissed(parsed);
        openAlarmRingScreen(parsed);
      });

      responseSub = addNotificationResponseReceivedListener((response) => {
        void handleAlarmFireNotificationResponse(response);
      });
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, []);

  return null;
}
