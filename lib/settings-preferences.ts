import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_SNOOZE_KEY = 'ripple_default_snooze_minutes';

/** Preset lengths shown in Settings → Default Snooze */
export const DEFAULT_SNOOZE_OPTIONS_MINUTES = [5, 10, 15, 20, 30] as const;

const DEFAULT_MINUTES = 10;

export function formatSnoozeMinutesLabel(minutes: number): string {
  const n = Math.round(minutes);
  return `${n} minute${n === 1 ? '' : 's'}`;
}

function snapToNearestPreset(minutes: number): number {
  const presets = DEFAULT_SNOOZE_OPTIONS_MINUTES;
  if (presets.includes(minutes as (typeof presets)[number])) {
    return minutes;
  }
  return presets.reduce((best, p) =>
    Math.abs(p - minutes) < Math.abs(best - minutes) ? p : best,
  presets[0]);
}

export async function loadDefaultSnoozeMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_SNOOZE_KEY);
    if (!raw) {
      return DEFAULT_MINUTES;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_MINUTES;
    }
    return snapToNearestPreset(parsed);
  } catch {
    return DEFAULT_MINUTES;
  }
}

export async function saveDefaultSnoozeMinutes(minutes: number): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_SNOOZE_KEY, String(Math.round(minutes)));
}

const DEFAULT_SOUND_KEY = 'ripple_default_alarm_sound_id';

/** Preset labels for Settings → Default Sound (IDs are stable for storage + future audio assets). */
export const DEFAULT_ALARM_SOUND_OPTIONS = [
  { id: 'gentle-rise', label: 'Gentle Rise' },
  { id: 'morning-glow', label: 'Morning Glow' },
  { id: 'classic-bell', label: 'Classic Bell' },
  { id: 'digital-beep', label: 'Digital Beep' },
  { id: 'soft-piano', label: 'Soft Piano' },
  { id: 'nature-birds', label: 'Nature Birds' },
] as const;

export type AlarmSoundId = (typeof DEFAULT_ALARM_SOUND_OPTIONS)[number]['id'];

const DEFAULT_SOUND_ID: AlarmSoundId = 'gentle-rise';

export function labelForAlarmSoundId(id: string): string {
  const found = DEFAULT_ALARM_SOUND_OPTIONS.find((o) => o.id === id);
  return found?.label ?? DEFAULT_ALARM_SOUND_OPTIONS[0].label;
}

function normalizeSoundId(raw: string | null): AlarmSoundId {
  if (!raw) {
    return DEFAULT_SOUND_ID;
  }
  const match = DEFAULT_ALARM_SOUND_OPTIONS.find((o) => o.id === raw);
  return match?.id ?? DEFAULT_SOUND_ID;
}

export async function loadDefaultAlarmSoundId(): Promise<AlarmSoundId> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_SOUND_KEY);
    return normalizeSoundId(raw);
  } catch {
    return DEFAULT_SOUND_ID;
  }
}

export async function saveDefaultAlarmSoundId(id: AlarmSoundId): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_SOUND_KEY, id);
}

const DEFAULT_VOLUME_KEY = 'ripple_default_alarm_volume_percent';

/** Preset percentages for Settings → Volume */
export const DEFAULT_VOLUME_PERCENT_OPTIONS = [0, 25, 50, 75, 80, 90, 100] as const;

const DEFAULT_VOLUME_PERCENT = 80;

export function formatVolumePercentLabel(percent: number): string {
  const n = Math.max(0, Math.min(100, Math.round(percent)));
  return `${n}%`;
}

function snapVolumeToNearestPreset(percent: number): number {
  const presets = DEFAULT_VOLUME_PERCENT_OPTIONS;
  if (presets.includes(percent as (typeof presets)[number])) {
    return percent;
  }
  return presets.reduce((best, p) =>
    Math.abs(p - percent) < Math.abs(best - percent) ? p : best,
  presets[0]);
}

export async function loadDefaultVolumePercent(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_VOLUME_KEY);
    if (!raw) {
      return DEFAULT_VOLUME_PERCENT;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return DEFAULT_VOLUME_PERCENT;
    }
    return snapVolumeToNearestPreset(parsed);
  } catch {
    return DEFAULT_VOLUME_PERCENT;
  }
}

export async function saveDefaultVolumePercent(percent: number): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(percent)))));
}

const DEFAULT_VIBRATION_KEY = 'ripple_default_alarm_vibration_enabled';

/** Controls vibration on scheduled alarm/snooze notifications (Android channel + legacy vibrate). */
export async function loadDefaultVibrationEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_VIBRATION_KEY);
    if (raw === null) {
      return true;
    }
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export async function saveDefaultVibrationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_VIBRATION_KEY, enabled ? '1' : '0');
}

const UPCOMING_REMINDER_ENABLED_KEY = 'ripple_upcoming_reminder_enabled';

/** Schedules OS notifications ahead of each alarm (see {@link loadUpcomingReminderLeadMinutes}). */
export async function loadUpcomingReminderEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(UPCOMING_REMINDER_ENABLED_KEY);
    if (raw === null) {
      return true;
    }
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export async function saveUpcomingReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(UPCOMING_REMINDER_ENABLED_KEY, enabled ? '1' : '0');
}

const UPCOMING_REMINDER_LEAD_MINUTES_KEY = 'ripple_upcoming_reminder_lead_minutes';

const DEFAULT_UPCOMING_LEAD_MINUTES = 60;

/** Presets for Settings → how early upcoming reminders fire */
export const DEFAULT_UPCOMING_LEAD_OPTIONS_MINUTES = [15, 30, 45, 60, 90, 120] as const;

function snapUpcomingLeadToNearestPreset(minutes: number): number {
  const presets = DEFAULT_UPCOMING_LEAD_OPTIONS_MINUTES;
  if (presets.includes(minutes as (typeof presets)[number])) {
    return minutes;
  }
  return presets.reduce((best, p) =>
    Math.abs(p - minutes) < Math.abs(best - minutes) ? p : best,
  presets[0]);
}

export async function loadUpcomingReminderLeadMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(UPCOMING_REMINDER_LEAD_MINUTES_KEY);
    if (!raw) {
      return DEFAULT_UPCOMING_LEAD_MINUTES;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 24 * 60) {
      return DEFAULT_UPCOMING_LEAD_MINUTES;
    }
    return snapUpcomingLeadToNearestPreset(parsed);
  } catch {
    return DEFAULT_UPCOMING_LEAD_MINUTES;
  }
}

export async function saveUpcomingReminderLeadMinutes(minutes: number): Promise<void> {
  const n = Math.max(1, Math.min(24 * 60, Math.round(minutes)));
  await AsyncStorage.setItem(UPCOMING_REMINDER_LEAD_MINUTES_KEY, String(n));
}

/** Settings row subtitle, e.g. "1 hour before". */
export function formatUpcomingReminderLeadLabel(minutes: number): string {
  const n = Math.max(1, Math.round(minutes));
  if (n === 60) {
    return '1 hour before';
  }
  if (n >= 60 && n % 60 === 0) {
    const h = n / 60;
    return `${h} hour${h === 1 ? '' : 's'} before`;
  }
  return `${n} minute${n === 1 ? '' : 's'} before`;
}

const NOTIFICATIONS_MASTER_ENABLED_KEY = 'ripple_notifications_master_enabled';

/**
 * App-level gate for scheduling snooze/upcoming OS notifications (OS permission is separate).
 */
export async function loadNotificationsMasterEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_MASTER_ENABLED_KEY);
    if (raw === null) {
      return true;
    }
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export async function saveNotificationsMasterEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_MASTER_ENABLED_KEY, enabled ? '1' : '0');
}

const APP_THEME_KEY = 'ripple_app_theme_preference';

export const APP_THEME_OPTIONS = ['Light', 'Dark', 'Auto'] as const;

export type AppThemePreference = (typeof APP_THEME_OPTIONS)[number];

const DEFAULT_APP_THEME: AppThemePreference = 'Dark';

export { DEFAULT_APP_THEME };

function normalizeAppTheme(raw: string | null): AppThemePreference {
  if (!raw) {
    return DEFAULT_APP_THEME;
  }
  const match = APP_THEME_OPTIONS.find((t) => t === raw);
  return match ?? DEFAULT_APP_THEME;
}

export async function loadAppThemePreference(): Promise<AppThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(APP_THEME_KEY);
    return normalizeAppTheme(raw);
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export async function saveAppThemePreference(theme: AppThemePreference): Promise<void> {
  await AsyncStorage.setItem(APP_THEME_KEY, theme);
  bumpAppThemeGeneration();
}

let appThemeGeneration = 0;
const appThemeListeners = new Set<() => void>();

function bumpAppThemeGeneration(): void {
  appThemeGeneration += 1;
  for (const fn of appThemeListeners) {
    fn();
  }
}

export function subscribeAppThemeGeneration(onStoreChange: () => void): () => void {
  appThemeListeners.add(onStoreChange);
  return () => {
    appThemeListeners.delete(onStoreChange);
  };
}

export function getAppThemeGeneration(): number {
  return appThemeGeneration;
}
