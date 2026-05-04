import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const EXPO_PUSH_TOKEN_STORAGE_KEY = 'ripple_expo_push_token';

export async function getStoredExpoPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EXPO_PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Requests notification permission (when needed), obtains an Expo push token (via Expo’s push service),
 * and persists it for later sync to your backend.
 *
 * Android: requires `google-services.json` + FCM credentials uploaded for this Expo project (EAS / expo.dev).
 * iOS: requires an APNs key uploaded for this Expo project; use a dev/build with push capability (not Expo Go).
 */
export async function registerAndPersistExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) {
      console.warn('[Push] Missing EAS projectId — set expo.extra.eas.projectId in app.json.');
    }
    return null;
  }

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_STORAGE_KEY, push.data);
    return push.data;
  } catch (e) {
    if (__DEV__) {
      console.warn('[Push] getExpoPushTokenAsync failed:', e);
    }
    return null;
  }
}
