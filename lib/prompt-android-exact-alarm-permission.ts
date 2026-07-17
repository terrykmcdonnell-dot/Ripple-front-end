import { Platform } from 'react-native';

import { isAndroidExactAlarmGranted, needsAndroidExactAlarmPermissionCheck } from '@/lib/android-exact-alarm-granted';

/**
 * Returns true when the exact-alarm explanation modal should run before saving an alarm.
 */
export async function shouldPromptAndroidExactAlarmPermission(): Promise<boolean> {
  if (!needsAndroidExactAlarmPermissionCheck()) {
    return false;
  }
  return !(await isAndroidExactAlarmGranted());
}
