import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type AndroidNotificationPermissionsModule = {
  canAccessNotificationPolicyAsync?: () => Promise<boolean>;
};

/** Whether Ripple is allowed in Android Do Not Disturb / Modes access. */
export async function isAndroidNotificationPolicyAccessGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const mod =
      requireOptionalNativeModule<AndroidNotificationPermissionsModule>('ExpoNotificationPermissionsModule');
    if (mod?.canAccessNotificationPolicyAsync) {
      return await mod.canAccessNotificationPolicyAsync();
    }
  } catch {
    /* fall through */
  }
  return true;
}
