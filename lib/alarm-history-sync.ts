import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { upsertAlarmHistory } from '@/lib/alarm-history-api';
import { loadDefaultSnoozeMinutes } from '@/lib/settings-preferences';
import { fetchCurrentUserRowId } from '@/lib/users-table';

async function resolveHistoryUserId(parsed: ParsedAlarmFireData): Promise<number | null> {
  const embedded = parsed.userId;
  if (typeof embedded === 'number' && Number.isFinite(embedded)) {
    return embedded;
  }
  const { id, error } = await fetchCurrentUserRowId();
  if (error || id == null) {
    return null;
  }
  return id;
}

/** Records `missed` at fire time (idempotent per occurrence on the server). */
export async function recordAlarmHistoryMissed(parsed: ParsedAlarmFireData): Promise<void> {
  const userId = await resolveHistoryUserId(parsed);
  if (userId == null) {
    return;
  }
  await upsertAlarmHistory({
    user_id: userId,
    alarm_id: parsed.alarmId,
    scheduled_fire_at: parsed.fireAt,
    status: 'missed',
    label: parsed.label,
    category: parsed.category,
    action_at: null,
    snooze_minutes: null,
  }).catch(() => undefined);
}

export async function recordAlarmHistoryDismissed(parsed: ParsedAlarmFireData): Promise<void> {
  const userId = await resolveHistoryUserId(parsed);
  if (userId == null) {
    return;
  }
  await upsertAlarmHistory({
    user_id: userId,
    alarm_id: parsed.alarmId,
    scheduled_fire_at: parsed.fireAt,
    status: 'dismissed',
    label: parsed.label,
    category: parsed.category,
    snooze_minutes: null,
  }).catch(() => undefined);
}

export async function recordAlarmHistorySnoozed(parsed: ParsedAlarmFireData, minutes: number): Promise<void> {
  const userId = await resolveHistoryUserId(parsed);
  if (userId == null) {
    return;
  }
  await upsertAlarmHistory({
    user_id: userId,
    alarm_id: parsed.alarmId,
    scheduled_fire_at: parsed.fireAt,
    status: 'snoozed',
    label: parsed.label,
    category: parsed.category,
    snooze_minutes: minutes,
  }).catch(() => undefined);
}

/** Loads default snooze minutes from settings (same source as the Snooze notification action). */
export async function loadSnoozeMinutesForHistory(): Promise<number> {
  return loadDefaultSnoozeMinutes();
}
