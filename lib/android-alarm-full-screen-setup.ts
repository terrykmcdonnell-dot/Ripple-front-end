import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { isAndroidFullScreenIntentGranted } from '@/lib/android-full-screen-intent-granted';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';

const FSI_PROMPT_LAST_SHOWN_KEY = 'ripple_android_fsi_prompt_last_shown_v2';
/** Silence the alarm-sync prompt for 7 days after the user explicitly visits the page. */
const FSI_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Reset key shared with AndroidFsiPermissionBootstrap so the startup warning is silenced too. */
const FSI_WARN_KEY = 'ripple_fsi_warn_last_v1';
const FSI_WARN_SILENCE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days after visiting settings

/**
 * Android 14+: opens full-screen intent settings after scheduling alarms.
 * The startup toast (AndroidFsiPermissionBootstrap) nudges proactively; this opens
 * the system page directly when triggered from the Settings screen row.
 */
export async function promptAndroidFullScreenAlarmPermissionIfNeeded(
  showToast: (message: string) => void,
): Promise<void> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 34) {
    return;
  }
  if (await isAndroidFullScreenIntentGranted()) {
    return;
  }
  const now = Date.now();
  const lastShown = Number(await AsyncStorage.getItem(FSI_PROMPT_LAST_SHOWN_KEY));
  if (Number.isFinite(lastShown) && now - lastShown < FSI_PROMPT_COOLDOWN_MS) {
    return;
  }
  showToast('Opening full-screen alarm settings — allow Ripple to show alarms over the lock screen.');
  await openAndroidFullScreenAlarmPermissionSettings();
  await AsyncStorage.setItem(FSI_PROMPT_LAST_SHOWN_KEY, String(now));
  // Silence the startup warning for 30 days since user just visited the settings page.
  await AsyncStorage.setItem(FSI_WARN_KEY, String(now + FSI_WARN_SILENCE_MS - FSI_PROMPT_COOLDOWN_MS));
}
