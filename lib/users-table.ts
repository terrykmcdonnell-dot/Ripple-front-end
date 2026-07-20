import { withDeadline } from '@/lib/async-deadline';
import { ensureUsersRowFromAuthUser } from '@/lib/sync-user-profile';
import { supabase } from '@/lib/supabase';
import { isExpiredJwtOrSessionError, refreshOrSignOutOnExpiredSession } from '@/lib/auth-session-errors';

const USER_ROW_FETCH_TIMEOUT_MS = 25_000;

let cachedUserRowId: { email: string; id: number } | null = null;

/**
 * Shared in-flight request so concurrent callers (e.g. the alarm-ring screen firing
 * `recordAlarmHistoryDismissed` + `syncAlarmFireNotifications` in the same tick) await the
 * same lookup instead of each starting their own `getSession()`/`refreshSession()` call —
 * racing refreshes against each other is what caused the intermittent 25 s dismiss hang.
 */
let inFlightFetch: Promise<{ id: number | null; error: Error | null }> | null = null;

export function invalidateCurrentUserRowIdCache(): void {
  cachedUserRowId = null;
}

function coerceNumericId(value: unknown): number | null {
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

async function selectUsersRowByEmail(email: string) {
  return supabase.from('users').select('id').eq('email', email).maybeSingle();
}

/** `public.users.id` for the signed-in user (matched by Auth email ↔ `users.email`). */
export async function fetchCurrentUserRowId(): Promise<{ id: number | null; error: Error | null }> {
  if (inFlightFetch) {
    return inFlightFetch;
  }

  const request = (async () => {
    try {
      return await withDeadline(resolveCurrentUserRowId(), USER_ROW_FETCH_TIMEOUT_MS, 'Loading your profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load your profile.';
      return { id: null, error: new Error(message) };
    }
  })();

  inFlightFetch = request;
  try {
    return await request;
  } finally {
    inFlightFetch = null;
  }
}

async function resolveCurrentUserRowId(): Promise<{ id: number | null; error: Error | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { id: null, error: new Error('You must be signed in to save alarms.') };
  }

  if (cachedUserRowId?.email === email) {
    return { id: cachedUserRowId.id, error: null };
  }

  let { data, error } = await selectUsersRowByEmail(email);

  if (error && isExpiredJwtOrSessionError(error)) {
    await refreshOrSignOutOnExpiredSession();
    const {
      data: { session: after },
    } = await supabase.auth.getSession();
    if (!after) {
      return { id: null, error: null };
    }
    ({ data, error } = await selectUsersRowByEmail(email));
  }

  if (error) {
    if (isExpiredJwtOrSessionError(error)) {
      await supabase.auth.signOut();
      return { id: null, error: null };
    }
    return { id: null, error };
  }

  let resolvedId = coerceNumericId(data?.id);
  const authUser = session?.user;
  if (resolvedId == null && authUser) {
    const { error: ensureError } = await ensureUsersRowFromAuthUser(authUser);
    if (ensureError) {
      const message =
        ensureError && typeof ensureError === 'object' && 'message' in ensureError
          ? String((ensureError as { message?: unknown }).message ?? ensureError)
          : String(ensureError);
      return { id: null, error: new Error(message || 'Could not create your profile.') };
    }
    const retry = await selectUsersRowByEmail(email);
    if (retry.error) {
      return { id: null, error: new Error(retry.error.message ?? 'Could not load your profile.') };
    }
    resolvedId = coerceNumericId(retry.data?.id);
  }

  if (resolvedId == null) {
    return {
      id: null,
      error: new Error('Could not find your profile in the users table. Try signing out and back in.'),
    };
  }

  cachedUserRowId = { email, id: resolvedId };
  return { id: resolvedId, error: null };
}
