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
import { formatScheduledLocalParts } from '@/lib/alarm-format';
import {
  ALARM_FIRE_CATEGORY_ID,
  ALARM_FIRE_DATA_TYPE,
} from '@/lib/alarm-notification-constants';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import {
  loadDefaultAlarmSoundId,
  loadDefaultVibrationEnabled,
  loadNotificationsMasterEnabled,
} from '@/lib/settings-preferences';
import {
  alignAlarmNotificationTriggerDate,
  MIN_ALARM_SCHEDULE_LEAD_MS,
} from '@/lib/alarm-notification-trigger';
import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { nextCanonicalAlarmFire } from '@/lib/upcoming-reminder-scheduler';
import { fetchCurrentUserRowId } from '@/lib/users-table';

const STORAGE_IDS_KEY = 'ripple_alarm_fire_scheduled_notification_ids';

const FIRE_VIBRATION_PATTERN = [0, 450, 250, 450] as const;

async function cancelStoredAlarmFireNotifications(): Promise<void> {
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

export async function cancelAlarmFireNotifications(): Promise<void> {
  await cancelStoredAlarmFireNotifications();
}

async function ensureAndroidAlarmFireChannel(soundId: AlarmSoundId, vibrationEnabled: boolean): Promise<string> {
  const channelId = `ripple_alarm_fire_${soundId}_${vibrationEnabled ? 'vib' : 'still'}`;
  const soundFile = bundledNotificationSoundFilename(soundId);
  await setNotificationChannelAsync(channelId, {
    name: 'Alarm alerts',
    importance: AndroidImportance.MAX,
    enableVibrate: vibrationEnabled,
    ...(vibrationEnabled ? { vibrationPattern: [...FIRE_VIBRATION_PATTERN] } : {}),
    sound: soundFile,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  return channelId;
}

/**
 * Schedules the **next** occurrence per enabled alarm via the OS (AlarmManager / UNUserNotificationCenter).
 * No JS background loop — the system wakes the device at the requested time.
 */
export async function syncAlarmFireNotifications(alarms?: AlarmListItem[]): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelStoredAlarmFireNotifications();

  const notificationsMasterEnabled = await loadNotificationsMasterEnabled();
  if (!notificationsMasterEnabled) {
    return;
  }

  let rows = alarms;
  let schedulingUserId: number | null = null;

  if (rows === undefined) {
    const { id: userId, error } = await fetchCurrentUserRowId();
    if (error || userId == null) {
      return;
    }
    schedulingUserId = userId;
    try {
      rows = await fetchAlarms(userId);
    } catch {
      return;
    }
  } else {
    const { id: userId, error } = await fetchCurrentUserRowId();
    if (!error && userId != null) {
      schedulingUserId = userId;
    }
  }

  const existing = await getPermissionsAsync();
  if (!isOsNotificationAllowed(existing)) {
    return;
  }

  const soundId = await loadDefaultAlarmSoundId();
  const vibrationEnabled = await loadDefaultVibrationEnabled();
  const soundFile = bundledNotificationSoundFilename(soundId);

  const androidChannelId =
    Platform.OS === 'android' ? await ensureAndroidAlarmFireChannel(soundId, vibrationEnabled) : '';

  const now = new Date();
  const scheduledIds: string[] = [];

  for (const alarm of rows.filter((a) => a.isEnabled)) {
    const fireAtRaw = nextCanonicalAlarmFire(alarm, now);
    if (!fireAtRaw || fireAtRaw.getTime() <= now.getTime() + MIN_ALARM_SCHEDULE_LEAD_MS) {
      continue;
    }
    const fireAt = alignAlarmNotificationTriggerDate(fireAtRaw);
    if (fireAt.getTime() <= now.getTime() + MIN_ALARM_SCHEDULE_LEAD_MS) {
      continue;
    }

    const { time, ampm } = formatScheduledLocalParts(fireAt.toISOString());
    const label = alarm.label.trim() || 'Alarm';

    try {
      const notificationId = await scheduleNotificationAsync({
        identifier: `ripple_alarm_fire_${alarm.id}_${fireAt.getTime()}`,
        content: {
          title: `Alarm · ${label}`,
          body: `Ringing · ${time} ${ampm}`,
          sound: soundFile,
          priority: AndroidNotificationPriority.MAX,
          categoryIdentifier: ALARM_FIRE_CATEGORY_ID,
          ...(Platform.OS === 'android'
            ? {
                sticky: true,
                autoDismiss: false,
              }
            : {}),
          data: {
            type: ALARM_FIRE_DATA_TYPE,
            alarmId: alarm.id,
            fireAt: fireAt.toISOString(),
            label,
            category: alarm.category,
            ...(schedulingUserId != null ? { userId: schedulingUserId } : {}),
          },
          ...(Platform.OS === 'android' && vibrationEnabled ? { vibrate: [...FIRE_VIBRATION_PATTERN] } : {}),
          ...(Platform.OS === 'android'
            ? {
                android: {
                  channelId: androidChannelId,
                },
              }
            : {}),
          ...(Platform.OS === 'ios'
            ? {
                interruptionLevel: 'timeSensitive' as const,
              }
            : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: fireAt,
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
