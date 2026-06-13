import * as TaskManager from 'expo-task-manager';

import { parseAlarmFireFromTaskPayload } from '@/lib/alarm-fire-notification-data';
import { flushPendingAlarmHistoryWrites, recordAlarmHistoryMissed } from '@/lib/alarm-history-sync';
import type { NotificationTaskPayload } from 'expo-notifications/build/Notifications.types';

/** Registered with `registerTaskAsync` so alarm deliveries record `missed` while backgrounded / terminated (OS permitting). */
export const RIPPLE_ALARM_HISTORY_BG_TASK = 'ripple-alarm-history-bg';

TaskManager.defineTask(RIPPLE_ALARM_HISTORY_BG_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const parsed = parseAlarmFireFromTaskPayload(data as NotificationTaskPayload);
  if (!parsed) {
    return;
  }
  await recordAlarmHistoryMissed(parsed);
  await flushPendingAlarmHistoryWrites();
});
