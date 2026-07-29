import * as TaskManager from 'expo-task-manager';

import { parseAlarmFiresFromTaskPayload } from '@/lib/alarm-fire-notification-data';
import { isFreeTierRingDeliveryBlocked } from '@/lib/alarm-free-ring-limit';
import { flushPendingAlarmHistoryWrites, recordAlarmHistoryMissed } from '@/lib/alarm-history-sync';
import type { NotificationTaskPayload } from 'expo-notifications/build/Notifications.types';

/** Registered with `registerTaskAsync` so alarm deliveries record `missed` while backgrounded / terminated (OS permitting). */
export const RIPPLE_ALARM_HISTORY_BG_TASK = 'ripple-alarm-history-bg';

TaskManager.defineTask(RIPPLE_ALARM_HISTORY_BG_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const alarms = parseAlarmFiresFromTaskPayload(data as NotificationTaskPayload);
  if (alarms.length === 0) {
    return;
  }
  for (const parsed of alarms) {
    if (await isFreeTierRingDeliveryBlocked(parsed.alarmId)) {
      continue;
    }
    await recordAlarmHistoryMissed(parsed);
  }
  await flushPendingAlarmHistoryWrites();
});
