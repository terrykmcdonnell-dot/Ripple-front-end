import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';

const FSI_PROMPT_DISMISSED_KEY = 'ripple_android_fsi_prompt_dismissed_v1';

/**
 * Android 14+ blocks full-screen intents unless the user allows them for this app.
 * Call after scheduling alarms; opens system settings once if not yet dismissed.
 */
export async function promptAndroidFullScreenAlarmPermissionIfNeeded(
  showToast: (message: string) => void,
): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 34) {
    return;
  }
  const dismissed = await AsyncStorage.getItem(FSI_PROMPT_DISMISSED_KEY);
  if (dismissed === '1') {
    return;
  }
  showToast('Allow full-screen alarms for Ripple (Lock screen alarm takeover in Settings).');
  await openAndroidFullScreenAlarmPermissionSettings();
  await AsyncStorage.setItem(FSI_PROMPT_DISMISSED_KEY, '1');
}
