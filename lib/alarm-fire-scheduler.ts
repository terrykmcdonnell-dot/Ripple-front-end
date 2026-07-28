import AsyncStorage from '@react-native-async-storage/async-storage';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import getAllScheduledNotificationsAsync from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import { Platform } from 'react-native';

import { getNativeAlarmFireDeliveredMap, syncEnabledAlarmIdsToNative, syncNativeAlarmFireDelivered } from '@/lib/android-alarm-native-prefs';

import { fetchAlarms, patchAlarm } from '@/lib/alarm-api';
import { incrementFreeRingCount } from '@/lib/alarm-free-ring-limit';
import type { AlarmListItem } from '@/lib/alarm-format';
import { formatScheduledLocalParts } from '@/lib/alarm-format';
import {
  ALARM_FIRE_CATEGORY_ID,
  ALARM_FIRE_DATA_TYPE,
} from '@/lib/alarm-notification-constants';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import { resolveAlarmSoundForUser } from '@/lib/alarm-sound-access';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import {
  coerceAlarmSoundId,
  DEFAULT_ALARM_SOUND_OPTIONS,
  loadDefaultAlarmSoundId,
  loadDefaultVibrationEnabled,
  loadNotificationsMasterEnabled,
} from '@/lib/settings-preferences';
import { fetchIsSubscriberFresh, limitsApply } from '@/lib/subscription-access';
import {
  alignAlarmNotificationTriggerDate,
  MIN_ALARM_SCHEDULE_LEAD_MS,
} from '@/lib/alarm-notification-trigger';
import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { nextCanonicalAlarmFire } from '@/lib/upcoming-reminder-scheduler';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { cancelPendingSnoozeNotification } from '@/lib/device-snooze';
import { setAndroidAlarmStyleNotificationChannelAsync } from '@/lib/android-alarm-notification-channel';
import { getIosAlarmInterruptionLevel } from '@/lib/ios-alarm-notification-options';
import { requestIosScheduledNotificationLimitCheck } from '@/lib/ios-scheduled-notification-limit';

const STORAGE_IDS_KEY = 'ripple_alarm_fire_scheduled_notification_ids';

const FIRE_VIBRATION_PATTERN = [0, 450, 250, 450] as const;

/**
 * How far back we look when computing the next fire time.
 *
 * If a sync runs a few seconds after the scheduled moment — due to network
 * latency, a concurrent sync cancelling and re-scheduling, or an auth-refresh
 * event — the alarm is still caught and fires ~5 s from now rather than being
 * silently advanced to the next repeat interval.
 */
const PAST_FIRE_GRACE_MS = 90_000;

const DELIVERED_KEY = 'ripple_alarm_fire_delivered_v1';

/**
 * Called from the ring screen on mount to mark this alarm occurrence as
 * delivered. The scheduler checks this before re-firing a grace-window alarm
 * so a sync triggered by the user returning to the alarm list never causes a
 * second ring for the same occurrence.
 */
export async function markAlarmFireDelivered(alarmId: number, fireAtMs: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERED_KEY);
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    // Every code path that fires for the same occurrence (foreground receive, notification
    // tap, android native action, ring-screen mount) calls this with the same fireAtMs, so
    // comparing against the previous value here is what keeps the free-ring counter below
    // from double-counting a single ring.
    const isNewOccurrence = map[String(alarmId)] !== fireAtMs;
    map[String(alarmId)] = fireAtMs;
    await AsyncStorage.setItem(DELIVERED_KEY, JSON.stringify(map));
    syncNativeAlarmFireDelivered(alarmId, fireAtMs);
    if (isNewOccurrence) {
      void enforceFreeRingLimitOnDelivery(alarmId);
    }
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Free-tier gate: once a non-Pro alarm has rung `FREE_TIER_MAX_RINGS_PER_ALARM` times, turn
 * it off so the next sync stops scheduling it, and let the alarm list surface an
 * "upgrade to re-enable" state. The ring that just fired always completes normally — this
 * only prevents the *next* occurrence from being scheduled.
 */
async function enforceFreeRingLimitOnDelivery(alarmId: number): Promise<void> {
  try {
    const isSubscriber = await fetchIsSubscriberFresh();
    if (!limitsApply(isSubscriber)) {
      return;
    }
    const { justReachedLimit } = await incrementFreeRingCount(alarmId);
    if (!justReachedLimit) {
      return;
    }
    await patchAlarm(alarmId, { is_enabled: false }).catch(() => undefined);
    void syncAlarmFireNotifications();
  } catch {
    /* best-effort free-tier gate; never block ring delivery */
  }
}

/** True when this alarm occurrence already fired (native lock screen, ring screen, or prior sync). */
export async function isAlarmFireOccurrenceDelivered(
  alarmId: number,
  fireAtMs: number,
): Promise<boolean> {
  const map = await loadDeliveredMap();
  const last = map[String(alarmId)];
  return typeof last === 'number' && last >= fireAtMs;
}

async function loadDeliveredMap(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERED_KEY);
    let map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (Platform.OS === 'android') {
      const nativeMap = await getNativeAlarmFireDeliveredMap();
      let changed = false;
      for (const [key, value] of Object.entries(nativeMap)) {
        const prev = map[key];
        if (prev === undefined || value > prev) {
          map[key] = value;
          changed = true;
        }
      }
      if (changed) {
        await AsyncStorage.setItem(DELIVERED_KEY, JSON.stringify(map));
      }
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Module-level mutex so concurrent callers (e.g. alarm-create screen +
 * alarm-list screen both mounting at the same instant after saving a new
 * alarm) never race on the cancel → reschedule steps.
 *
 * The second caller sets _syncPending = true and returns immediately.
 * Once the in-flight sync finishes it checks the flag and re-runs once,
 * ensuring the latest alarm set always lands.
 */
let _syncInProgress = false;
let _syncPending = false;

/**
 * One-shot timer that fires a re-sync once the 90-second grace window closes
 * for the most recently delivered alarm occurrence.
 *
 * Problem it solves: when the ring screen opens and the user dismisses, every
 * sync during the next 90 seconds correctly skips the just-delivered occurrence
 * (grace + delivered check) but also cannot schedule the NEXT occurrence yet
 * (nextCanonicalAlarmFire still returns the same timestamp). Without this timer
 * there is no trigger to schedule the next occurrence once the window closes,
 * so e.g. a hourly alarm dismissed at 5:14 PM would silently miss the 6:14 PM
 * ring unless the user manually returned to the alarm screen.
 */
let _graceReSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function cancelStoredAlarmFireNotifications(): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_IDS_KEY);
  let ids: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    ids = [];
  }
  await Promise.all(ids.map((id) => cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(STORAGE_IDS_KEY);
}

/** Cancels tracked + any orphan ripple alarm-fire notifications still in the OS queue. */
async function cancelRippleAlarmFireScheduledNotifications(): Promise<void> {
  await cancelStoredAlarmFireNotifications();
  try {
    const all = await getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((req) => req.identifier.startsWith('ripple_alarm_fire_'))
        .map((req) => cancelScheduledNotificationAsync(req.identifier).catch(() => undefined)),
    );
  } catch {
    /* scheduler unavailable */
  }
}

export async function cancelAlarmFireNotifications(): Promise<void> {
  await cancelRippleAlarmFireScheduledNotifications();
  await cancelPendingSnoozeNotification();
}

/**
 * Clears the delivered-occurrence map and scheduled-notification-id cache.
 *
 * Used by the app-upgrade migration (`lib/app-upgrade-migration.ts`) so leftover state keyed to a
 * previous version's identifier format or scheduling logic can never survive an in-place update —
 * previously the only fix users found for stuck/duplicate/missing alarms after updating was to
 * uninstall and reinstall the app.
 */
export async function clearAlarmFireDeliveryState(): Promise<void> {
  await AsyncStorage.multiRemove([DELIVERED_KEY, STORAGE_IDS_KEY]).catch(() => undefined);
}

/**
 * `a3` = full-screen alarm channel revision (IMPORTANCE_MAX + USAGE_ALARM).
 * Android caches channel importance/audio attributes forever, so bump this when lock-screen behavior changes.
 */
export async function ensureAndroidAlarmFireChannel(
  soundId: AlarmSoundId,
  vibrationEnabled: boolean,
): Promise<string> {
  const channelId = `ripple_alarm_fire_a3_${soundId}_${vibrationEnabled ? 'vib' : 'still'}`;
  const soundFile = bundledNotificationSoundFilename(soundId);
  await setAndroidAlarmStyleNotificationChannelAsync(channelId, {
    name: 'Medication Alarms',
    sound: soundFile,
    enableVibrate: vibrationEnabled,
    vibrationPattern: FIRE_VIBRATION_PATTERN,
  });
  return channelId;
}

/** Creates all alarm channels at startup so fired alarms never fall back to the "Other" channel. */
export async function ensureAllAndroidAlarmChannelsAsync(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const vibrationEnabled = await loadDefaultVibrationEnabled();
  const soundIds: AlarmSoundId[] = DEFAULT_ALARM_SOUND_OPTIONS.map((o) => o.id);
  await Promise.all(soundIds.map((id) => ensureAndroidAlarmFireChannel(id, vibrationEnabled)));
  await Promise.all(soundIds.map((id) => ensureAndroidAlarmFireChannel(id, !vibrationEnabled)));
}

/**
 * Schedules the **next** occurrence per enabled alarm via the OS
 * (AlarmManager / UNUserNotificationCenter). No JS background loop — the
 * system wakes the device at the requested time.
 *
 * **Android:** Alarm channels use **USAGE_ALARM**, **enforceAudibility**, and
 * **bypassDnd** so rings follow the **alarm** volume stream and bypass silent /
 * vibrate mode and Do Not Disturb on all OEMs that honour it.
 * **iOS:** notifications use Time Sensitive delivery by default, or Critical
 * Alerts when the build is configured with Apple's critical-alerts entitlement.
 * The foreground in-app sound uses `playsInSilentModeIOS: true` (expo-av).
 *
 * A module-level mutex ensures only one sync runs at a time. Any concurrent
 * call queues a single re-run that executes once the in-flight sync completes.
 */
export async function syncAlarmFireNotifications(alarms?: AlarmListItem[]): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  if (_syncInProgress) {
    // Queue one re-run so this caller's alarm set is included after the
    // current sync finishes, but don't stack unlimited re-runs.
    _syncPending = true;
    return;
  }

  _syncInProgress = true;
  _syncPending = false;

  try {
    await _syncAlarmFireNotificationsCore(alarms);
  } finally {
    _syncInProgress = false;
    if (_syncPending) {
      _syncPending = false;
      // Re-run without the original rows so we always fetch the freshest set.
      void syncAlarmFireNotifications();
    }
    requestIosScheduledNotificationLimitCheck();
  }
}

/** One alarm occurrence resolved and ready to schedule with the OS. */
type AlarmFireSpec = {
  alarm: AlarmListItem;
  soundId: AlarmSoundId;
  /** Actual OS delivery time (may be now+5 s for a grace-window catch-up). */
  fireAt: Date;
  /** Original scheduled occurrence time — used for identifier + display + payload. */
  fireAtRaw: Date;
};

function syncNativeEnabledAlarmIdsFromRows(rows: AlarmListItem[]): void {
  syncEnabledAlarmIdsToNative(rows.filter((alarm) => alarm.isEnabled).map((alarm) => alarm.id));
}

async function _syncAlarmFireNotificationsCore(alarms?: AlarmListItem[]): Promise<void> {
  const notificationsMasterEnabled = await loadNotificationsMasterEnabled();
  if (!notificationsMasterEnabled) {
    // Intentional user action (notifications turned off) — clear schedule.
    await cancelRippleAlarmFireScheduledNotifications();
    await cancelPendingSnoozeNotification();
    syncEnabledAlarmIdsToNative([]);
    return;
  }

  let rows = alarms;
  let schedulingUserId: number | null = null;

  if (rows === undefined) {
    const { id: userId, error } = await fetchCurrentUserRowId();
    if (error || userId == null) {
      // Could not resolve the user (transient network / auth refresh in
      // flight). Do NOT cancel — leave any already-scheduled alarm intact.
      return;
    }
    schedulingUserId = userId;
    try {
      rows = await fetchAlarms(userId);
    } catch {
      // Network failure — keep existing scheduled notifications. Cancelling
      // here was the root cause of "alarm silently disappears": a transient
      // re-sync would wipe the OS notification and never replace it.
      return;
    }
  } else {
    const { id: userId, error } = await fetchCurrentUserRowId();
    if (!error && userId != null) {
      schedulingUserId = userId;
    }
  }

  if (rows.every((alarm) => !alarm.isEnabled)) {
    await cancelRippleAlarmFireScheduledNotifications();
    await cancelPendingSnoozeNotification();
    syncEnabledAlarmIdsToNative([]);
    return;
  }

  const existing = await getPermissionsAsync();
  if (!isOsNotificationAllowed(existing)) {
    // No OS permission to post — cannot schedule. Leave existing state alone.
    return;
  }

  const isSubscriber = await fetchIsSubscriberFresh();
  const defaultSoundId = resolveAlarmSoundForUser(await loadDefaultAlarmSoundId(), isSubscriber);
  const vibrationEnabled = await loadDefaultVibrationEnabled();

  const now = new Date();
  // Look back PAST_FIRE_GRACE_MS so an alarm whose scheduled moment just
  // passed (race condition, network delay, or auth-refresh re-sync) is still
  // caught and fires a few seconds from now rather than being advanced to the
  // next repeat interval.
  const syncFrom = new Date(now.getTime() - PAST_FIRE_GRACE_MS);
  const deliveredMap = await loadDeliveredMap();

  // ── PHASE 1 (compute): resolve every occurrence WITHOUT touching the OS
  // schedule yet. All fallible reads (network, settings, permissions) are now
  // complete, so reaching this point guarantees we can safely commit below.
  const specs: AlarmFireSpec[] = [];
  // Tracks when the earliest grace window closes across all grace-skipped alarms.
  // A deferred re-sync is armed at this time so the next occurrence is scheduled
  // promptly (e.g. 6:14 PM after a 5:14 PM alarm is dismissed).
  let earliestGraceExpiresAt: number | null = null;

  for (const alarm of rows.filter((a) => a.isEnabled)) {
    const rawSoundId = coerceAlarmSoundId(alarm.sound) ?? defaultSoundId;
    const soundId = resolveAlarmSoundForUser(rawSoundId, isSubscriber);

    // Use syncFrom (= now − grace) so a slightly-late sync still resolves
    // the current occurrence instead of jumping straight to the next repeat.
    const fireAtRaw = nextCanonicalAlarmFire(alarm, syncFrom);
    if (!fireAtRaw) {
      continue;
    }

    // If the occurrence falls inside the grace window (due within the last
    // 90 s), schedule it to fire in 5 s so it still rings rather than being
    // silently skipped.
    const isInGracePast =
      fireAtRaw.getTime() < now.getTime() &&
      fireAtRaw.getTime() >= now.getTime() - PAST_FIRE_GRACE_MS;

    let fireAt: Date;
    if (isInGracePast) {
      // Skip if the ring screen already opened for this occurrence — prevents
      // the dismiss → alarm-list-focus → sync → re-fire loop.
      const lastDelivered = deliveredMap[String(alarm.id)];
      if (typeof lastDelivered === 'number' && lastDelivered >= fireAtRaw.getTime()) {
        // Record when this grace window closes so we can arm a deferred re-sync
        // that will advance this alarm to its next occurrence (e.g. +1 hour).
        const expiresAt = fireAtRaw.getTime() + PAST_FIRE_GRACE_MS;
        if (earliestGraceExpiresAt === null || expiresAt < earliestGraceExpiresAt) {
          earliestGraceExpiresAt = expiresAt;
        }
        continue;
      }
      fireAt = new Date(now.getTime() + 5_000);
    } else {
      if (fireAtRaw.getTime() <= now.getTime() + MIN_ALARM_SCHEDULE_LEAD_MS) {
        continue;
      }
      fireAt = alignAlarmNotificationTriggerDate(fireAtRaw);
      if (fireAt.getTime() <= now.getTime() + MIN_ALARM_SCHEDULE_LEAD_MS) {
        continue;
      }
    }

    specs.push({ alarm, soundId, fireAt, fireAtRaw });
  }

  // ── PHASE 2 (commit): now it is safe to swap. Cancel the previous schedule
  // and register the freshly-computed one. Because this only runs after all
  // network reads succeeded, a transient failure can never leave the user with
  // zero scheduled alarms.
  await cancelRippleAlarmFireScheduledNotifications();

  const androidChannelIdsBySound = new Map<string, string>();
  const scheduledIds: string[] = [];

  for (const spec of specs) {
    const { alarm, soundId, fireAt, fireAtRaw } = spec;
    const soundFile = bundledNotificationSoundFilename(soundId);

    let androidChannelId = '';
    if (Platform.OS === 'android') {
      const cached = androidChannelIdsBySound.get(soundId);
      if (cached) {
        androidChannelId = cached;
      } else {
        androidChannelId = await ensureAndroidAlarmFireChannel(soundId, vibrationEnabled);
        androidChannelIdsBySound.set(soundId, androidChannelId);
      }
    }

    // Show the original scheduled time in the notification body, not the
    // adjusted delivery time (e.g. show "7:45 PM" not "7:45:05 PM").
    const { time, ampm } = formatScheduledLocalParts(fireAtRaw.toISOString());
    const label = alarm.label.trim() || 'Alarm';

    try {
      const notificationId = await scheduleNotificationAsync({
        // Keyed on fireAtRaw so duplicate syncs for the same occurrence produce
        // the same identifier and the OS overwrites rather than stacks them.
        identifier: `ripple_alarm_fire_${alarm.id}_${fireAtRaw.getTime()}`,
        content: {
          title: `Alarm · ${label}`,
          body: `Ringing · ${time} ${ampm}`,
          sound: soundFile,
          priority: AndroidNotificationPriority.MAX,
          categoryIdentifier: ALARM_FIRE_CATEGORY_ID,
          ...(Platform.OS === 'android'
            ? {
                // Match alarm-app FSI requirements: ongoing + no auto-cancel so Android
                // treats this as a full-screen alarm, not a dismissible heads-up banner.
                sticky: true,
                autoDismiss: false,
              }
            : {}),
          data: {
            type: ALARM_FIRE_DATA_TYPE,
            alarmId: alarm.id,
            // Pass the original time so history + ring screen show the correct
            // moment rather than the ±5 s adjusted delivery time.
            fireAt: fireAtRaw.toISOString(),
            label,
            category: alarm.category,
            ...(alarm.categoryId != null ? { categoryId: alarm.categoryId } : {}),
            ...(alarm.categoryIcon ? { categoryIcon: alarm.categoryIcon } : {}),
            soundId,
            ...(schedulingUserId != null ? { userId: schedulingUserId } : {}),
          },
          ...(Platform.OS === 'android' && vibrationEnabled ? { vibrate: [...FIRE_VIBRATION_PATTERN] } : {}),
          ...(Platform.OS === 'android'
            ? {
                android: {
                  channelId: androidChannelId,
                },
              }
            : {}),
          ...(Platform.OS === 'ios'
            ? {
                interruptionLevel: getIosAlarmInterruptionLevel(),
              }
            : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: androidChannelId } : {}),
        },
      });
      scheduledIds.push(notificationId);
    } catch {
      /* skip single alarm */
    }
  }

  if (scheduledIds.length > 0) {
    await AsyncStorage.setItem(STORAGE_IDS_KEY, JSON.stringify(scheduledIds));
  }

  // ── DEFERRED RE-SYNC: arm a one-shot timer so the next occurrence is
  // scheduled promptly once every grace window from this sync closes.
  //
  // Without this, a user who dismisses at 5:14 PM and stays on the alarm
  // screen would find the 6:14 PM alarm unscheduled until a manual navigation
  // or an auth-token refresh happened to trigger another sync.
  if (_graceReSyncTimer != null) {
    clearTimeout(_graceReSyncTimer);
    _graceReSyncTimer = null;
  }
  if (earliestGraceExpiresAt !== null) {
    // Add 1 500 ms buffer so syncFrom (= now − PAST_FIRE_GRACE_MS) is safely
    // past the delivered fireAtRaw, ensuring nextCanonicalAlarmFire advances.
    const delayMs = Math.max(0, earliestGraceExpiresAt - Date.now()) + 1_500;
    _graceReSyncTimer = setTimeout(() => {
      _graceReSyncTimer = null;
      void syncAlarmFireNotifications();
    }, delayMs);
  }

  syncNativeEnabledAlarmIdsFromRows(rows);
}
