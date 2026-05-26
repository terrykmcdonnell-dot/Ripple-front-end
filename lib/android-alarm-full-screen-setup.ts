import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';

const FSI_PROMPT_LAST_SHOWN_KEY = 'ripple_android_fsi_prompt_last_shown_v2';
const FSI_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Android 14+ blocks full-screen intents unless the user allows them for this app.
 * Call after scheduling alarms; reopen the system page occasionally because React Native
 * cannot reliably read this permission on every Expo/Android combination.
 */
export async function promptAndroidFullScreenAlarmPermissionIfNeeded(
  showToast: (message: string) => void,
): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 34) {
    return;
  }
  const now = Date.now();
  const lastShown = Number(await AsyncStorage.getItem(FSI_PROMPT_LAST_SHOWN_KEY));
  if (Number.isFinite(lastShown) && now - lastShown < FSI_PROMPT_COOLDOWN_MS) {
    return;
  }
  showToast('Allow full-screen alarms for Ripple (Lock screen alarm takeover in Settings).');
  await openAndroidFullScreenAlarmPermissionSettings();
  await AsyncStorage.setItem(FSI_PROMPT_LAST_SHOWN_KEY, String(now));
}
