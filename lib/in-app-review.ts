import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { publishInAppReviewPrompt } from '@/lib/in-app-review-hub';
import { submitInAppReview } from '@/lib/submit-in-app-review';

const APP_OPEN_COUNT_KEY = 'ripple_in_app_review_app_open_count_v1';
const ALARM_TURNOFF_COUNT_KEY = 'ripple_in_app_review_alarm_turnoff_count_v1';
const REVIEW_REQUESTED_KEY = 'ripple_in_app_review_requested_v1';
const REVIEW_PROMPT_DECLINED_KEY = 'ripple_in_app_review_prompt_declined_v1';

/** Successful alarm turn-offs before offering an in-app review. */
const TURNOFF_THRESHOLD = 3;

const IN_APP_REVIEW_ENABLED_ON_ANDROID = true;

let suppressAfterMissedAlarm = false;
let reviewPromptVisible = false;

function isReviewPlatformEnabled(): boolean {
  if (Platform.OS === 'ios') {
    return true;
  }
  if (Platform.OS === 'android') {
    return IN_APP_REVIEW_ENABLED_ON_ANDROID;
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

/** Call once per cold start so the first app launch never triggers a review. */
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

async function hasAlreadyRequestedReview(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
  return raw === '1';
}

async function hasDeclinedReviewPrompt(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REVIEW_PROMPT_DECLINED_KEY);
  return raw === '1';
}

async function markReviewRequested(): Promise<void> {
  await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
}

async function markReviewPromptDeclined(): Promise<void> {
  await AsyncStorage.setItem(REVIEW_PROMPT_DECLINED_KEY, '1');
}

/** Block review prompts for the rest of this app session after a missed alarm. */
export function suppressInAppReviewAfterMissedAlarm(): void {
  suppressAfterMissedAlarm = true;
}

async function canPromptForReviewNow(): Promise<boolean> {
  if (!isReviewPlatformEnabled()) {
    return false;
  }
  if (suppressAfterMissedAlarm) {
    return false;
  }
  if (!(await hasCompletedFirstLaunch())) {
    return false;
  }
  if (await hasAlreadyRequestedReview()) {
    return false;
  }
  if (await hasDeclinedReviewPrompt()) {
    return false;
  }
  return true;
}

function offerInAppReviewPrompt(): void {
  if (reviewPromptVisible) {
    return;
  }
  reviewPromptVisible = true;
  publishInAppReviewPrompt();
}

/** User dismissed the in-app review modal without submitting. */
export function dismissInAppReviewPrompt(): void {
  reviewPromptVisible = false;
  void markReviewPromptDeclined();
}

/** User submitted a star rating and optional review text. */
export async function completeInAppReviewSubmission(stars: number, message: string): Promise<void> {
  reviewPromptVisible = false;
  await submitInAppReview(stars, message);
  await markReviewRequested();
}

/**
 * After a user successfully turns an alarm off (enabled → disabled), count toward the
 * review trigger. On the third successful turn-off, show the in-app review modal.
 */
export async function recordSuccessfulAlarmTurnOff(): Promise<void> {
  if (!(await canPromptForReviewNow())) {
    return;
  }

  const previous = await readCount(ALARM_TURNOFF_COUNT_KEY);
  const next = previous + 1;
  await writeCount(ALARM_TURNOFF_COUNT_KEY, next);

  if (next < TURNOFF_THRESHOLD) {
    return;
  }

  offerInAppReviewPrompt();
}
