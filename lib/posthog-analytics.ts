import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostHogEventProperties } from '@posthog/core';
import { Platform } from 'react-native';

import { getAndroidExactAlarmStatus, type AndroidExactAlarmStatus } from '@/lib/android-exact-alarm-granted';
import {
  getSharedPostHogClient,
  isPostHogConfigured,
  POSTHOG_ANDROID_EXACT_ALARM_PROPERTY,
  POSTHOG_EVENTS,
  RIPPLE_POSTHOG_APP_NAME,
} from '@/lib/posthog-client';

const ONBOARDING_SENT_KEY = 'ripple_posthog_onboarding_completed_sent';
const ANDROID_EXACT_ALARM_LAST_KEY = 'ripple_posthog_android_exact_alarm_last_v1';

function rippleEventProperties(extra?: PostHogEventProperties): PostHogEventProperties {
  return { app_name: RIPPLE_POSTHOG_APP_NAME, ...extra };
}

export function captureRippleEvent(event: string, properties?: PostHogEventProperties): void {
  if (!isPostHogConfigured()) {
    return;
  }
  const client = getSharedPostHogClient();
  client?.capture(event, rippleEventProperties(properties));
}

/**
 * Backoff schedule (ms) for {@link captureRippleEventReliable}. Covers the window right after
 * cold start where `PostHogProviderShell` may not have mounted the shared client yet, without
 * blocking the caller for long if PostHog is genuinely unavailable.
 */
const CAPTURE_RETRY_DELAYS_MS = [0, 300, 900, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fires a PostHog event, retrying while the shared client hasn't mounted yet instead of the
 * one-shot `client?.capture(...)` silently no-oping (see RIPPLE-ALARM paywall_viewed gaps).
 * Callers stay fire-and-forget (`void captureRippleEventReliable(...)`); this resolves once it
 * either captures or exhausts the retry window (~7s total).
 */
export async function captureRippleEventReliable(
  event: string,
  properties?: PostHogEventProperties,
): Promise<boolean> {
  if (!isPostHogConfigured()) {
    return false;
  }
  for (let attempt = 0; attempt < CAPTURE_RETRY_DELAYS_MS.length; attempt++) {
    const delay = CAPTURE_RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await sleep(delay);
    }
    const client = getSharedPostHogClient();
    if (client) {
      client.capture(event, rippleEventProperties(properties));
      return true;
    }
  }
  return false;
}

export function captureAlarmCreated(): void {
  void captureRippleEventReliable(POSTHOG_EVENTS.alarmCreated);
}

export type PaywallLimitTrigger = 'alarm_limit' | 'ring_limit';

export function capturePaywallViewed(trigger: PaywallLimitTrigger = 'alarm_limit'): void {
  void captureRippleEventReliable(POSTHOG_EVENTS.paywallViewed, { trigger });
}

export function capturePaywallDismissed(trigger: PaywallLimitTrigger = 'alarm_limit'): void {
  void captureRippleEventReliable(POSTHOG_EVENTS.paywallDismissed, { trigger });
}

/**
 * Fired the instant the free-tier alarm cap blocks a save/create attempt — before the paywall
 * navigation and, on the local-cache fast path, before any network call. Pairs with
 * `paywall_viewed` for a clean "limit reached → paywall opened → purchase" funnel.
 */
export function captureAlarmLimitReached(source: 'alarm_list' | 'alarm_create'): void {
  void captureRippleEventReliable(POSTHOG_EVENTS.alarmLimitReached, {
    trigger: 'alarm_limit',
    source,
  });
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

  client.setPersonProperties(
    {
      app_name: RIPPLE_POSTHOG_APP_NAME,
      [POSTHOG_ANDROID_EXACT_ALARM_PROPERTY]: status,
    },
    undefined,
    false,
  );

  const lastStatus = (await AsyncStorage.getItem(ANDROID_EXACT_ALARM_LAST_KEY)) as AndroidExactAlarmStatus | null;
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
