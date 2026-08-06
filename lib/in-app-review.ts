import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { InteractionManager, Platform } from 'react-native';

const APP_OPEN_COUNT_KEY = 'ripple_in_app_review_app_open_count_v1';
const ALARM_DISMISS_COUNT_KEY = 'ripple_in_app_review_alarm_dismiss_count_v1';
const PENDING_NATIVE_REVIEW_KEY = 'ripple_in_app_review_pending_native_v1';

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

async function readReviewCounts(): Promise<{
  appOpens: number;
  dismissals: number;
  pending: boolean;
}> {
  const pairs = await AsyncStorage.multiGet([
    APP_OPEN_COUNT_KEY,
    ALARM_DISMISS_COUNT_KEY,
    PENDING_NATIVE_REVIEW_KEY,
  ]);
  const map = new Map(pairs);
  const parseCount = (raw: string | null | undefined) => {
    const parsed = raw != null ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  return {
    appOpens: parseCount(map.get(APP_OPEN_COUNT_KEY)),
    dismissals: parseCount(map.get(ALARM_DISMISS_COUNT_KEY)),
    pending: map.get(PENDING_NATIVE_REVIEW_KEY) === '1',
  };
}

async function writeCount(key: string, value: number): Promise<void> {
  await AsyncStorage.setItem(key, String(value));
}

async function markPendingNativeStoreReview(): Promise<void> {
  await AsyncStorage.setItem(PENDING_NATIVE_REVIEW_KEY, '1');
}

async function clearPendingNativeStoreReview(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_NATIVE_REVIEW_KEY);
}

async function hasPendingNativeStoreReview(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PENDING_NATIVE_REVIEW_KEY);
  return raw === '1';
}

/** Tracks a cold-start app open for the first-launch guard on native store review prompts. */
export async function markInAppReviewAppOpened(): Promise<void> {
  if (!isReviewPlatformEnabled()) {
    return;
  }
  const count = await readCount(APP_OPEN_COUNT_KEY);
  await writeCount(APP_OPEN_COUNT_KEY, count + 1);
}

/** After returning from background: clear suppress flag and try a queued review (deferred by caller). */
export async function handleInAppReviewForegroundReturn(): Promise<void> {
  if (!isReviewPlatformEnabled()) {
    return;
  }
  clearInAppReviewMissedAlarmSuppressOnForeground();
  await tryShowPendingNativeStoreReview();
}

async function hasCompletedFirstLaunch(): Promise<boolean> {
  const openCount = await readCount(APP_OPEN_COUNT_KEY);
  return openCount >= 2;
}

/** Block review prompts for the rest of this app session after a genuine missed alarm. */
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

async function requestNativeStoreReview(): Promise<boolean> {
  if (reviewRequestInFlight) {
    return false;
  }
  if (!(await canRequestNativeStoreReviewNow())) {
    return false;
  }

  reviewRequestInFlight = true;
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      return false;
    }
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  } finally {
    reviewRequestInFlight = false;
  }
}

/**
 * Shows a queued native store review once navigation has settled (e.g. on the Alarms tab).
 */
export async function tryShowPendingNativeStoreReview(): Promise<void> {
  const { pending, dismissals, appOpens } = await readReviewCounts();
  if (!pending) {
    return;
  }

  if (dismissals < DISMISS_THRESHOLD) {
    await clearPendingNativeStoreReview();
    return;
  }

  if (suppressAfterMissedAlarm || appOpens < 2) {
    return;
  }

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 450);
  });

  const afterDelay = await readReviewCounts();
  if (!afterDelay.pending || afterDelay.dismissals < DISMISS_THRESHOLD) {
    return;
  }
  if (suppressAfterMissedAlarm || afterDelay.appOpens < 2) {
    return;
  }

  const shown = await requestNativeStoreReview();
  if (shown) {
    await clearPendingNativeStoreReview();
  }
}

/**
 * After the user successfully dismisses a ringing alarm, count toward the native
 * store review trigger. On the third dismissal, queue Apple's / Google's in-app review UI.
 */
export async function recordSuccessfulAlarmDismiss(): Promise<void> {
  if (!isReviewPlatformEnabled()) {
    return;
  }

  const previous = await readCount(ALARM_DISMISS_COUNT_KEY);
  const next = previous + 1;
  await writeCount(ALARM_DISMISS_COUNT_KEY, next);

  if (next >= DISMISS_THRESHOLD) {
    await markPendingNativeStoreReview();
  }
}
