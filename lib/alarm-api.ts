import { normalizeAlarmPayload, type AlarmListItem } from '@/lib/alarm-format';

export type CreateAlarmPayload = {
  user_id: number;
  label: string;
  scheduled_at: string;
  interval: number;
  unit: string;
  category: string;
  /** Human-readable sound name (matches bundled presets / Settings labels). */
  sound: string;
};

/** Backend origin for Ripple FastAPI (same env as other API modules). */
export function rippleApiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. Use your backend origin (e.g. http://localhost:8000). On an Android emulator, http://10.0.2.2:8000 often maps to the host machine.',
    );
  }
  return base.replace(/\/$/, '');
}

/** POST /api/alarm/ — body matches backend OpenAPI (user_id is `public.users.id`). */
export async function createAlarm(payload: CreateAlarmPayload): Promise<void> {
  const url = `${rippleApiBaseUrl()}/api/alarm/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    return;
  }

  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(detail || `Could not create alarm (${res.status}).`);
}

/** PATCH /api/alarm/{alarm_id}/ — any subset (toggle, edit fields). */
export type AlarmPatchPayload = {
  /** Body fields match backend alarms model (typically same names as POST create minus `user_id`). */
  label?: string;
  scheduled_at?: string;
  interval?: number;
  unit?: string;
  category?: string;
  sound?: string;
  is_enabled?: boolean;
};

/** PATCH /api/alarm/{alarm_id}/ — partial update (alarm list toggle or edit-screen save). */
export async function patchAlarm(alarmId: number, body: AlarmPatchPayload): Promise<void> {
  const url = `${rippleApiBaseUrl()}/api/alarm/${alarmId}/`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    return;
  }
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(detail || `Could not update alarm (${res.status}).`);
}

/** DELETE /api/alarm/{alarm_id}/ — remove alarm row on backend. */
export async function deleteAlarm(alarmId: number): Promise<void> {
  const url = `${rippleApiBaseUrl()}/api/alarm/${alarmId}/`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (res.ok || res.status === 204) {
    return;
  }
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    /* ignore */
  }
  throw new Error(detail || `Could not delete alarm (${res.status}).`);
}

/** GET /api/alarm/?user_id= — list alarms for the given `public.users.id`. */
export async function fetchAlarms(userId: number): Promise<AlarmListItem[]> {
  const qs = new URLSearchParams({ user_id: String(userId) });
  const url = `${rippleApiBaseUrl()}/api/alarm/?${qs.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Could not load alarms (${res.status}).`);
  }

  const body = (await res.json()) as unknown;
  let rawItems: unknown[] = [];
  if (Array.isArray(body)) {
    rawItems = body;
  } else if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.items)) {
      rawItems = o.items;
    } else if (Array.isArray(o.data)) {
      rawItems = o.data;
    } else if (Array.isArray(o.results)) {
      rawItems = o.results;
    }
  }

  return rawItems
    .map((row) => normalizeAlarmPayload(row))
    .filter((row): row is AlarmListItem => row != null);
}

/** Single alarm for edit flow (resolved from user-scoped GET list until a dedicated GET-by-id exists). */
export async function fetchAlarmForEdit(alarmId: number, userId: number): Promise<{
  scheduledAt: string;
  label: string;
  interval: number;
  unit: string;
  /** Pass-through for {@link categoryIdToChipKey} (`string` label or FK `number`). */
  categoryId: string | number;
  isEnabled: boolean;
} | null> {
  const rows = await fetchAlarms(userId);
  const row = rows.find((r) => r.id === alarmId);
  if (!row) {
    return null;
  }
  return {
    scheduledAt: row.scheduledAt,
    label: row.label,
    interval: row.interval,
    unit: row.unit,
    categoryId: row.category,
    isEnabled: row.isEnabled,
  };
}
