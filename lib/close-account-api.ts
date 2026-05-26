import { rippleApiBaseUrl } from '@/lib/alarm-api';
import { supabase } from '@/lib/supabase';

const CLOSE_ACCOUNT_TIMEOUT_MS = 45_000;

/** POST /api/account/close — deletes cloud data and Supabase Auth user (requires session). */
export async function closeAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();
  if (!token) {
    throw new Error('You must be signed in to close your account.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLOSE_ACCOUNT_TIMEOUT_MS);
  try {
    const res = await fetch(`${rippleApiBaseUrl()}/api/account/close`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (res.status === 204 || res.ok) {
      return;
    }
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Could not close account (${res.status}).`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Aborted' || msg.toLowerCase().includes('aborted')) {
      throw new Error(`Ripple API timed out after ${CLOSE_ACCOUNT_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
