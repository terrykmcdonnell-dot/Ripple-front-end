import { cancelAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { cancelPendingSnoozeNotification } from '@/lib/device-snooze';
import { cancelUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';

/** Cancels Ripple-scheduled snooze + upcoming reminder + alarm-fire notifications (does not revoke OS permission). */
export async function cancelAllRippleScheduledNotifications(): Promise<void> {
  await Promise.all([
    cancelPendingSnoozeNotification(),
    cancelUpcomingReminderNotifications(),
    cancelAlarmFireNotifications(),
  ]);
}
