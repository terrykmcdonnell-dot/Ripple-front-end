import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  getAndroidExactAlarmStatus,
  type AndroidExactAlarmStatus,
} from '@/lib/android-exact-alarm-granted';
import {
  getSharedPostHogClient,
  isPostHogConfigured,
  POSTHOG_ANDROID_EXACT_ALARM_PROPERTY,
  POSTHOG_EVENTS,
  RIPPLE_POSTHOG_APP_NAME,
} from '@/lib/posthog-client';

const ONBOARDING_SENT_KEY = 'ripple_posthog_onboarding_completed_sent';
const ANDROID_EXACT_ALARM_LAST_KEY = 'ripple_posthog_android_exact_alarm_last_v1';

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

/** Sets PostHog person property for Android exact-alarm permission; fires event when status changes. */
export async function syncPostHogAndroidExactAlarmStatus(): Promise<void> {
  if (!isPostHogConfigured() || Platform.OS !== 'android') {
    return;
  }

  const status = await getAndroidExactAlarmStatus();
  const client = getSharedPostHogClient();
  if (!client) {
    return;
  }

  const lastStatus = (await AsyncStorage.getItem(ANDROID_EXACT_ALARM_LAST_KEY)) as AndroidExactAlarmStatus | null;

  client.capture('$set', {
    ...rippleEventProperties(),
    $set: {
      [POSTHOG_ANDROID_EXACT_ALARM_PROPERTY]: status,
    },
  });

  if (lastStatus !== status) {
    captureRippleEvent(POSTHOG_EVENTS.androidExactAlarmStatus, {
      status,
      previous_status: lastStatus ?? null,
    });
    await AsyncStorage.setItem(ANDROID_EXACT_ALARM_LAST_KEY, status);
  }
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
