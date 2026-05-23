/**
 * Parse alarm timestamps from the Ripple API / Supabase.
 * iOS JavaScriptCore rejects several formats that Android/V8 accepts (e.g. space instead of `T`).
 */
export function parseAlarmScheduledAt(raw: string): Date {
  const s = raw.trim();
  if (!s) {
    return new Date(NaN);
  }

  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d;
  }

  const withT = s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
  d = new Date(withT);
  if (!Number.isNaN(d.getTime())) {
    return d;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(withT) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(withT)) {
    d = new Date(`${withT}Z`);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }

  return new Date(NaN);
}

/** ISO-8601 UTC string for POST/PATCH `scheduled_at`. */
export function alarmScheduledAtToApiIso(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid alarm time. Tap the time to set it again.');
  }
  return d.toISOString();
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
  const hour24 = base.getHours();
  const isPm = hour24 >= 12;
  if (isPm && h < 12) {
    h += 12;
  } else if (!isPm && h >= 12) {
    h -= 12;
  }
  merged.setHours(h, selectedMinutes, 0, 0);
  return merged;
}
