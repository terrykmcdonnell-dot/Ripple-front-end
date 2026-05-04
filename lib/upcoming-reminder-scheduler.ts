import AsyncStorage from '@react-native-async-storage/async-storage';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';
import { Platform } from 'react-native';

import { fetchAlarms } from '@/lib/alarm-api';
import type { AlarmListItem } from '@/lib/alarm-format';
import { coerceAlarmUnit, formatScheduledLocalParts } from '@/lib/alarm-format';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import {
  formatUpcomingReminderLeadLabel,
  loadDefaultAlarmSoundId,
  loadDefaultVibrationEnabled,
  loadNotificationsMasterEnabled,
  loadUpcomingReminderEnabled,
  loadUpcomingReminderLeadMinutes,
} from '@/lib/settings-preferences';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { isOsNotificationAllowed } from '@/lib/notification-os-status';

const STORAGE_IDS_KEY = 'ripple_upcoming_scheduled_notification_ids';

const VIBRATION_PATTERN = [0, 400, 200, 400] as const;

async function cancelStoredUpcomingNotifications(): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_IDS_KEY);
  let ids: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    ids = [];
  }
  await Promise.all(ids.map((id) => cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(STORAGE_IDS_KEY);
}

export async function cancelUpcomingReminderNotifications(): Promise<void> {
  await cancelStoredUpcomingNotifications();
}

function advanceOccurrence(from: Date, interval: number, unitRaw: string): Date {
  const unit = coerceAlarmUnit(unitRaw);
  const n = Math.max(1, interval);
  const d = new Date(from.getTime());
  switch (unit) {
    case 'Hours':
      d.setHours(d.getHours() + n);
      return d;
    case 'Days':
      d.setDate(d.getDate() + n);
      return d;
    case 'Weeks':
      d.setDate(d.getDate() + n * 7);
      return d;
    case 'Months':
      d.setMonth(d.getMonth() + n);
      return d;
    default:
      d.setDate(d.getDate() + n);
      return d;
  }
}

/** Next repeat instant that is >= `from` (exported for alarm-fire scheduling). */
export function nextCanonicalAlarmFire(alarm: AlarmListItem, from: Date): Date | null {
  let t = new Date(alarm.scheduledAt);
  if (Number.isNaN(t.getTime())) {
    return null;
  }
  const horizonEnd = from.getTime() + 730 * 24 * 60 * 60 * 1000;
  let guard = 0;
  while (t.getTime() < from.getTime() && guard++ < 10000 && t.getTime() < horizonEnd) {
    const next = advanceOccurrence(t, alarm.interval, alarm.unit);
    if (next.getTime() <= t.getTime()) {
      return null;
    }
    t = next;
  }
  return t.getTime() <= horizonEnd ? t : null;
}

/** Next reminder time strictly after `from`, before or at alarm fire time. */
function nextReminderSlot(
  alarm: AlarmListItem,
  leadMs: number,
  from: Date,
): { reminderAt: Date; fireAt: Date } | null {
  let fire = nextCanonicalAlarmFire(alarm, from);
  let guard = 0;
  const horizonEnd = from.getTime() + 730 * 24 * 60 * 60 * 1000;
  while (fire && guard++ < 10000 && fire.getTime() <= horizonEnd) {
    const reminderAt = new Date(fire.getTime() - leadMs);
    if (reminderAt.getTime() > from.getTime() + 1500) {
      return { reminderAt, fireAt: fire };
    }
    const next = advanceOccurrence(fire, alarm.interval, alarm.unit);
    if (next.getTime() <= fire.getTime()) {
      break;
    }
    fire = next;
  }
  return null;
}

async function ensureAndroidUpcomingChannel(soundId: AlarmSoundId, vibrationEnabled: boolean): Promise<string> {
  const channelId = `ripple-upcoming-${soundId}-${vibrationEnabled ? 'vib' : 'still'}`;
  const soundFile = bundledNotificationSoundFilename(soundId);
  await setNotificationChannelAsync(channelId, {
    name: 'Upcoming reminders',
    importance: AndroidImportance.HIGH,
    enableVibrate: vibrationEnabled,
    ...(vibrationEnabled ? { vibrationPattern: [...VIBRATION_PATTERN] } : {}),
    sound: soundFile,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  return channelId;
}

/**
 * Reschedules OS local notifications one lead-time **before** each enabled alarm’s next occurrence.
 * Pass `alarms` after a fresh fetch to avoid an extra round-trip.
 */
export async function syncUpcomingReminderNotifications(alarms?: AlarmListItem[]): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelStoredUpcomingNotifications();

  const upcomingEnabled = await loadUpcomingReminderEnabled();
  if (!upcomingEnabled) {
    return;
  }

  const notificationsMasterEnabled = await loadNotificationsMasterEnabled();
  if (!notificationsMasterEnabled) {
    return;
  }

  let rows = alarms;
  if (rows === undefined) {
    const { id: userId, error } = await fetchCurrentUserRowId();
    if (error || userId == null) {
      return;
    }
    try {
      rows = await fetchAlarms(userId);
    } catch {
      return;
    }
  }

  const existing = await getPermissionsAsync();
  if (!isOsNotificationAllowed(existing)) {
    return;
  }

  const leadMinutes = await loadUpcomingReminderLeadMinutes();
  const leadMs = leadMinutes * 60 * 1000;
  const soundId = await loadDefaultAlarmSoundId();
  const vibrationEnabled = await loadDefaultVibrationEnabled();
  const soundFile = bundledNotificationSoundFilename(soundId);

  const androidChannelId =
    Platform.OS === 'android' ? await ensureAndroidUpcomingChannel(soundId, vibrationEnabled) : '';

  const now = new Date();
  const scheduledIds: string[] = [];

  for (const alarm of rows.filter((a) => a.isEnabled)) {
    const slot = nextReminderSlot(alarm, leadMs, now);
    if (!slot) {
      continue;
    }

    const { time, ampm } = formatScheduledLocalParts(slot.fireAt.toISOString());
    const label = alarm.label.trim() || 'Alarm';
    const leadPhrase = formatUpcomingReminderLeadLabel(leadMinutes);

    try {
      const notificationId = await scheduleNotificationAsync({
        identifier: `ripple-upcoming-${alarm.id}-${slot.fireAt.getTime()}`,
        content: {
          title: `Soon · ${label}`,
          body: `Rings at ${time} ${ampm} (${leadPhrase}).`,
          sound: soundFile,
          priority: AndroidNotificationPriority.HIGH,
          data: {
            type: 'ripple-upcoming-reminder',
            alarmId: alarm.id,
            fireAt: slot.fireAt.toISOString(),
          },
          ...(Platform.OS === 'android' && vibrationEnabled ? { vibrate: [...VIBRATION_PATTERN] } : {}),
          ...(Platform.OS === 'android'
            ? {
                android: {
                  channelId: androidChannelId,
                },
              }
            : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: slot.reminderAt,
          ...(Platform.OS === 'android' ? { channelId: androidChannelId } : {}),
        },
      });
      scheduledIds.push(notificationId);
    } catch {
      /* skip single alarm */
    }
  }

  if (scheduledIds.length > 0) {
    await AsyncStorage.setItem(STORAGE_IDS_KEY, JSON.stringify(scheduledIds));
  }
}
