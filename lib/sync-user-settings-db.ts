import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { Platform } from 'react-native';

import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { loadNotificationsMasterEnabled, loadUpcomingReminderEnabled } from '@/lib/settings-preferences';
import { supabase } from '@/lib/supabase';

/**
 * Syncs app settings to `public.users` using the authenticated Supabase session.
 *
 * RLS on `public.users` (see Supabase dashboard) should allow INSERT/SELECT/UPDATE only when
 * `users.email` matches `auth.jwt() ->> 'email'`. We filter with the same lowercased email used
 * at signup (`syncUserProfileToTable`). If no row is updated, either there is no profile row yet
 * or the stored email does not match the JWT (policy will hide/forbid the update).
 */
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
  const definedEntries = Object.entries(partial as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  if (definedEntries.length === 0) {
    return { error: null };
  }
  const payload = Object.fromEntries(definedEntries);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { error: new Error('Not signed in') };
  }

  const { data, error } = await supabase.from('users').update(payload).eq('email', email).select('email');

  if (error) {
    return { error: new Error(error.message) };
  }
  if (!data?.length) {
    return {
      error: new Error(
        'No user profile row updated. Ensure you finished signup (public.users row) and email matches your session (RLS).',
      ),
    };
  }

  return { error: null };
}
