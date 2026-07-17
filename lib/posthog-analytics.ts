import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getSharedPostHogClient,
  isPostHogConfigured,
  POSTHOG_EVENTS,
  RIPPLE_POSTHOG_APP_NAME,
} from '@/lib/posthog-client';

const ONBOARDING_SENT_KEY = 'ripple_posthog_onboarding_completed_sent';

function rippleEventProperties(extra?: Record<string, unknown>): Record<string, unknown> {
  return { app_name: RIPPLE_POSTHOG_APP_NAME, ...extra };
}

export function captureRippleEvent(event: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured()) {
    return;
  }
  const client = getSharedPostHogClient();
  client?.capture(event, rippleEventProperties(properties));
}

export function captureAlarmCreated(): void {
  captureRippleEvent(POSTHOG_EVENTS.alarmCreated);
}

export function capturePaywallViewed(): void {
  captureRippleEvent(POSTHOG_EVENTS.paywallViewed, { trigger: 'alarm_limit' });
}

export function capturePaywallDismissed(): void {
  captureRippleEvent(POSTHOG_EVENTS.paywallDismissed, { trigger: 'alarm_limit' });
}

/** Fires once per install when initial account setup completes. */
export async function captureOnboardingCompletedOnce(): Promise<void> {
  if (!isPostHogConfigured()) {
    return;
  }
  const sent = await AsyncStorage.getItem(ONBOARDING_SENT_KEY);
  if (sent) {
    return;
  }
  const client = getSharedPostHogClient();
  if (!client) {
    return;
  }
  client.capture(POSTHOG_EVENTS.onboardingCompleted, rippleEventProperties());
  await AsyncStorage.setItem(ONBOARDING_SENT_KEY, '1');
}
