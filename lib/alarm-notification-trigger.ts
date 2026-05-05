/**
 * Minimum gap between “now” and a DATE trigger so we still schedule imminent alarms,
 * while avoiding races where the OS considers the time already passed mid-bridge.
 */
export const MIN_ALARM_SCHEDULE_LEAD_MS = 750;

/**
 * Use whole-second timestamps for AlarmManager triggers so delivery matches the wall clock
 * users set (avoids ms drift / rounding quirks).
 */
export function alignAlarmNotificationTriggerDate(d: Date): Date {
  const x = new Date(d.getTime());
  x.setMilliseconds(0);
  return x;
}
