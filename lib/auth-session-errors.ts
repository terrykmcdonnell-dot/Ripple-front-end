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

/** After JWT errors: try one refresh; if still no session, sign out so routing sends user to sign-in. */
export async function refreshOrSignOutOnExpiredSession(): Promise<void> {
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
}

/** Use before showing “missing profile” alerts — avoids a bogus dialog right after session cleared for JWT expiry. */
export async function shouldSkipAuthFailureAlerts(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session == null;
}
