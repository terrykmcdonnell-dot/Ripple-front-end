import type {
  Notification,
  NotificationTaskPayload,
} from 'expo-notifications/build/Notifications.types';

import { ALARM_FIRE_DATA_TYPE } from '@/lib/alarm-notification-constants';

export type ParsedAlarmFireData = {
  alarmId: number;
  fireAt: string;
  label: string;
  category: string;
  categoryId?: number;
  categoryIcon?: string;
  /** Alarm sound preset id — used for in-app loop when the ring screen opens. */
  soundId?: string;
  /** Present when the alarm was scheduled from a signed-in session — used so background tasks can POST history without Supabase session hydration. */
  userId?: number;
  /** Original scheduled occurrence time — preserved across snooze re-rings for history dedup. */
  occurrenceFireAt?: string;
};

function coerceAlarmId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function parseAlarmFireEntry(raw: unknown, sharedFireAt: string, sharedUserId?: number): ParsedAlarmFireData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const alarmId = coerceAlarmId(data.alarmId);
  const fireAt = typeof data.fireAt === 'string' && data.fireAt.trim() ? data.fireAt.trim() : sharedFireAt;
  if (alarmId == null || !fireAt) {
    return null;
  }
  const label = typeof data.label === 'string' ? data.label.trim() || 'Alarm' : 'Alarm';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const categoryIcon = typeof data.categoryIcon === 'string' ? data.categoryIcon.trim() : '';
  const categoryId = coerceAlarmId(data.categoryId);
  const soundId = typeof data.soundId === 'string' ? data.soundId.trim() : '';
  const uid = coerceAlarmId(data.userId) ?? sharedUserId;
  const occurrenceFireAt =
    typeof data.occurrenceFireAt === 'string' && data.occurrenceFireAt.trim()
      ? data.occurrenceFireAt.trim()
      : undefined;
  return {
    alarmId,
    fireAt,
    label,
    category,
    ...(categoryId != null ? { categoryId } : {}),
    ...(categoryIcon ? { categoryIcon } : {}),
    ...(soundId ? { soundId } : {}),
    ...(uid != null ? { userId: uid } : {}),
    ...(occurrenceFireAt ? { occurrenceFireAt } : {}),
  };
}

/** Parses `content.data` from an alarm-fire notification request (single-alarm legacy shape). */
export function parseAlarmFireNotificationData(raw: unknown): ParsedAlarmFireData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (data.type !== ALARM_FIRE_DATA_TYPE) {
    return null;
  }

  const sharedFireAt = typeof data.fireAt === 'string' ? data.fireAt : '';
  const sharedUserId = coerceAlarmId(data.userId) ?? undefined;

  if (data.batch === true && Array.isArray(data.alarms)) {
    const alarms = data.alarms
      .map((entry) => parseAlarmFireEntry(entry, sharedFireAt, sharedUserId))
      .filter((entry): entry is ParsedAlarmFireData => entry != null);
    return alarms[0] ?? null;
  }

  return parseAlarmFireEntry(data, sharedFireAt, sharedUserId);
}

/** Every alarm in a notification — one item for legacy payloads, many for same-time batches. */
export function parseAlarmFiresFromNotification(notification: Notification): ParsedAlarmFireData[] {
  const parsed = parseAlarmFiresFromNotificationData(notification.request.content.data);
  return parsed ?? [];
}

export function parseAlarmFiresFromNotificationData(raw: unknown): ParsedAlarmFireData[] | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (data.type !== ALARM_FIRE_DATA_TYPE) {
    return null;
  }

  const sharedFireAt = typeof data.fireAt === 'string' ? data.fireAt : '';
  const sharedUserId = coerceAlarmId(data.userId) ?? undefined;

  if (data.batch === true && Array.isArray(data.alarms)) {
    const alarms = data.alarms
      .map((entry) => parseAlarmFireEntry(entry, sharedFireAt, sharedUserId))
      .filter((entry): entry is ParsedAlarmFireData => entry != null);
    return alarms.length > 0 ? alarms : null;
  }

  const single = parseAlarmFireEntry(data, sharedFireAt, sharedUserId);
  return single ? [single] : null;
}

export function parseAlarmFireFromNotification(notification: Notification): ParsedAlarmFireData | null {
  return parseAlarmFireNotificationData(notification.request.content.data);
}

function parseFromPlainNotificationRecord(n: Record<string, unknown>): ParsedAlarmFireData | null {
  const req = n.request as Record<string, unknown> | undefined;
  const content = req?.content as Record<string, unknown> | undefined;
  return parseAlarmFireNotificationData(content?.data);
}

/** Background task payloads may be a tap response or a delivery envelope — normalize to parsed fire data. */
export function parseAlarmFireFromTaskPayload(payload: NotificationTaskPayload): ParsedAlarmFireData | null {
  if ('actionIdentifier' in payload && payload.notification) {
    return parseAlarmFireFromNotification(payload.notification);
  }
  const raw = payload.notification;
  if (raw && typeof raw === 'object') {
    return parseFromPlainNotificationRecord(raw as Record<string, unknown>);
  }
  return null;
}

/** Background/history task — returns every alarm in a batch delivery. */
export function parseAlarmFiresFromTaskPayload(payload: NotificationTaskPayload): ParsedAlarmFireData[] {
  if ('actionIdentifier' in payload && payload.notification) {
    return parseAlarmFiresFromNotification(payload.notification);
  }
  const raw = payload.notification;
  if (raw && typeof raw === 'object') {
    const req = (raw as Record<string, unknown>).request as Record<string, unknown> | undefined;
    const content = req?.content as Record<string, unknown> | undefined;
    return parseAlarmFiresFromNotificationData(content?.data) ?? [];
  }
  return [];
}

/** Route param JSON for multi-alarm ring screen. */
export function serializeAlarmFireBatchParam(alarms: ParsedAlarmFireData[]): string {
  return JSON.stringify(alarms);
}

export function parseAlarmFireBatchParam(raw: string | undefined): ParsedAlarmFireData[] | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const alarms = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const e = entry as Record<string, unknown>;
        const fireAt = typeof e.fireAt === 'string' ? e.fireAt : '';
        return parseAlarmFireEntry(e, fireAt);
      })
      .filter((entry): entry is ParsedAlarmFireData => entry != null);
    return alarms.length > 0 ? alarms : null;
  } catch {
    return null;
  }
}
