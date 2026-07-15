import AsyncStorage from '@react-native-async-storage/async-storage';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import {
    AndroidNotificationPriority,
    SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import { Platform } from 'react-native';

import { cancelNativeSnoozeAlarm } from '@/lib/android-alarm-native-prefs';
import { setAndroidAlarmStyleNotificationChannelAsync } from '@/lib/android-alarm-notification-channel';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { ALARM_FIRE_CATEGORY_ID, ALARM_FIRE_DATA_TYPE } from '@/lib/alarm-notification-constants';
import { getIosAlarmInterruptionLevel } from '@/lib/ios-alarm-notification-options';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import { loadDefaultAlarmSoundId, loadDefaultVibrationEnabled, loadNotificationsMasterEnabled } from '@/lib/settings-preferences';
import { fetchIsSubscriberFresh } from '@/lib/subscription-access';
import { resolveAlarmSoundForUser } from '@/lib/alarm-sound-access';

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

/** Cancels expo-scheduled and native AlarmManager snoozes (if any). */
export async function cancelPendingSnoozeNotification(): Promise<void> {
  await cancelStoredSnoozeSchedule();
  cancelNativeSnoozeAlarm();
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
 *
 * Pass `alarmData` (the `ParsedAlarmFireData` of the original alarm) so the snooze
 * notification is handled identically to an alarm-fire notification: tapping it opens
 * the ring screen, history is recorded correctly, and the Dismiss/Snooze action buttons
 * appear on lock screen.
 */
export async function scheduleSnoozeNotification(params: {
  minutes: number;
  alarmTitle?: string;
  alarmData?: ParsedAlarmFireData;
}): Promise<ScheduleSnoozeResult> {
  const { minutes, alarmTitle, alarmData } = params;

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

  const rawSoundId = await loadDefaultAlarmSoundId();
  const isSubscriber = await fetchIsSubscriberFresh();
  const soundId = resolveAlarmSoundForUser(rawSoundId, isSubscriber);
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

  const snoozeFireAt = new Date(Date.now() + seconds * 1000).toISOString();
  const titleBase = alarmTitle?.trim() ?? alarmData?.label?.trim() ?? 'Alarm';

  // Build the notification data payload. When alarmData is provided we embed the full
  // alarm-fire fields so the snooze notification is handled by the same listeners that
  // handle regular alarm-fire notifications (ring screen opens, history recorded, etc.).
  const notificationData: Record<string, unknown> = alarmData
    ? {
        type: ALARM_FIRE_DATA_TYPE,
        alarmId: alarmData.alarmId,
        fireAt: snoozeFireAt,
        label: alarmData.label,
        category: alarmData.category,
        ...(alarmData.soundId ? { soundId: alarmData.soundId } : { soundId }),
        ...(alarmData.userId != null ? { userId: alarmData.userId } : {}),
      }
    : { type: 'ripple-snooze', soundId, vibrationEnabled };

  try {
    const notificationId = await scheduleNotificationAsync({
      content: {
        title: `Snooze · ${titleBase}`,
        body: `Scheduled for ${minutes} minute${minutes === 1 ? '' : 's'} from now`,
        sound: soundFile,
        priority: AndroidNotificationPriority.MAX,
        categoryIdentifier: alarmData ? ALARM_FIRE_CATEGORY_ID : undefined,
        data: notificationData,
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
              interruptionLevel: getIosAlarmInterruptionLevel(),
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
