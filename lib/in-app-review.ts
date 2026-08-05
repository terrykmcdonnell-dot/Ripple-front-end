import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { InteractionManager, Platform } from 'react-native';

const APP_OPEN_COUNT_KEY = 'ripple_in_app_review_app_open_count_v1';
const ALARM_DISMISS_COUNT_KEY = 'ripple_in_app_review_alarm_dismiss_count_v1';

/** Successful alarm dismissals before requesting a native store review. */
const DISMISS_THRESHOLD = 3;

const NATIVE_REVIEW_ENABLED_ON_ANDROID = true;

let suppressAfterMissedAlarm = false;
let reviewRequestInFlight = false;

function isReviewPlatformEnabled(): boolean {
  if (Platform.OS === 'ios') {
    return true;
  }
  if (Platform.OS === 'android') {
    return NATIVE_REVIEW_ENABLED_ON_ANDROID;
  }
  return false;
}

async function readCount(key: string): Promise<number> {
  const raw = await AsyncStorage.getItem(key);
  const parsed = raw != null ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function writeCount(key: string, value: number): Promise<void> {
  await AsyncStorage.setItem(key, String(value));
}

/** Tracks app opens so the review prompt never appears on first install open. */
export async function markInAppReviewAppOpened(): Promise<void> {
  if (!isReviewPlatformEnabled()) {
    return;
  }
  const count = await readCount(APP_OPEN_COUNT_KEY);
  await writeCount(APP_OPEN_COUNT_KEY, count + 1);
}

async function hasCompletedFirstLaunch(): Promise<boolean> {
  const openCount = await readCount(APP_OPEN_COUNT_KEY);
  return openCount >= 2;
}

/** Block review prompts for the rest of this app session after a missed alarm. */
export function suppressInAppReviewAfterMissedAlarm(): void {
  suppressAfterMissedAlarm = true;
}

/** Clears the missed-alarm block when the user returns after backgrounding the app. */
export function clearInAppReviewMissedAlarmSuppressOnForeground(): void {
  suppressAfterMissedAlarm = false;
}

async function canRequestNativeStoreReviewNow(): Promise<boolean> {
  if (!isReviewPlatformEnabled()) {
    return false;
  }
  if (suppressAfterMissedAlarm) {
    return false;
  }
  if (!(await hasCompletedFirstLaunch())) {
    return false;
  }
  return true;
}

async function requestNativeStoreReview(): Promise<void> {
  if (reviewRequestInFlight) {
    return;
  }
  if (!(await canRequestNativeStoreReviewNow())) {
    return;
  }

  reviewRequestInFlight = true;
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      return;
    }
    await StoreReview.requestReview();
  } catch {
    /* Store unavailable (e.g. Android without Play Store). */
  } finally {
    reviewRequestInFlight = false;
  }
}

async function maybeRequestNativeStoreReviewAfterDismiss(): Promise<void> {
  const dismissCount = await readCount(ALARM_DISMISS_COUNT_KEY);
  if (dismissCount < DISMISS_THRESHOLD) {
    return;
  }
  if (!(await canRequestNativeStoreReviewNow())) {
    return;
  }

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await requestNativeStoreReview();
}

/**
 * After the user successfully dismisses a ringing alarm, count toward the native
 * store review trigger. On the third dismissal, request Apple's / Google's in-app review UI.
 * OS-level throttling (e.g. three prompts per year on iOS) is handled by the platform.
 */
export async function recordSuccessfulAlarmDismiss(): Promise<void> {
  if (!isReviewPlatformEnabled()) {
    return;
  }

  const previous = await readCount(ALARM_DISMISS_COUNT_KEY);
  const next = previous + 1;
  await writeCount(ALARM_DISMISS_COUNT_KEY, next);

  await maybeRequestNativeStoreReviewAfterDismiss();
}
