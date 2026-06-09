import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type FsiPermissionModule = {
  canUseFullScreenIntentAsync?: () => Promise<boolean>;
};

/**
 * Android 14+: whether the user allowed full-screen intents for this app.
 * Uses NotificationManager.canUseFullScreenIntent() when available (accurate on Android 14+).
 */
export async function isAndroidFullScreenIntentGranted(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 34) {
    return true;
  }
  try {
    const mod = requireOptionalNativeModule<FsiPermissionModule>('ExpoNotificationPermissionsModule');
    if (mod?.canUseFullScreenIntentAsync) {
      return await mod.canUseFullScreenIntentAsync();
    }
  } catch {
    /* fall through */
  }
  return true;
}
