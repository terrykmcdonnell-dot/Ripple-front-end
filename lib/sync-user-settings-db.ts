import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { Platform } from 'react-native';

import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { loadNotificationsMasterEnabled, loadUpcomingReminderEnabled } from '@/lib/settings-preferences';
import { supabase } from '@/lib/supabase';

export type UserSettingsDbRow = {
  defaultSnoozeDuration?: number;
  defaultAlarmSound?: string;
  isVibrationEnabled?: boolean;
  alarmVolume?: string;
  appTheme?: string;
  areNotificationsAllowed?: boolean;
  isUpcomingReminderEnabled?: boolean;
  /** Minutes before alarm for upcoming reminder (optional server column). */
  upcomingReminderLeadMinutes?: number;
};

/** Whether syncing notification-related prefs to DB makes sense (permission / gates). */
export async function notificationPrefsEligibleForDbSync(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  const [master, upcoming, perm] = await Promise.all([
    loadNotificationsMasterEnabled(),
    loadUpcomingReminderEnabled(),
    getPermissionsAsync(),
  ]);
  if (!master || !upcoming) {
    return true;
  }
  return isOsNotificationAllowed(perm);
}

export async function patchSignedInUserSettings(partial: UserSettingsDbRow): Promise<{ error: Error | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { error: new Error('Not signed in') };
  }

  const { error } = await supabase.from('users').update(partial).eq('email', email);
  return { error: error ? new Error(error.message) : null };
}
