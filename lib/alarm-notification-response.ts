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
import { markAlarmFireDelivered, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { isAlarmFireDeliveryAllowed } from '@/lib/alarm-fire-delivery-guard';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';
import { clearMissedAlarmAppBadge } from '@/lib/missed-alarm-app-badge';
import { stopNativeAlarmSound } from '@/lib/android-alarm-native-prefs';
import { stopRingAlarmSound } from '@/lib/ring-alarm-sound';

/** Full-screen ring UI. Use `replace` so a cold start from a notification is not overwritten by `/alarm`. */
export function openAlarmRingScreen(parsed: ParsedAlarmFireData): void {
  // AlarmRingScreen owns sound startup. Starting here as well created two near-simultaneous
  // native service starts around navigation; its mount/cleanup could then race an ACTION_STOP
  // against startForegroundService() and crash Android's foreground-service watchdog.
  router.replace({
    pathname: '/alarm-ring',
    params: {
      alarmId: String(parsed.alarmId),
      fireAt: parsed.fireAt,
      label: parsed.label,
      category: parsed.category,
      ...(parsed.categoryId != null ? { categoryId: String(parsed.categoryId) } : {}),
      ...(parsed.categoryIcon ? { categoryIcon: parsed.categoryIcon } : {}),
      ...(parsed.soundId ? { soundId: parsed.soundId } : {}),
      ...(parsed.userId != null ? { userId: String(parsed.userId) } : {}),
      ...(parsed.occurrenceFireAt ? { occurrenceFireAt: parsed.occurrenceFireAt } : {}),
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

  if (!(await isAlarmFireDeliveryAllowed(parsed))) {
    await dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
    stopNativeAlarmSound();
    await stopRingAlarmSound();
    await syncAlarmFireNotifications();
    return;
  }

  const reqId = response.notification.request.identifier;
  const action = response.actionIdentifier;

  // Mark this occurrence delivered before any sync runs.
  // syncAlarmFireNotifications (called below) runs before the ring screen
  // has mounted, so the ring screen's own useEffect markAlarmFireDelivered
  // call would be too late — the sync would see an empty delivered map,
  // treat the grace-window alarm as undelivered, and schedule a duplicate
  // now+5 s notification. Marking it here ensures the sync skips it and arms
  // the deferred re-sync timer for the next occurrence instead.
  const fireAtMs = new Date(parsed.fireAt).getTime();
  if (Number.isFinite(fireAtMs)) {
    await markAlarmFireDelivered(parsed.alarmId, fireAtMs);
  }

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
    await scheduleSnoozeNotification({ minutes, alarmTitle: parsed.label, alarmData: parsed });
    await recordAlarmHistorySnoozed(parsed, minutes);
  } else if (action === ALARM_NOTIFICATION_ACTION_DISMISS) {
    await stopRingAlarmSound();
    await recordAlarmHistoryDismissed(parsed);
  }

  await syncAlarmFireNotifications();
}
