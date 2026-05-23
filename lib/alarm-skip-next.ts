import { alarmScheduledAtToApiIso } from '@/lib/alarm-datetime';
import type { AlarmListItem } from '@/lib/alarm-format';
import { advanceAlarmOccurrence, nextCanonicalAlarmFire } from '@/lib/upcoming-reminder-scheduler';

/** Minimal fields from the server row used to compute the next ring (see {@link nextCanonicalAlarmFire}). */
export type AlarmScheduleBaseline = Pick<AlarmListItem, 'scheduledAt' | 'interval' | 'unit'>;

function asListItemForSchedule(baseline: AlarmScheduleBaseline): AlarmListItem {
  return {
    id: 0,
    label: '',
    scheduledAt: baseline.scheduledAt,
    interval: baseline.interval,
    unit: baseline.unit,
    category: '',
    isEnabled: true,
  };
}

/** Next ringing instant from the saved anchor, or `null` if none within the scheduler horizon. */
export function getNextOccurrenceForAlarmSchedule(
  baseline: AlarmScheduleBaseline,
  now: Date = new Date(),
): Date | null {
  return nextCanonicalAlarmFire(asListItemForSchedule(baseline), now);
}

/**
 * After skip, the stored `scheduled_at` becomes the instant **one repeat step after** the next ring,
 * so the next OS-scheduled fire is the occurrence after the skipped one.
 */
export function computeScheduledAtAfterSkipNext(
  baseline: AlarmScheduleBaseline,
  now: Date = new Date(),
): string | null {
  const next = getNextOccurrenceForAlarmSchedule(baseline, now);
  if (!next) {
    return null;
  }
  return alarmScheduledAtToApiIso(advanceAlarmOccurrence(next, baseline.interval, baseline.unit));
}
