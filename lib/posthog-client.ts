import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import { Platform } from 'react-native';

/** Distinguishes Ripple events from Vault in the shared PostHog project. */
export const RIPPLE_POSTHOG_APP_NAME = 'ripple';

export const POSTHOG_EVENTS = {
  paywallViewed: 'paywall_viewed',
  paywallDismissed: 'paywall_dismissed',
  alarmCreated: 'alarm_created',
  onboardingCompleted: 'onboarding_completed',
  androidExactAlarmStatus: 'android_exact_alarm_status',
} as const;

/** Person property key for Android exact-alarm permission state. */
export const POSTHOG_ANDROID_EXACT_ALARM_PROPERTY = 'android_exact_alarm';

function getPostHogApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || undefined;
}

function getPostHogHost(): string {
  return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
}

export function isPostHogConfigured(): boolean {
  return Platform.OS !== 'web' && !!getPostHogApiKey();
}

export function createPostHogClient(): PostHog | null {
  const apiKey = getPostHogApiKey();
  if (!apiKey || Platform.OS === 'web') {
    return null;
  }

  return new PostHog(apiKey, {
    host: getPostHogHost(),
    customStorage: {
      getItem: async (key) => AsyncStorage.getItem(key),
      setItem: async (key, value) => AsyncStorage.setItem(key, value),
    },
    captureAppLifecycleEvents: false,
    captureDeepLinks: false,
  });
}

let sharedClient: PostHog | null = null;

export function getSharedPostHogClient(): PostHog | null {
  return sharedClient;
}

export function setSharedPostHogClient(client: PostHog | null): void {
  sharedClient = client;
}
