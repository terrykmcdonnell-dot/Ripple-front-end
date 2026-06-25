import { Linking, Platform } from 'react-native';

/** Privacy policy URL — App Store env on iOS, Google/default env on Android. */
export function getPrivacyPolicyUrl(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RIPPLE_APP_STORE_PRIVACY_POLICY_URL?.trim() ?? '';
  }
  return process.env.EXPO_PUBLIC_RIPPLE_PRIVACY_POLICY_URL?.trim() ?? '';
}

/** Terms URL — App Store env on iOS, Google/default env on Android. */
export function getTermsOfServiceUrl(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RIPPLE_APP_STORE_TERMS_OF_SERVICE_URL?.trim() ?? '';
  }
  return process.env.EXPO_PUBLIC_RIPPLE_TERMS_OF_SERVICE_URL?.trim() ?? '';
}

/** About rows — icon tile tint (legal links) */
export const SETTINGS_ABOUT_ICON_BLUE = '#2563eb';

export async function openConfiguredUrl(url: string | undefined, onFallback: () => void): Promise<void> {
  const u = url?.trim();
  if (!u) {
    onFallback();
    return;
  }
  try {
    await Linking.openURL(u);
  } catch {
    onFallback();
  }
}
