import { clockPartsFromDate } from '@/lib/alarm-time';

/**
 * Parse alarm timestamps from the Ripple API / Supabase (`timestamptz`).
 * Sample: `2026-04-30 20:40:00+00`
 *
 * iOS JavaScriptCore is stricter than Android/V8:
 * - `2026-04-30T20:40:00+00` is invalid (offset needs `:00`)
 * - blind space→`T` replacement breaks valid Postgres strings
 */
export function parseAlarmScheduledAt(raw: string): Date {
  const s = raw.trim();
  if (!s) {
    return new Date(NaN);
  }

  const candidates = [s, normalizePostgresTimestamptz(s)];
  for (const candidate of candidates) {
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }

  return new Date(NaN);
}

/** `+00` / `+0530` → `+00:00` / `+05:30`; space date → `T` only when needed. */
function normalizePostgresTimestamptz(s: string): string {
  let t = s.trim();
  if (t.includes(' ') && !t.includes('T')) {
    t = t.replace(' ', 'T');
  }
  if (/[+-]\d{2}$/.test(t)) {
    t = `${t}:00`;
  } else if (/[+-]\d{4}$/.test(t)) {
    t = `${t.slice(0, -2)}:${t.slice(-2)}`;
  }
  return t;
}

/**
 * Serialize alarm time for POST/PATCH `scheduled_at` (Supabase `timestamptz` habit).
 * Uses UTC with `+00` offset, e.g. `2026-04-30 20:40:00+00`.
 */
export function alarmScheduledAtToApiIso(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid alarm time. Tap the time to set it again.');
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const sec = pad(d.getUTCSeconds());
  return `${y}-${mo}-${day} ${h}:${mi}:${sec}+00`;
}

/**
 * Merge iOS time-picker hours with the separate AM/PM control.
 * The spinner often reports 0–11 even when the row shows PM.
 */
export function mergeIosTimePickerHours(
  base: Date,
  selectedHours: number,
  selectedMinutes: number,
): Date {
  const merged = new Date(base);
  let h = selectedHours;
  const { meridiem } = clockPartsFromDate(base);
  if (meridiem === 'PM' && h < 12) {
    h += 12;
  } else if (meridiem === 'AM' && h >= 12) {
    h -= 12;
  }
  merged.setHours(h, selectedMinutes, 0, 0);
  return merged;
}
