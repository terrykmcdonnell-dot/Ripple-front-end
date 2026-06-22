import { Platform } from 'react-native';

import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import {
  flushPendingAlarmHistoryWrites,
  recordAlarmHistoryDismissed,
  recordAlarmHistoryMissed,
  recordAlarmHistorySnoozed,
} from '@/lib/alarm-history-sync';
import { markAlarmFireDelivered, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { consumeNativePendingAlarmActionsRaw } from '@/lib/android-alarm-native-prefs';

type PendingNativeAlarmAction = {
  type: 'dismiss' | 'missed' | 'snooze';
  alarmId: number;
  fireAt: string;
  label: string;
  category?: string;
  soundId?: string;
  userId?: number | null;
  snoozeMinutes?: number;
  actionAt?: string;
};

function parseActionAt(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function parsePendingLine(line: string): PendingNativeAlarmAction | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    const alarmId = Number(raw.alarmId);
    const fireAt = typeof raw.fireAt === 'string' ? raw.fireAt : '';
    if (!Number.isFinite(alarmId) || !fireAt) {
      return null;
    }
    const type =
      raw.type === 'snooze'
        ? 'snooze'
        : raw.type === 'dismiss'
          ? 'dismiss'
          : raw.type === 'missed'
            ? 'missed'
            : null;
    if (!type) {
      return null;
    }
    return {
      type,
      alarmId,
      fireAt,
      label: typeof raw.label === 'string' ? raw.label : 'Alarm',
      category: typeof raw.category === 'string' ? raw.category : undefined,
      soundId: typeof raw.soundId === 'string' ? raw.soundId : undefined,
      userId: typeof raw.userId === 'number' ? raw.userId : null,
      snoozeMinutes: typeof raw.snoozeMinutes === 'number' ? raw.snoozeMinutes : undefined,
      actionAt: parseActionAt(raw.actionAt),
    };
  } catch {
    return null;
  }
}

function toParsedAlarm(action: PendingNativeAlarmAction): ParsedAlarmFireData {
  return {
    alarmId: action.alarmId,
    fireAt: action.fireAt,
    label: action.label,
    category: action.category ?? '',
    soundId: action.soundId,
    userId: action.userId ?? undefined,
  };
}

/** Applies dismiss/snooze outcomes queued by the native lock-screen alarm UI. */
export async function processPendingNativeAlarmActions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const raw = await consumeNativePendingAlarmActionsRaw();
  if (!raw.trim()) {
    return;
  }
  for (const line of raw.split('\n')) {
    const action = parsePendingLine(line.trim());
    if (!action) {
      continue;
    }
    const parsed = toParsedAlarm(action);
    const fireAtMs = new Date(parsed.fireAt).getTime();
    if (Number.isFinite(fireAtMs)) {
      await markAlarmFireDelivered(parsed.alarmId, fireAtMs);
    }
    if (action.type === 'dismiss') {
      await recordAlarmHistoryDismissed(parsed, action.actionAt).catch(() => undefined);
    } else if (action.type === 'missed') {
      await recordAlarmHistoryMissed(parsed).catch(() => undefined);
    } else {
      await recordAlarmHistorySnoozed(parsed, action.snoozeMinutes ?? 10, action.actionAt).catch(() => undefined);
    }
  }
  await flushPendingAlarmHistoryWrites().catch(() => undefined);
  await syncAlarmFireNotifications();
}
