import { Linking } from 'react-native';

/** Privacy policy URL shown in Settings → About. */
export function getPrivacyPolicyUrl(): string {
  return process.env.EXPO_PUBLIC_RIPPLE_PRIVACY_POLICY_URL?.trim() ?? '';
}

/** Terms URL shown in Settings → About. */
export function getTermsOfServiceUrl(): string {
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
