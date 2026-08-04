import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureRippleEvent } from '@/lib/posthog-analytics';
import { POSTHOG_EVENTS } from '@/lib/posthog-client';

const REVIEWS_STORAGE_KEY = 'ripple_in_app_reviews_v1';

export type InAppReviewSubmission = {
  stars: number;
  message: string;
  submittedAt: string;
};

/** Persists feedback locally and sends an analytics event (no store redirect). */
export async function submitInAppReview(stars: number, message: string): Promise<void> {
  const trimmedMessage = message.trim();
  const entry: InAppReviewSubmission = {
    stars,
    message: trimmedMessage,
    submittedAt: new Date().toISOString(),
  };

  const raw = await AsyncStorage.getItem(REVIEWS_STORAGE_KEY);
  let existing: InAppReviewSubmission[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        existing = parsed.filter(
          (item): item is InAppReviewSubmission =>
            item != null &&
            typeof item === 'object' &&
            typeof (item as InAppReviewSubmission).stars === 'number' &&
            typeof (item as InAppReviewSubmission).message === 'string' &&
            typeof (item as InAppReviewSubmission).submittedAt === 'string',
        );
      }
    } catch {
      existing = [];
    }
  }

  existing.push(entry);
  await AsyncStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(existing));

  captureRippleEvent(POSTHOG_EVENTS.appReviewSubmitted, {
    stars,
    has_message: trimmedMessage.length > 0,
    message_length: trimmedMessage.length,
  });
}
