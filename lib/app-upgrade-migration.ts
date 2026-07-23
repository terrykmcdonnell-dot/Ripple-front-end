import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clearAlarmFireDeliveryState, syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { flushPendingAlarmHistoryWrites } from '@/lib/alarm-history-sync';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';

const INSTALLED_VERSION_KEY = 'ripple_app_installed_version_v1';

let _migrationRan = false;

/**
 * Full defensive re-sync of every local + OS alarm schedule from the server.
 *
 * Alarm scheduling depends on a lot of state that lives OUTSIDE the JS bundle and is never
 * migrated automatically across app versions: AsyncStorage caches (delivered-occurrence map,
 * scheduled notification ids, pending snooze id, pending history queue) and native Android prefs.
 * When a release changes identifier formats, sync logic, or native alarm code, leftover state
 * from the previous version can silently block alarms, cancel a snooze, or crash the native alarm
 * service — historically the only fix users found for that was uninstalling and reinstalling the
 * app. This clears the local caches and lets `syncAlarmFireNotifications` /
 * `syncUpcomingReminderNotifications` rebuild the OS schedule from the API.
 *
 * IMPORTANT: this deliberately does NOT cancel the OS notification schedule up front. Both sync
 * functions already use a "compute-then-commit" pattern — they only swap the OS schedule after
 * confirming the fresh fetch from the API succeeded, and leave the existing schedule untouched on
 * any network/auth failure. Cancelling here first would defeat that safety: if this runs at cold
 * boot before the network or auth session is ready, the fetch would fail, the sync functions would
 * correctly bail out to avoid data loss, but the alarms would already be gone — leaving the user
 * with zero scheduled alarms until the next successful sync. Clearing only the local JS-side
 * bookkeeping (delivered-occurrence map, scheduled-id cache) is safe because it never touches
 * anything currently scheduled with the OS.
 *
 * Safe to call any time (e.g. from a "Repair alarms" settings action) — it is the same resync the
 * app already runs after login and after preference changes.
 */
export async function resyncAllAlarmSchedules(): Promise<void> {
  await clearAlarmFireDeliveryState().catch(() => undefined);
  await flushPendingAlarmHistoryWrites().catch(() => undefined);
  await syncUpcomingReminderNotifications().catch(() => undefined);
  await syncAlarmFireNotifications().catch(() => undefined);
}

/**
 * Runs `resyncAllAlarmSchedules` exactly once per installed app version.
 *
 * Safe for both genuine upgrades and first-ever launches — a fresh install has nothing to
 * cancel/resync yet, so the extra work is a harmless no-op. Always records the current version
 * (even after a partial failure) so a persistent error can never re-run the reset on every launch.
 */
export async function runAppUpgradeMigrationIfNeeded(): Promise<void> {
  if (Platform.OS === 'web' || _migrationRan) {
    return;
  }
  _migrationRan = true;

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  let storedVersion: string | null = null;
  try {
    storedVersion = await AsyncStorage.getItem(INSTALLED_VERSION_KEY);
  } catch {
    /* treat as unknown — still run the resync below */
  }

  if (storedVersion === currentVersion) {
    return;
  }

  try {
    await resyncAllAlarmSchedules();
  } catch {
    /* best-effort — must never block app boot */
  } finally {
    await AsyncStorage.setItem(INSTALLED_VERSION_KEY, currentVersion).catch(() => undefined);
  }
}
