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
import {
  parseAlarmFiresFromNotification,
  serializeAlarmFireBatchParam,
} from '@/lib/alarm-fire-notification-data';
import {
  loadSnoozeMinutesForHistory,
  recordAlarmHistoryDismissed,
  recordAlarmHistorySnoozed,
} from '@/lib/alarm-history-sync';
import { recordSuccessfulAlarmDismiss } from '@/lib/in-app-review';
import { markAlarmFiresDelivered, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { isAlarmFireDeliveryAllowed } from '@/lib/alarm-fire-delivery-guard';
import {
  isFreeTierRingDeliveryBlocked,
  openFreeTierRingLimitPaywall,
} from '@/lib/alarm-free-ring-limit';
import { scheduleSnoozeNotification } from '@/lib/device-snooze';
import { clearMissedAlarmAppBadge } from '@/lib/missed-alarm-app-badge';
import { stopNativeAlarmSound } from '@/lib/android-alarm-native-prefs';
import { stopRingAlarmSound } from '@/lib/ring-alarm-sound';

/** Dismiss a stale notification and open the paywall when the free ring cap blocks this occurrence. */
export async function blockFreeTierRingDelivery(notificationIdentifier: string): Promise<void> {
  await dismissNotificationAsync(notificationIdentifier).catch(() => undefined);
  stopNativeAlarmSound();
  await stopRingAlarmSound();
  await syncAlarmFireNotifications();
  openFreeTierRingLimitPaywall();
}

async function filterDeliverableAlarmFires(alarms: ParsedAlarmFireData[]): Promise<ParsedAlarmFireData[]> {
  const deliverable: ParsedAlarmFireData[] = [];
  for (const alarm of alarms) {
    if (!(await isAlarmFireDeliveryAllowed(alarm))) {
      continue;
    }
    if (await isFreeTierRingDeliveryBlocked(alarm.alarmId)) {
      continue;
    }
    deliverable.push(alarm);
  }
  return deliverable;
}

/** Full-screen ring UI. Use `replace` so a cold start from a notification is not overwritten by `/alarm`. */
export function openAlarmRingScreen(alarms: ParsedAlarmFireData[]): void {
  if (alarms.length === 0) {
    return;
  }

  if (alarms.length === 1) {
    const parsed = alarms[0];
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
    return;
  }

  const leader = alarms[0];
  router.replace({
    pathname: '/alarm-ring',
    params: {
      batch: '1',
      fireAt: leader.fireAt,
      batchAlarms: serializeAlarmFireBatchParam(alarms),
      ...(leader.userId != null ? { userId: String(leader.userId) } : {}),
    },
  });
}

/** Full-screen ring, Dismiss / Snooze actions, reschedule fires. */
export async function handleAlarmFireNotificationResponse(response: NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.type !== ALARM_FIRE_DATA_TYPE) {
    return;
  }

  const alarms = parseAlarmFiresFromNotification(response.notification);
  if (alarms.length === 0) {
    return;
  }

  const deliverable = await filterDeliverableAlarmFires(alarms);
  if (deliverable.length === 0) {
    const anyBlocked = await Promise.all(alarms.map((alarm) => isFreeTierRingDeliveryBlocked(alarm.alarmId)));
    if (anyBlocked.some(Boolean)) {
      await blockFreeTierRingDelivery(response.notification.request.identifier);
      return;
    }
    await dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
    stopNativeAlarmSound();
    await stopRingAlarmSound();
    await syncAlarmFireNotifications();
    return;
  }

  const reqId = response.notification.request.identifier;
  const action = response.actionIdentifier;

  await markAlarmFiresDelivered(deliverable);

  if (action === DEFAULT_ACTION_IDENTIFIER) {
    openAlarmRingScreen(deliverable);
    await dismissNotificationAsync(reqId).catch(() => undefined);
    await syncAlarmFireNotifications();
    return;
  }

  await dismissNotificationAsync(reqId).catch(() => undefined);
  await clearMissedAlarmAppBadge();

  if (action === ALARM_NOTIFICATION_ACTION_SNOOZE) {
    await stopRingAlarmSound();
    const minutes = await loadSnoozeMinutesForHistory();
    for (const parsed of deliverable) {
      await scheduleSnoozeNotification({ minutes, alarmTitle: parsed.label, alarmData: parsed });
      await recordAlarmHistorySnoozed(parsed, minutes);
    }
  } else if (action === ALARM_NOTIFICATION_ACTION_DISMISS) {
    await stopRingAlarmSound();
    for (const parsed of deliverable) {
      await recordAlarmHistoryDismissed(parsed);
      await recordSuccessfulAlarmDismiss();
    }
  }

  await syncAlarmFireNotifications();
}
