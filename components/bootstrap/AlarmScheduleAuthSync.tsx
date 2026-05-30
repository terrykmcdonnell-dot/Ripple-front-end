import { useEffect } from 'react';
import { Platform } from 'react-native';

import { cancelAlarmFireNotifications, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { supabase } from '@/lib/supabase';
import {
  cancelUpcomingReminderNotifications,
  syncUpcomingReminderNotifications,
} from '@/lib/upcoming-reminder-scheduler';

/** Re-register OS alarm-fire + upcoming-reminder notifications from the API (next occurrences). */
function rescheduleAllForSignedInUser() {
  void syncUpcomingReminderNotifications().then(() => syncAlarmFireNotifications());
}

function clearAllRippleScheduledNotifications() {
  void cancelUpcomingReminderNotifications().then(() => cancelAlarmFireNotifications());
}

/**
 * Keeps local notification schedules aligned with auth: after login / session restore we reload
 * all alarm times from the backend; after sign-out we cancel so the previous account's alarms
 * cannot fire. Works with `syncAlarmFireNotifications` / `syncUpcomingReminderNotifications` elsewhere
 * (alarm list, create, settings, templates).
 */
export function AlarmScheduleAuthSync() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        // TOKEN_REFRESHED: the userId embedded in scheduled notifications is still
        // valid but re-sync ensures the schedule is fresh after any gap.
        rescheduleAllForSignedInUser();
        return;
      }
      if (event === 'SIGNED_OUT') {
        clearAllRippleScheduledNotifications();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
