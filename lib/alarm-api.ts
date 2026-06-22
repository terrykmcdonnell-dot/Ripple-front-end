import { Platform } from 'react-native';

import { withDeadline } from '@/lib/async-deadline';
import { normalizeAlarmPayload, type AlarmListItem } from '@/lib/alarm-format';

const RIPPLE_FETCH_TIMEOUT_MS = 30_000;
const RIPPLE_BODY_READ_TIMEOUT_MS = 20_000;
const RIPPLE_GET_TOTAL_TIMEOUT_MS = 60_000;
const RIPPLE_WRITE_TIMEOUT_MS = 45_000;
const RIPPLE_FETCH_MAX_ATTEMPTS = 3;
const RIPPLE_FETCH_RETRY_BASE_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isTransientRippleFetchError(err: unknown): boolean {
  if (err instanceof RippleApiError) {
    return isTransientHttpStatus(err.status);
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timed out')) {
      return true;
    }
    if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
      return true;
    }
  }
  return false;
}

/** Thrown when the Ripple FastAPI responds with a non-2xx status (carries HTTP status for UI mapping). */
export class RippleApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RippleApiError';
    this.status = status;
  }
}

function parseRippleApiErrorBody(raw: string, status: number): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof parsed.detail === 'string') {
      return parsed.detail;
    }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ');
    }
  } catch {
    /* plain text body */
  }
  return trimmed;
}

function throwRippleApiHttpError(status: number, rawBody: string, fallback: string): never {
  const detail = parseRippleApiErrorBody(rawBody, status);
  throw new RippleApiError(detail || fallback, status);
}

function throwRippleFetchError(err: unknown, timeoutMs: number): never {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  const isAbort =
    err instanceof Error &&
    (err.name === 'AbortError' || msg === 'Aborted' || msg.toLowerCase().includes('aborted'));
  if (isAbort) {
    throw new Error(
      `Ripple API timed out after ${timeoutMs / 1000}s. Check ${base || 'EXPO_PUBLIC_API_BASE_URL'} is reachable on this network.`,
    );
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    let detail =
      'Could not reach the Ripple API (no response). Check Wi‑Fi/cellular, VPN, firewall, and that the server is running.';
    if (Platform.OS !== 'web' && /localhost|127\.0\.0\.1/i.test(base)) {
      detail +=
        ' On a physical phone, localhost is the phone itself — use your PC’s LAN IP (e.g. http://192.168.1.10:8001). On Android emulator, try http://10.0.2.2:8001 for the host machine.';
    } else if (Platform.OS === 'ios' && /^http:/i.test(base)) {
      detail +=
        ' iOS can block plain HTTP unless App Transport Security allows it in the native build; use HTTPS for TestFlight/production or rebuild the app after changing app.json.';
    } else if (Platform.OS === 'android' && /^http:/i.test(base)) {
      detail +=
        ' Plain HTTP on Android may be blocked in release builds; prefer HTTPS or a dev client debug build with cleartext allowed.';
    }
    throw new Error(`${detail} (${msg})`);
  }
  throw err;
}

async function rippleReadResponseText(res: Response): Promise<string> {
  try {
    return await withDeadline(res.text(), RIPPLE_BODY_READ_TIMEOUT_MS, 'Ripple API response');
  } catch {
    return '';
  }
}

async function rippleReadResponseJson(res: Response): Promise<unknown> {
  return withDeadline(res.json(), RIPPLE_BODY_READ_TIMEOUT_MS, 'Ripple API response');
}

async function rippleTimedFetch(
  url: string,
  init?: RequestInit,
  timeoutMs: number = RIPPLE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    throwRippleFetchError(err, timeoutMs);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rippleApiFetchWithRetryAttempts(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RIPPLE_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await rippleTimedFetch(url, init, RIPPLE_FETCH_TIMEOUT_MS);
      if (res.ok || !isTransientHttpStatus(res.status)) {
        return res;
      }
      const detail = await rippleReadResponseText(res);
      lastError = new RippleApiError(
        parseRippleApiErrorBody(detail, res.status) || `Request failed (${res.status}).`,
        res.status,
      );
    } catch (err) {
      lastError = err;
      if (!isTransientRippleFetchError(err)) {
        throw err;
      }
    }
    if (attempt < RIPPLE_FETCH_MAX_ATTEMPTS - 1) {
      await sleep(RIPPLE_FETCH_RETRY_BASE_MS * (attempt + 1));
    }
  }
  throw lastError;
}

async function rippleApiFetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  return withDeadline(
    rippleApiFetchWithRetryAttempts(url, init),
    RIPPLE_GET_TOTAL_TIMEOUT_MS,
    'Ripple API request',
  );
}

async function rippleApiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  if (method === 'GET') {
    return rippleApiFetchWithRetry(url, init);
  }
  return rippleTimedFetch(url, init, RIPPLE_FETCH_TIMEOUT_MS);
}

/** GET with retry, per-attempt timeout, body-read timeout, and a hard total deadline. */
export async function rippleApiGetJson(url: string): Promise<unknown> {
  const res = await rippleApiFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await rippleReadResponseText(res);
    throwRippleApiHttpError(res.status, detail, `Request failed (${res.status}).`);
  }
  return rippleReadResponseJson(res);
}

export type CreateAlarmPayload = {
  user_id: number;
  label: string;
  scheduled_at: string;
  interval: number;
  unit: string;
  category: string;
  category_id?: number;
  /** Human-readable sound name (matches bundled presets / Settings labels). */
  sound: string;
};

/** Backend origin for Ripple FastAPI (same env as other API modules). */
export function rippleApiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. Use your backend origin (e.g. http://localhost:8001). On an Android emulator, http://10.0.2.2:8001 often maps to the host machine.',
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

  const detail = await rippleReadResponseText(res);
  throwRippleApiHttpError(res.status, detail, `Could not create alarm (${res.status}).`);
}

/** PATCH /api/alarm/{alarm_id}/ — any subset (toggle, edit fields). */
export type AlarmPatchPayload = {
  /** Body fields match backend alarms model (typically same names as POST create minus `user_id`). */
  label?: string;
  scheduled_at?: string;
  interval?: number;
  unit?: string;
  category?: string;
  category_id?: number;
  sound?: string;
  is_enabled?: boolean;
};

/** POST /api/alarm/{alarm_id}/update — same body as PATCH; avoids proxies/WAFs that stall PATCH. */
export async function patchAlarm(alarmId: number, body: AlarmPatchPayload): Promise<void> {
  const url = `${rippleApiBaseUrl()}/api/alarm/${alarmId}/update`;
  const res = await rippleTimedFetch(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    RIPPLE_WRITE_TIMEOUT_MS,
  );
  if (res.ok) {
    return;
  }
  const detail = await rippleReadResponseText(res);
  throwRippleApiHttpError(
    res.status,
    detail,
    detail ? `Alarm update failed (${res.status}): ${detail}` : `Could not update alarm (${res.status}).`,
  );
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
  const detail = await rippleReadResponseText(res);
  throwRippleApiHttpError(res.status, detail, `Could not delete alarm (${res.status}).`);
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
    const detail = await rippleReadResponseText(res);
    throwRippleApiHttpError(res.status, detail, `Could not load alarms (${res.status}).`);
  }

  const body = (await rippleReadResponseJson(res)) as unknown;
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

/** Single alarm for edit flow (GET by id; scoped to the signed-in user). */
export async function fetchAlarmForEdit(alarmId: number, userId: number): Promise<{
  scheduledAt: string;
  label: string;
  interval: number;
  unit: string;
  categoryId: string | number;
  categoryName: string;
  sound?: string;
  isEnabled: boolean;
} | null> {
  const url = `${rippleApiBaseUrl()}/api/alarm/${alarmId}`;
  const res = await rippleApiFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const detail = await rippleReadResponseText(res);
    throwRippleApiHttpError(res.status, detail, `Could not load alarm (${res.status}).`);
  }
  const body = (await rippleReadResponseJson(res)) as Record<string, unknown>;
  const ownerId = body.user_id ?? body.userId;
  if (Number(ownerId) !== userId) {
    return null;
  }
  const row = normalizeAlarmPayload(body);
  if (!row) {
    return null;
  }
  return {
    scheduledAt: row.scheduledAt,
    label: row.label,
    interval: row.interval,
    unit: row.unit,
    categoryId: Number(body.category_id ?? body.categoryId) || row.category,
    categoryName: row.category,
    sound: row.sound,
    isEnabled: row.isEnabled,
  };
}
