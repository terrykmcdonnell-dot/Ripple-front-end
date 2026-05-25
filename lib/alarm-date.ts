/** Returns a backend-safe ISO timestamp, or null when the date cannot be serialized. */
export function toAlarmIsoString(value: Date): string | null {
  const time = value.getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  try {
    // Keep the payload conservative for Pydantic/PostgREST on all platforms:
    // UTC ISO, no milliseconds, explicit Z timezone.
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch {
    return null;
  }
}

/** iOS can be stricter with date strings that omit timezone info; normalize common API shapes. */
export function parseAlarmDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  const candidates = [
    raw,
    raw.includes('T') && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw}Z` : '',
    raw.includes(' ') ? raw.replace(' ', 'T') : '',
    raw.includes(' ') && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const d = new Date(candidate);
    if (Number.isFinite(d.getTime())) {
      return d;
    }
  }
  return null;
}
