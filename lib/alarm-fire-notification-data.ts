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

/** Parses `content.data` from an alarm-fire notification request. */
export function parseAlarmFireNotificationData(raw: unknown): ParsedAlarmFireData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (data.type !== ALARM_FIRE_DATA_TYPE) {
    return null;
  }
  const alarmId = coerceAlarmId(data.alarmId);
  const fireAt = typeof data.fireAt === 'string' ? data.fireAt : '';
  if (alarmId == null || !fireAt) {
    return null;
  }
  const label = typeof data.label === 'string' ? data.label.trim() || 'Alarm' : 'Alarm';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const categoryIcon = typeof data.categoryIcon === 'string' ? data.categoryIcon.trim() : '';
  const categoryId = coerceAlarmId(data.categoryId);
  const soundId = typeof data.soundId === 'string' ? data.soundId.trim() : '';
  const uid = coerceAlarmId(data.userId);
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
