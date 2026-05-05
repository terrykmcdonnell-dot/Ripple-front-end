import { Platform } from 'react-native';
import { setVolume } from 'react-native-volume-manager';

/**
 * Applies the user's alarm volume preference to OS-level controls when they
 * explicitly choose a level in Settings — not on app cold start.
 *
 * Android: notification stream (matches typical notification-channel alarm playback).
 * iOS: uses MPVolumeView under the hood — affects system/output volume (no separate
 * notification-only slider like Android).
 */
export async function applyAlarmVolumePreferenceToDevice(percent: number): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  const value = Math.max(0, Math.min(1, Math.round(percent) / 100));
  try {
    if (Platform.OS === 'android') {
      await setVolume(value, {
        type: 'notification',
        playSound: false,
        showUI: false,
      });
    } else {
      await setVolume(value, {
        playSound: false,
        showUI: false,
      });
    }
    return true;
  } catch {
    return false;
  }
}
