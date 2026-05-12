import AsyncStorage from '@react-native-async-storage/async-storage';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import {
    AndroidNotificationPriority,
    SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import { Platform } from 'react-native';

import { setAndroidAlarmStyleNotificationChannelAsync } from '@/lib/android-alarm-notification-channel';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import { loadDefaultAlarmSoundId, loadDefaultVibrationEnabled, loadNotificationsMasterEnabled } from '@/lib/settings-preferences';

/**
 * Import only scheduler / permission modules — **not** the `expo-notifications` package root.
 * The root entry pulls in push-token auto-registration, which requires `ExpoPushTokenManager`
 * at startup even when we only use local scheduled notifications.
 */

const PENDING_SNOOZE_NOTIF_KEY = 'ripple_pending_snooze_notification_id';

const SNOOZE_VIBRATION_PATTERN = [0, 400, 200, 400] as const;

/**
 * One Android channel per sound + vibration preference — OS fixes channel settings at creation time.
 */
async function ensureAndroidSnoozeChannelForAlarmPrefs(
  soundId: AlarmSoundId,
  vibrationEnabled: boolean,
): Promise<string> {
  const channelId = `ripple_snooze_a1_${soundId}_${vibrationEnabled ? 'vib' : 'still'}`;
  const soundFile = bundledNotificationSoundFilename(soundId);
  await setAndroidAlarmStyleNotificationChannelAsync(channelId, {
    name: 'Alarm snooze',
    sound: soundFile,
    enableVibrate: vibrationEnabled,
    vibrationPattern: SNOOZE_VIBRATION_PATTERN,
  });
  return channelId;
}

async function cancelStoredSnoozeSchedule(): Promise<void> {
  const id = await AsyncStorage.getItem(PENDING_SNOOZE_NOTIF_KEY);
  if (!id) {
    return;
  }
  await cancelScheduledNotificationAsync(id).catch(() => undefined);
  await AsyncStorage.removeItem(PENDING_SNOOZE_NOTIF_KEY);
}

/** Cancels the pending snooze notification tracked in AsyncStorage (if any). */
export async function cancelPendingSnoozeNotification(): Promise<void> {
  await cancelStoredSnoozeSchedule();
}

export type ScheduleSnoozeResult =
  | { ok: true; notificationId: string }
  | {
      ok: false;
      reason: 'web' | 'permission_denied' | 'schedule_failed' | 'notifications_disabled';
      message: string;
    };

/**
 * Schedules a **device-level** local notification at `now + minutes`, using the OS scheduler
 * (e.g. AlarmManager-backed delivery on Android, UNNotificationCenter on iOS).
 * Cancels any previously scheduled snooze from this app session/storage slot first.
 */
export async function scheduleSnoozeNotification(params: {
  minutes: number;
  alarmTitle?: string;
}): Promise<ScheduleSnoozeResult> {
  const { minutes, alarmTitle } = params;

  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'web',
      message: 'Snooze uses native notifications. Build the iOS/Android app to enable it.',
    };
  }

  const masterEnabled = await loadNotificationsMasterEnabled();
  if (!masterEnabled) {
    return {
      ok: false,
      reason: 'notifications_disabled',
      message: 'Turn on Notifications in Settings to snooze.',
    };
  }

  const seconds = Math.max(1, Math.round(minutes * 60));

  const soundId = await loadDefaultAlarmSoundId();
  const soundFile = bundledNotificationSoundFilename(soundId);
  const vibrationEnabled = await loadDefaultVibrationEnabled();

  const existing = await getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain !== false) {
    const requested = await requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    return {
      ok: false,
      reason: 'permission_denied',
      message: 'Allow notifications so the alarm can ring again after snooze.',
    };
  }

  await cancelStoredSnoozeSchedule();

  const androidChannelId =
    Platform.OS === 'android'
      ? await ensureAndroidSnoozeChannelForAlarmPrefs(soundId, vibrationEnabled)
      : '';

  try {
    const titleBase = alarmTitle?.trim() ? alarmTitle.trim() : 'Alarm';
    const notificationId = await scheduleNotificationAsync({
      content: {
        title: `Snooze · ${titleBase}`,
        body: `Scheduled for ${minutes} minute${minutes === 1 ? '' : 's'} from now`,
        sound: soundFile,
        priority: AndroidNotificationPriority.MAX,
        data: { type: 'ripple-snooze', soundId, vibrationEnabled },
        ...(Platform.OS === 'android' && vibrationEnabled
          ? { vibrate: [...SNOOZE_VIBRATION_PATTERN] }
          : {}),
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
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        ...(Platform.OS === 'android' ? { channelId: androidChannelId } : {}),
      },
    });

    await AsyncStorage.setItem(PENDING_SNOOZE_NOTIF_KEY, notificationId);
    return { ok: true, notificationId };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not schedule snooze.';
    return { ok: false, reason: 'schedule_failed', message };
  }
}
