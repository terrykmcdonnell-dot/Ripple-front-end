import { useEffect } from 'react';
import { Platform } from 'react-native';

import { runAppUpgradeMigrationIfNeeded } from '@/lib/app-upgrade-migration';

/**
 * Runs once per app-version bump: clears stale alarm-schedule caches (delivered-occurrence map,
 * scheduled notification ids, pending snooze/history) and rebuilds every OS notification schedule
 * from the server. Mounted before the other alarm bootstraps so a clean schedule is already in
 * place before they run their own (idempotent) syncs.
 *
 * This exists so updating from the App/Play Store is enough — users should never need to
 * uninstall and reinstall Ripple to get alarms, snooze, or history working correctly again.
 */
export function AppUpgradeMigrationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void runAppUpgradeMigrationIfNeeded();
  }, []);

  return null;
}
