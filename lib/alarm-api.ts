import { Platform } from 'react-native';

import { normalizeAlarmPayload, type AlarmListItem } from '@/lib/alarm-format';

const RIPPLE_FETCH_TIMEOUT_MS = 25_000;

async function rippleApiFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RIPPLE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || msg === 'Aborted' || msg.toLowerCase().includes('aborted'));
    if (isAbort) {
      throw new Error(
        `Ripple API timed out after ${RIPPLE_FETCH_TIMEOUT_MS / 1000}s. Check ${base || 'EXPO_PUBLIC_API_BASE_URL'} is reachable on this network.`,
      );
    }
    if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
      let detail =
        'Could not reach the Ripple API (no response). Check Wi‑Fi/cellular, VPN, firewall, and that the server is running.';
      if (Platform.OS !== 'web' && /localhost|127\.0\.0\.1/i.test(base)) {
        detail +=
          ' On a physical phone, localhost is the phone itself — use your PC’s LAN IP (e.g. http://192.168.1.10:8000). On Android emulator, try http://10.0.2.2:8000 for the host machine.';
      } else if (Platform.OS === 'android' && /^http:/i.test(base)) {
        detail +=
          ' Plain HTTP on Android may be blocked in release builds; prefer HTTPS or a dev client debug build with cleartext allowed.';
      }
      throw new Error(`${detail} (${msg})`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
  const res = await rippleApiFetch(url, {
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
  const res = await rippleApiFetch(url, {
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
  const res = await rippleApiFetch(url, {
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
  const res = await rippleApiFetch(url, {
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
  sound?: string;
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
    sound: row.sound,
    isEnabled: row.isEnabled,
  };
}
