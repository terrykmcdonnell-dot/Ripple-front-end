import { createCategoryIcons } from '@/assets/icons/alarm-create-icons';
import { alarmTheme, type AlarmTone } from '@/components/alarms/theme';

/** Parsed row from GET /api/alarm/ (handles snake_case or camelCase from the API). */
export type AlarmListItem = {
  id: number;
  label: string;
  scheduledAt: string;
  interval: number;
  unit: string;
  category: string;
  sound?: string;
  isEnabled: boolean;
};

function coerceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

export function normalizeAlarmPayload(raw: unknown): AlarmListItem | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = coerceId(row.id);
  if (id == null) {
    return null;
  }

  const scheduledAt =
    (typeof row.scheduled_at === 'string' && row.scheduled_at) ||
    (typeof row.scheduledAt === 'string' && row.scheduledAt) ||
    '';
  if (!scheduledAt) {
    return null;
  }

  const label = typeof row.label === 'string' ? row.label : '';
  const interval =
    typeof row.interval === 'number'
      ? row.interval
      : typeof row.interval === 'string'
        ? Number(row.interval)
        : 0;

  const unit =
    typeof row.unit === 'string' ? row.unit : typeof row.unit === 'number' ? String(row.unit) : '';

  const category = typeof row.category === 'string' ? row.category : '';

  const rawSound = row.sound ?? row.Sound ?? row.alarm_sound;
  const soundTrimmed = typeof rawSound === 'string' ? rawSound.trim() : '';

  const isEnabled =
    typeof row.is_enabled === 'boolean'
      ? row.is_enabled
      : typeof row.isEnabled === 'boolean'
        ? row.isEnabled
        : true;

  return {
    id,
    label,
    scheduledAt,
    interval: Number.isFinite(interval) ? interval : 1,
    unit: unit || 'Days',
    category,
    ...(soundTrimmed ? { sound: soundTrimmed } : {}),
    isEnabled,
  };
}

/** Must match repeating-unit chips used in alarm-create / alarm-edit. */
const UNIT_CHIPS = ['Hours', 'Days', 'Weeks', 'Months'] as const;
export type AlarmUnitChip = (typeof UNIT_CHIPS)[number];

/** Normalizes backend unit strings (`day`, `"Days"`, etc.) onto edit-screen chips. */
export function coerceAlarmUnit(raw: unknown): AlarmUnitChip {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const map: Record<string, AlarmUnitChip> = {
    hour: 'Hours',
    hours: 'Hours',
    day: 'Days',
    days: 'Days',
    week: 'Weeks',
    weeks: 'Weeks',
    month: 'Months',
    months: 'Months',
  };
  const hitMap = map[s];
  if (hitMap) {
    return hitMap;
  }

  const direct = UNIT_CHIPS.find((u) => u.toLowerCase() === s);
  if (direct) {
    return direct;
  }
  return 'Days';
}

export type CategoryChipKey = keyof typeof createCategoryIcons;

/**
 * Turns API category (numeric FK and/or human label string) into the chip `key`
 * used on create/edit screens.
 */
export function categoryIdToChipKey(categoryRef: unknown): CategoryChipKey {
  if (typeof categoryRef === 'number' && Number.isFinite(categoryRef)) {
    const n = Math.trunc(categoryRef);
    const byFk: Partial<Record<number, CategoryChipKey>> = {
      1: 'health',
      2: 'plants',
      3: 'maintenance',
      4: 'pets',
      5: 'work',
      6: 'custom',
    };
    const byId = byFk[n];
    if (byId) {
      return byId;
    }
  }

  if (typeof categoryRef === 'string') {
    const k = resolveCategoryIconKey(categoryRef);
    if (k !== 'unknown') {
      return k;
    }
  }

  return 'health';
}

/** 12-hour time parts in the device’s local timezone. */
export function formatScheduledLocalParts(isoUtc: string): { time: string; ampm: 'AM' | 'PM' } {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    return { time: '—', ampm: 'AM' };
  }
  const hour24 = d.getHours();
  const minute = d.getMinutes();
  const hour12 = hour24 % 12 || 12;
  const time = `${hour12}:${String(minute).padStart(2, '0')}`;
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  return { time, ampm };
}

export function formatRepeatEveryTag(interval: number, unit: string): string {
  const u = unit.trim();
  const n = interval > 0 ? interval : 1;
  return `↻ Every ${n} ${u}`;
}

export type CategoryPresentation = {
  icon: string;
  tone: AlarmTone;
  toggleOnColor?: string;
};

type CategoryIconKey = keyof typeof createCategoryIcons;

/** Resolves backend / API category labels to keys used by {@link createCategoryIcons}. */
function resolveCategoryIconKey(category: string): CategoryIconKey | 'unknown' {
  const raw = category.trim().toLowerCase();

  const exact = {
    health: 'health',
    plants: 'plants',
    plant: 'plants',
    maintenance: 'maintenance',
    pets: 'pets',
    pet: 'pets',
    work: 'work',
    custom: 'custom',
  } satisfies Record<string, CategoryIconKey>;

  if (raw in exact) {
    return exact[raw as keyof typeof exact];
  }
  // Substrings for partial / legacy labels ("Health reminders", etc.)
  if (raw.includes('plant')) {
    return 'plants';
  }
  if (raw.includes('maint')) {
    return 'maintenance';
  }
  if (raw.includes('health')) {
    return 'health';
  }
  if (raw.includes('pet')) {
    return 'pets';
  }
  if (raw.includes('work')) {
    return 'work';
  }
  if (raw.includes('custom')) {
    return 'custom';
  }

  return 'unknown';
}

function iconForCategoryKey(key: CategoryIconKey | 'unknown'): string {
  return key === 'unknown' ? createCategoryIcons.health : createCategoryIcons[key];
}

/** When the alarm row is toggled ON, stripe / icon chip colors follow category. */
function toneWhenEnabledForCategoryKey(key: CategoryIconKey | 'unknown'): {
  tone: AlarmTone;
  toggleOnColor?: string;
} {
  switch (key) {
    case 'plants':
      return { tone: 'green', toggleOnColor: alarmTheme.green };
    case 'maintenance':
      return { tone: 'amber' };
    case 'pets':
      return { tone: 'amber' };
    case 'work':
      return { tone: 'purple' };
    case 'custom':
      return { tone: 'purple' };
    case 'health':
      return { tone: 'purple' };
    default:
      return { tone: 'purple' };
  }
}

/**
 * Keeps category emoji consistent with alarm-create chips (`createCategoryIcons`).
 * Disabled rows still show that category’s icon; only stripe / chip tone uses `off`.
 */
export function presentationForAlarmCategory(category: string, enabled: boolean): CategoryPresentation {
  const key = resolveCategoryIconKey(category);
  const icon = iconForCategoryKey(key);

  if (!enabled) {
    return { icon, tone: 'off' };
  }

  const { tone, toggleOnColor } = toneWhenEnabledForCategoryKey(key);
  return { icon, tone, toggleOnColor };
}
