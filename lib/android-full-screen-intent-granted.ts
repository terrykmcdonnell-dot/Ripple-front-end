import { PermissionsAndroid, Platform } from 'react-native';

/** Android 14+: whether the user allowed full-screen intents for this app in system settings. */
export async function isAndroidFullScreenIntentGranted(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 34) {
    return true;
  }
  try {
    return await PermissionsAndroid.check(
      'android.permission.USE_FULL_SCREEN_INTENT' as Parameters<typeof PermissionsAndroid.check>[0],
    );
  } catch {
    return false;
  }
}
