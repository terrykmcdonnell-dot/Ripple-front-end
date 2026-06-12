import { Platform } from 'react-native';

import { isAndroidFullScreenIntentGranted } from '@/lib/android-full-screen-intent-granted';
import { isAndroidNotificationPolicyAccessGranted } from '@/lib/android-notification-policy-granted';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';
import { openAndroidNotificationPolicyAccessSettings } from '@/lib/open-android-notification-policy-access-settings';

export type AndroidAlarmPermissionWarning = {
  id: 'fsi' | 'dnd';
  title: string;
  body: string;
  actionLabel: string;
  openSettings: () => Promise<void>;
};

/** Missing Android settings that block reliable lock-screen / DND alarm delivery. */
export async function getAndroidAlarmPermissionWarnings(): Promise<AndroidAlarmPermissionWarning[]> {
  if (Platform.OS !== 'android') {
    return [];
  }

  const warnings: AndroidAlarmPermissionWarning[] = [];
  const [fsiGranted, dndGranted] = await Promise.all([
    isAndroidFullScreenIntentGranted(),
    isAndroidNotificationPolicyAccessGranted(),
  ]);

  if (!fsiGranted && (Platform.Version as number) >= 34) {
    warnings.push({
      id: 'fsi',
      title: 'Full screen intents are off',
      body:
        'Ripple is not allowed to show full-screen alarms on your lock screen. Without this, you only get a small banner instead of the alarm UI.',
      actionLabel: 'Open Full Screen Intent settings → turn Ripple ON',
      openSettings: openAndroidFullScreenAlarmPermissionSettings,
    });
  }

  if (!dndGranted) {
    warnings.push({
      id: 'dnd',
      title: 'Do Not Disturb access is off',
      body:
        'Ripple is not in Android Modes / Do Not Disturb access. Alarms may be silenced during Total Silence or strict Focus modes.',
      actionLabel: 'Open Modes access → turn Ripple ON',
      openSettings: openAndroidNotificationPolicyAccessSettings,
    });
  }

  return warnings;
}

export async function hasAndroidAlarmPermissionWarnings(): Promise<boolean> {
  const warnings = await getAndroidAlarmPermissionWarnings();
  return warnings.length > 0;
}
