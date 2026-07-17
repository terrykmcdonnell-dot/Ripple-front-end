import AsyncStorage from '@react-native-async-storage/async-storage';
import getAllScheduledNotificationsAsync from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { Platform } from 'react-native';

/** Show warning when scheduled count exceeds this (iOS allows ~64). */
export const IOS_SCHEDULED_NOTIFICATION_WARN_THRESHOLD = 55;

const WARNING_SHOWN_KEY = 'ripple_ios_scheduled_notification_limit_warning_shown_v1';

type CheckListener = () => void;
const listeners = new Set<CheckListener>();

/** Ask subscribers (bootstrap UI) to re-check the scheduled notification count. */
export function requestIosScheduledNotificationLimitCheck(): void {
  if (Platform.OS !== 'ios') {
    return;
  }
  listeners.forEach((listener) => listener());
}

export function subscribeIosScheduledNotificationLimitCheck(listener: CheckListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function countIosScheduledNotifications(): Promise<number> {
  if (Platform.OS !== 'ios') {
    return 0;
  }
  try {
    const all = await getAllScheduledNotificationsAsync();
    return all.length;
  } catch {
    return 0;
  }
}

export async function getIosScheduledNotificationLimitWarning(): Promise<{
  shouldShow: boolean;
  count: number;
}> {
  if (Platform.OS !== 'ios') {
    return { shouldShow: false, count: 0 };
  }

  const shown = await AsyncStorage.getItem(WARNING_SHOWN_KEY);
  if (shown) {
    return { shouldShow: false, count: 0 };
  }

  const count = await countIosScheduledNotifications();
  return {
    shouldShow: count > IOS_SCHEDULED_NOTIFICATION_WARN_THRESHOLD,
    count,
  };
}

export async function markIosScheduledNotificationLimitWarningShown(): Promise<void> {
  await AsyncStorage.setItem(WARNING_SHOWN_KEY, '1');
}
