import { useEffect } from 'react';
import { Platform } from 'react-native';

import dismissNotificationAsync from 'expo-notifications/build/dismissNotificationAsync';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
import registerTaskAsync from 'expo-notifications/build/registerTaskAsync';
import setNotificationCategoryAsync from 'expo-notifications/build/setNotificationCategoryAsync';
import type { NotificationResponse } from 'expo-notifications/build/Notifications.types';

import {
  ALARM_FIRE_CATEGORY_ID,
  ALARM_FIRE_DATA_TYPE,
  ALARM_NOTIFICATION_ACTION_DISMISS,
  ALARM_NOTIFICATION_ACTION_SNOOZE,
} from '@/lib/alarm-notification-constants';
import { parseAlarmFireFromNotification } from '@/lib/alarm-fire-notification-data';
import { RIPPLE_ALARM_HISTORY_BG_TASK } from '@/lib/alarm-history-notification-task';
import {
  loadSnoozeMinutesForHistory,
  recordAlarmHistoryDismissed,
  recordAlarmHistoryMissed,
  recordAlarmHistorySnoozed,
} from '@/lib/alarm-history-sync';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';

async function ensureAlarmFireCategoryRegistered(): Promise<void> {
  await setNotificationCategoryAsync(ALARM_FIRE_CATEGORY_ID, [
    {
      identifier: ALARM_NOTIFICATION_ACTION_DISMISS,
      buttonTitle: 'Dismiss',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ALARM_NOTIFICATION_ACTION_SNOOZE,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: true },
    },
  ]);
}

/** Shared handler: dismiss banner, record history for Snooze/Dismiss actions, reschedule fires. */
async function handleAlarmFireNotificationResponse(response: NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.type !== ALARM_FIRE_DATA_TYPE) {
    return;
  }

  const parsed = parseAlarmFireFromNotification(response.notification);
  if (!parsed) {
    return;
  }

  const reqId = response.notification.request.identifier;
  await dismissNotificationAsync(reqId).catch(() => undefined);

  const action = response.actionIdentifier;

  if (action === ALARM_NOTIFICATION_ACTION_SNOOZE) {
    const minutes = await loadSnoozeMinutesForHistory();
    await scheduleSnoozeNotification({ minutes, alarmTitle: parsed.label });
    await recordAlarmHistorySnoozed(parsed, minutes);
  } else if (action === ALARM_NOTIFICATION_ACTION_DISMISS) {
    await recordAlarmHistoryDismissed(parsed);
  }

  await syncAlarmFireNotifications();
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
        const last = await getLastNotificationResponseAsync();
        if (!cancelled && last) {
          const raw = last.notification.request.content.data as Record<string, unknown> | undefined;
          if (raw?.type === ALARM_FIRE_DATA_TYPE) {
            await handleAlarmFireNotificationResponse(last);
            await clearLastNotificationResponseAsync();
          }
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
