import { supabase } from '@/lib/supabase';

/** PostgREST / gateway errors when the access JWT is invalid or expired. */
const JWT_RELATED_PGRST = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

function errorMeta(error: unknown): { message: string; code?: string; status?: number } {
  if (error == null) {
    return { message: '' };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (error instanceof Error) {
    const e = error as Error & { code?: string; status?: number };
    return { message: e.message ?? '', code: e.code, status: e.status };
  }
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : '',
      code: typeof e.code === 'string' ? e.code : undefined,
      status: typeof e.status === 'number' ? e.status : undefined,
    };
  }
  return { message: '' };
}

/** True when the failure is almost certainly an expired or invalid Supabase JWT (session must refresh or end). */
export function isExpiredJwtOrSessionError(error: unknown): boolean {
  const { message, code, status } = errorMeta(error);
  const m = message.toLowerCase();
  const c = (code ?? '').toUpperCase();

  if (JWT_RELATED_PGRST.has(c)) {
    return true;
  }
  if (m.includes('jwt expired')) {
    return true;
  }
  if (m.includes('invalid jwt')) {
    return true;
  }
  if (m.includes('jwt') && m.includes('expir')) {
    return true;
  }
  if (status === 401 && (m.includes('jwt') || m.includes('token'))) {
    return true;
  }
  return false;
}

/** Seconds before access-token expiry when we proactively refresh (Supabase default JWT ≈ 3600s). */
const ACCESS_TOKEN_REFRESH_BUFFER_SEC = 30;

/**
 * Validates the stored session with Supabase Auth (refreshes when possible).
 * Signs out when the refresh token is invalid or expired so `SIGNED_OUT` routing runs.
 *
 * `getSession()` alone can return a locally cached access JWT that is already past
 * `expires_at` — especially after the app was backgrounded with `stopAutoRefresh()`.
 */
export async function ensureAuthSessionFreshOrSignOut(): Promise<boolean> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  if (expiresAt > 0 && expiresAt <= nowSec + ACCESS_TOKEN_REFRESH_BUFFER_SEC) {
    await refreshOrSignOutOnExpiredSession();
    const {
      data: { session: after },
    } = await supabase.auth.getSession();
    return after != null;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    if (isExpiredJwtOrSessionError(userError)) {
      await refreshOrSignOutOnExpiredSession();
      const {
        data: { session: after },
      } = await supabase.auth.getSession();
      return after != null;
    }
    // Network / transient — keep the cached session; do not force sign-out offline.
    return true;
  }

  if (!user) {
    await refreshOrSignOutOnExpiredSession();
    return false;
  }

  return true;
}

/**
 * Shared in-flight refresh so concurrent callers (e.g. two screens each hitting an expired-JWT
 * error at the same time) await the same `refreshSession()` attempt instead of each starting
 * their own — racing refreshes against each other can hang well past a normal deadline.
 */
let inFlightRefresh: Promise<void> | null = null;

/** After JWT errors: try one refresh; if still no session, sign out so routing sends user to sign-in. */
export async function refreshOrSignOutOnExpiredSession(): Promise<void> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (data.session && !error) {
        return;
      }
      // Refresh returned an error (revoked token, network failure, etc.) or no session.
      // Fall through to sign out.
    } catch {
      // refreshSession threw — treat as unrecoverable and force sign-out.
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut itself could fail on network loss; GoTrue will still clear local storage.
    }
  })();

  inFlightRefresh = request;
  try {
    await request;
  } finally {
    inFlightRefresh = null;
  }
}

/** Use before showing “missing profile” alerts — avoids a bogus dialog right after session cleared for JWT expiry. */
export async function shouldSkipAuthFailureAlerts(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session == null;
}
