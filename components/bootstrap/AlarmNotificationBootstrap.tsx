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
import { ensureAllAndroidAlarmChannelsAsync } from '@/lib/alarm-fire-scheduler';
import { parseAlarmFireFromNotification } from '@/lib/alarm-fire-notification-data';
import { consumeInitialAlarmFireResponse } from '@/lib/android-alarm-cold-start';
import { processPendingNativeAlarmActions } from '@/lib/android-native-alarm-actions';
import { handleAlarmFireNotificationResponse, openAlarmRingScreen } from '@/lib/alarm-notification-response';
import { markAlarmFireDelivered } from '@/lib/alarm-fire-scheduler';
import { RIPPLE_ALARM_HISTORY_BG_TASK } from '@/lib/alarm-history-notification-task';

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
      await ensureAllAndroidAlarmChannelsAsync().catch(() => undefined);
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
          const fireAtMs = new Date(parsed.fireAt).getTime();
          if (Number.isFinite(fireAtMs)) {
            await markAlarmFireDelivered(parsed.alarmId, fireAtMs);
          }
          openAlarmRingScreen(parsed);
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
    };
  }, []);

  return null;
}
