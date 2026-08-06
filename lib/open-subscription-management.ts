import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

import { configureRevenueCat, getRevenueCatApiKey } from '@/lib/revenuecat';

/** Apple’s subscription management page (App Store → Subscriptions). */
const IOS_APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function androidPlaySubscriptionsUrl(): string {
  const packageName =
    Constants.expoConfig?.android?.package?.trim() || 'com.terrykm.ripplealarmapp';
  return `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(packageName)}`;
}

async function openUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the platform store’s subscription management UI for Ripple Pro.
 * Prefers RevenueCat `managementURL`, then native iOS sheet / store deep links —
 * never generic device Settings.
 */
export async function openStoreSubscriptionManagement(
  managementURL?: string | null,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const url = managementURL?.trim();
  if (url) {
    if (await openUrl(url)) {
      return true;
    }
  }

  if (Platform.OS === 'ios') {
    if (getRevenueCatApiKey()) {
      configureRevenueCat();
      try {
        await Purchases.showManageSubscriptions();
        return true;
      } catch {
        /* fall through to App Store subscriptions URL */
      }
    }
    return openUrl(IOS_APP_STORE_SUBSCRIPTIONS_URL);
  }

  if (Platform.OS === 'android') {
    return openUrl(androidPlaySubscriptionsUrl());
  }

  return false;
}
