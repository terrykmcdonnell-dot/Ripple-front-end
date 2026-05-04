import { Platform } from 'react-native';
import { VolumeManager } from 'react-native-volume-manager';

/**
 * Applies Settings → Volume to **system** playback loudness for alarm/snooze notifications.
 *
 * - **Android**: adjusts `STREAM_NOTIFICATION` (matches expo-notifications channel playback).
 * - **iOS**: adjusts device volume via VolumeManager (notification alert loudness follows user/session behavior).
 *
 * No-op on web and safe no-op if native module unavailable (Expo Go).
 */
/** @returns Whether the volume was applied (or web no-op). */
export async function syncPersistedAlarmVolumeToSystem(percent: number): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  const value = Math.max(0, Math.min(1, Math.max(0, Math.min(100, Math.round(percent))) / 100));

  try {
    if (Platform.OS === 'android') {
      await VolumeManager.setVolume(value, {
        type: 'notification',
        playSound: false,
        showUI: false,
      });
      return true;
    }
    await VolumeManager.setVolume(value, {
      playSound: false,
      showUI: false,
    });
    return true;
  } catch {
    return false;
  }
}
