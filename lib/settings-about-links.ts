import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

/** Marketing site URL: set `EXPO_PUBLIC_RIPPLE_MARKETING_WEBSITE_URL` in `.env` (required at runtime for Settings → Ripple website). */
export function getMarketingWebsiteUrl(): string {
  return process.env.EXPO_PUBLIC_RIPPLE_MARKETING_WEBSITE_URL?.trim() ?? '';
}

/** About rows — icon tile tint (e.g. website link) */
export const SETTINGS_ABOUT_ICON_BLUE = '#2563eb';
/** Rate / social — icon tile tint */
export const SETTINGS_ABOUT_ICON_AMBER = '#d97706';

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

/** Opens Play / App Store review flow when IDs are available. */
export function openStoreReviewFlow(showToast: (message: string) => void): void {
  const pkg = Constants.expoConfig?.android?.package?.trim();
  const iosId = process.env.EXPO_PUBLIC_APP_STORE_ID?.trim();

  if (Platform.OS === 'android') {
    if (!pkg) {
      showToast('Missing Android package id in app config.');
      return;
    }
    const market = `market://details?id=${encodeURIComponent(pkg)}`;
    const https = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
    void Linking.openURL(market).catch(() => {
      void Linking.openURL(https).catch(() => showToast('Could not open Play Store.'));
    });
    return;
  }

  if (Platform.OS === 'ios') {
    if (!iosId) {
      showToast('Set EXPO_PUBLIC_APP_STORE_ID in .env to open App Store reviews.');
      return;
    }
    void Linking.openURL(`https://apps.apple.com/app/id${iosId}?action=write-review`).catch(() =>
      showToast('Could not open App Store.'),
    );
    return;
  }

  showToast('Reviews are available in the mobile app.');
}
