import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { type AlarmHistoryApiRow, type AlarmHistoryStatus, upsertAlarmHistory } from '@/lib/alarm-history-api';
import { loadDefaultSnoozeMinutes } from '@/lib/settings-preferences';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const PENDING_HISTORY_WRITES_KEY = 'ripple_pending_alarm_history_writes_v1';

type PendingHistoryWrite = {
  key: string;
  user_id: number | null;
  alarm_id: number;
  scheduled_fire_at: string;
  status: AlarmHistoryStatus;
  label: string;
  category: string;
  action_at: string | null;
  snooze_minutes: number | null;
  queued_at: string;
};

let _flushInProgress = false;
let _flushPending = false;

/**
 * Serializes every read-modify-write of the pending-history storage key.
 *
 * `enqueueAlarmHistory` and `flushPendingAlarmHistoryWrites` each load the list, mutate it,
 * then save it back — without this lock, an enqueue landing while a flush is mid-flight (e.g.
 * doing its network upserts) gets silently erased when the flush later writes back its stale
 * snapshot. That is how a fired alarm could go missing from History with no error anywhere.
 */
let _pendingHistoryLockTail: Promise<void> = Promise.resolve();

function withPendingHistoryLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = _pendingHistoryLockTail.then(fn, fn);
  _pendingHistoryLockTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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

function historyKey(userId: number | null, alarmId: number, fireAt: string): string {
  return `${userId ?? 'pending'}:${alarmId}:${fireAt}`;
}

function normalizeActionAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function rowsMatchUser(a: PendingHistoryWrite, b: PendingHistoryWrite): boolean {
  const sameKnownUser = a.user_id != null && b.user_id != null && a.user_id === b.user_id;
  return sameKnownUser || a.user_id == null || b.user_id == null;
}

/** Most recent snoozed row for this alarm — the parent occurrence a snooze re-ring should finalize. */
function findSnoozedParentRow(rows: PendingHistoryWrite[], next: PendingHistoryWrite): PendingHistoryWrite | null {
  const candidates = rows.filter(
    (row) => row.alarm_id === next.alarm_id && row.status === 'snoozed' && rowsMatchUser(row, next),
  );
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    const ta = a.action_at ? new Date(a.action_at).getTime() : 0;
    const tb = b.action_at ? new Date(b.action_at).getTime() : 0;
    return tb - ta;
  });
  return candidates[0];
}

function shouldReplacePending(existing: PendingHistoryWrite, next: PendingHistoryWrite): boolean {
  // Snooze re-ring dismissed: upgrade the original snoozed row (same scheduled_fire_at key).
  if (existing.status === 'snoozed' && next.status === 'dismissed') {
    return true;
  }
  // Other terminal outcomes are written once — never overwrite (e.g. stale tray actions).
  if (existing.status === 'dismissed' || existing.status === 'snoozed') {
    return false;
  }
  // Upgrade the initial "missed" placeholder when the user actually dismisses or snoozes.
  if (existing.status === 'missed') {
    return next.status === 'dismissed' || next.status === 'snoozed';
  }
  return false;
}

async function loadPendingHistoryWrites(): Promise<PendingHistoryWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_HISTORY_WRITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is PendingHistoryWrite => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const row = item as Record<string, unknown>;
      return (
        typeof row.key === 'string' &&
        (typeof row.user_id === 'number' || row.user_id === null) &&
        typeof row.alarm_id === 'number' &&
        typeof row.scheduled_fire_at === 'string' &&
        (row.status === 'missed' || row.status === 'dismissed' || row.status === 'snoozed') &&
        typeof row.label === 'string' &&
        typeof row.category === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function savePendingHistoryWrites(rows: PendingHistoryWrite[]): Promise<void> {
  if (rows.length === 0) {
    await AsyncStorage.removeItem(PENDING_HISTORY_WRITES_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_HISTORY_WRITES_KEY, JSON.stringify(rows));
}

function pendingWriteToHistoryRow(row: PendingHistoryWrite, fallbackUserId: number): AlarmHistoryApiRow {
  const idSource = `${row.user_id ?? fallbackUserId}:${row.alarm_id}:${row.scheduled_fire_at}`;
  let hash = 0;
  for (let i = 0; i < idSource.length; i += 1) {
    hash = (hash * 31 + idSource.charCodeAt(i)) | 0;
  }
  return {
    id: -Math.max(1, Math.abs(hash)),
    user_id: row.user_id ?? fallbackUserId,
    alarm_id: row.alarm_id,
    label: row.label,
    category: row.category,
    scheduled_fire_at: row.scheduled_fire_at,
    status: row.status,
    action_at: row.action_at,
    snooze_minutes: row.snooze_minutes,
  };
}

/** Pending local rows that have not reached the API yet; useful for the History screen. */
export async function loadPendingAlarmHistoryRows(userId: number): Promise<AlarmHistoryApiRow[]> {
  const rows = await loadPendingHistoryWrites();
  return rows
    .filter((row) => row.user_id == null || row.user_id === userId)
    .map((row) => pendingWriteToHistoryRow(row, userId));
}

/** Drop queued history writes for a deleted alarm. */
export async function removePendingAlarmHistoryForAlarm(alarmId: number): Promise<void> {
  await withPendingHistoryLock(async () => {
    const rows = await loadPendingHistoryWrites();
    const next = rows.filter((row) => row.alarm_id !== alarmId);
    if (next.length === rows.length) {
      return;
    }
    await savePendingHistoryWrites(next);
  });
}

/** Drop all queued local history writes (e.g. after clear-all). */
export async function clearAllPendingAlarmHistory(): Promise<void> {
  await withPendingHistoryLock(() => savePendingHistoryWrites([]));
}

async function enqueueAlarmHistory(
  parsed: ParsedAlarmFireData,
  status: AlarmHistoryStatus,
  snoozeMinutes: number | null,
  actionAt?: string | null,
) {
  const userId = await resolveHistoryUserId(parsed);
  const normalizedActionAt = normalizeActionAt(actionAt);
  const scheduledFireAt = parsed.occurrenceFireAt ?? parsed.fireAt;
  const next: PendingHistoryWrite = {
    key: historyKey(userId, parsed.alarmId, scheduledFireAt),
    user_id: userId,
    alarm_id: parsed.alarmId,
    scheduled_fire_at: scheduledFireAt,
    status,
    label: parsed.label,
    category: parsed.category,
    action_at: status === 'missed' ? null : (normalizedActionAt ?? new Date().toISOString()),
    snooze_minutes: snoozeMinutes,
    queued_at: new Date().toISOString(),
  };

  const queued = await withPendingHistoryLock(async () => {
    const rows = await loadPendingHistoryWrites();

    // Snooze re-ring (expo-scheduled snooze uses a later fireAt): do not create a separate
    // "missed" row — the original snoozed occurrence stays open until the user dismisses.
    if (status === 'missed') {
      const snoozedParent = findSnoozedParentRow(rows, next);
      if (snoozedParent && snoozedParent.scheduled_fire_at !== next.scheduled_fire_at) {
        return false;
      }
    }

    // Dismissing after a snooze re-ring should finalize the original snoozed row, not leave
    // a stale "snoozed" entry beside a separate dismiss at the snooze fire time.
    if (status === 'dismissed') {
      const snoozedParent = findSnoozedParentRow(rows, next);
      if (snoozedParent && snoozedParent.scheduled_fire_at !== next.scheduled_fire_at) {
        const parentIdx = rows.findIndex(
          (row) =>
            row.alarm_id === snoozedParent.alarm_id &&
            row.scheduled_fire_at === snoozedParent.scheduled_fire_at &&
            row.status === 'snoozed' &&
            rowsMatchUser(row, next),
        );
        if (parentIdx >= 0) {
          rows[parentIdx] = {
            ...rows[parentIdx],
            status: 'dismissed',
            action_at: next.action_at,
            label: next.label || rows[parentIdx].label,
            category: next.category || rows[parentIdx].category,
            snooze_minutes: null,
          };
          const kept = rows.filter((row, i) => {
            if (i === parentIdx) {
              return true;
            }
            if (row.alarm_id !== next.alarm_id || !rowsMatchUser(row, next)) {
              return true;
            }
            // Drop the snooze-fire duplicate (missed/dismissed keyed to re-ring time).
            return row.scheduled_fire_at !== next.scheduled_fire_at;
          });
          await savePendingHistoryWrites(kept);
          return true;
        }
      }
    }

    const existingIndex = rows.findIndex((row) => {
      const sameOccurrence = row.alarm_id === next.alarm_id && row.scheduled_fire_at === next.scheduled_fire_at;
      const sameKnownUser = row.user_id != null && next.user_id != null && row.user_id === next.user_id;
      const eitherUserPending = row.user_id == null || next.user_id == null;
      return sameOccurrence && (sameKnownUser || eitherUserPending);
    });

    if (existingIndex >= 0) {
      const existing = rows[existingIndex];
      if (!shouldReplacePending(existing, next)) {
        return false;
      }
      rows[existingIndex] = {
        ...next,
        // Keep the first user-action timestamp if we ever merge terminal states.
        action_at: next.action_at ?? existing.action_at,
      };
    } else {
      rows.push(next);
    }

    await savePendingHistoryWrites(rows);
    return true;
  });

  if (queued) {
    await flushPendingAlarmHistoryWrites();
  }
}

/** Retries queued history writes. Safe to call on app start, app foreground, and History screen focus. */
export async function flushPendingAlarmHistoryWrites(): Promise<void> {
  if (_flushInProgress) {
    _flushPending = true;
    return;
  }

  _flushInProgress = true;
  _flushPending = false;

  try {
    await withPendingHistoryLock(async () => {
      const rows = await loadPendingHistoryWrites();
      if (rows.length === 0) {
        return;
      }

      const remaining: PendingHistoryWrite[] = [];

      for (const row of rows) {
        let userId = row.user_id;
        if (userId == null) {
          const { id, error } = await fetchCurrentUserRowId();
          if (error || id == null) {
            remaining.push(row);
            continue;
          }
          userId = id;
        }

        try {
          await upsertAlarmHistory({
            user_id: userId,
            alarm_id: row.alarm_id,
            scheduled_fire_at: row.scheduled_fire_at,
            status: row.status,
            label: row.label,
            category: row.category,
            action_at: row.action_at,
            snooze_minutes: row.snooze_minutes,
          });
        } catch {
          remaining.push({ ...row, user_id: userId, key: historyKey(userId, row.alarm_id, row.scheduled_fire_at) });
        }
      }

      await savePendingHistoryWrites(remaining);
    });
  } finally {
    _flushInProgress = false;
    if (_flushPending) {
      _flushPending = false;
      void flushPendingAlarmHistoryWrites();
    }
  }
}

/** Records `missed` at fire time so every delivered alarm has a History row. */
export async function recordAlarmHistoryMissed(parsed: ParsedAlarmFireData): Promise<void> {
  await enqueueAlarmHistory(parsed, 'missed', null).catch(() => undefined);
}

export async function recordAlarmHistoryDismissed(parsed: ParsedAlarmFireData, actionAt?: string | null): Promise<void> {
  await enqueueAlarmHistory(parsed, 'dismissed', null, actionAt).catch(() => undefined);
}

export async function recordAlarmHistorySnoozed(
  parsed: ParsedAlarmFireData,
  minutes: number,
  actionAt?: string | null,
): Promise<void> {
  await enqueueAlarmHistory(parsed, 'snoozed', minutes, actionAt).catch(() => undefined);
}

/** Loads default snooze minutes from settings (same source as the Snooze notification action). */
export async function loadSnoozeMinutesForHistory(): Promise<number> {
  return loadDefaultSnoozeMinutes();
}
