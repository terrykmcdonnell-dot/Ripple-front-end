import { Platform } from 'react-native';

import { isAndroidExactAlarmGranted, needsAndroidExactAlarmPermissionCheck } from '@/lib/android-exact-alarm-granted';
import { isAndroidFullScreenIntentGranted } from '@/lib/android-full-screen-intent-granted';
import { isAndroidNotificationPolicyAccessGranted } from '@/lib/android-notification-policy-granted';
import { openAndroidExactAlarmPermissionSettings } from '@/lib/open-android-exact-alarm-settings';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';
import { openAndroidNotificationPolicyAccessSettings } from '@/lib/open-android-notification-policy-access-settings';

export type AndroidAlarmPermissionWarning = {
  id: 'exact_alarm' | 'fsi' | 'dnd';
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
  const [exactGranted, fsiGranted, dndGranted] = await Promise.all([
    isAndroidExactAlarmGranted(),
    isAndroidFullScreenIntentGranted(),
    isAndroidNotificationPolicyAccessGranted(),
  ]);

  if (needsAndroidExactAlarmPermissionCheck() && !exactGranted) {
    warnings.push({
      id: 'exact_alarm',
      title: 'Alarms may be delayed — tap to fix.',
      body: 'Ripple needs Alarms & reminders permission so alarms ring on time instead of up to 15 minutes late.',
      actionLabel: 'Open Alarms & reminders settings',
      openSettings: openAndroidExactAlarmPermissionSettings,
    });
  }

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
