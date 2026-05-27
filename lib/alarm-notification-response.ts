import dismissNotificationAsync from 'expo-notifications/build/dismissNotificationAsync';
import { DEFAULT_ACTION_IDENTIFIER } from 'expo-notifications/build/NotificationsEmitter';
import type { NotificationResponse } from 'expo-notifications/build/Notifications.types';
import { router } from 'expo-router';

import {
  ALARM_FIRE_DATA_TYPE,
  ALARM_NOTIFICATION_ACTION_DISMISS,
  ALARM_NOTIFICATION_ACTION_SNOOZE,
} from '@/lib/alarm-notification-constants';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { parseAlarmFireFromNotification } from '@/lib/alarm-fire-notification-data';
import {
  loadSnoozeMinutesForHistory,
  recordAlarmHistoryDismissed,
  recordAlarmHistorySnoozed,
} from '@/lib/alarm-history-sync';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';
import { clearMissedAlarmAppBadge } from '@/lib/missed-alarm-app-badge';
import { startRingAlarmSound, stopRingAlarmSound } from '@/lib/ring-alarm-sound';

/** Full-screen ring UI. Use `replace` so a cold start from a notification is not overwritten by `/alarm`. */
export function openAlarmRingScreen(parsed: ParsedAlarmFireData): void {
  void startRingAlarmSound(parsed.soundId);
  router.replace({
    pathname: '/alarm-ring',
    params: {
      alarmId: String(parsed.alarmId),
      fireAt: parsed.fireAt,
      label: parsed.label,
      category: parsed.category,
      ...(parsed.soundId ? { soundId: parsed.soundId } : {}),
      ...(parsed.userId != null ? { userId: String(parsed.userId) } : {}),
    },
  });
}

/** Full-screen ring, Dismiss / Snooze actions, reschedule fires. */
export async function handleAlarmFireNotificationResponse(response: NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.type !== ALARM_FIRE_DATA_TYPE) {
    return;
  }

  const parsed = parseAlarmFireFromNotification(response.notification);
  if (!parsed) {
    return;
  }

  const reqId = response.notification.request.identifier;
  const action = response.actionIdentifier;

  if (action === DEFAULT_ACTION_IDENTIFIER) {
    openAlarmRingScreen(parsed);
    await dismissNotificationAsync(reqId).catch(() => undefined);
    await syncAlarmFireNotifications();
    return;
  }

  await dismissNotificationAsync(reqId).catch(() => undefined);
  await clearMissedAlarmAppBadge();

  if (action === ALARM_NOTIFICATION_ACTION_SNOOZE) {
    await stopRingAlarmSound();
    const minutes = await loadSnoozeMinutesForHistory();
    await scheduleSnoozeNotification({ minutes, alarmTitle: parsed.label });
    await recordAlarmHistorySnoozed(parsed, minutes);
  } else if (action === ALARM_NOTIFICATION_ACTION_DISMISS) {
    await stopRingAlarmSound();
    await recordAlarmHistoryDismissed(parsed);
  }

  await syncAlarmFireNotifications();
}
