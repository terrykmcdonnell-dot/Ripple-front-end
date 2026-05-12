import { router } from 'expo-router';

const DEDUP_MS = 1200;
let lastSignInReplaceAt = 0;

/** Path suffixes for routes where **no** session is normal (sign-in/up/recovery). */
const GUEST_AUTH_SUFFIXES = [
  '/signin',
  '/login',
  '/signup',
  '/verify',
  '/forgot-password',
  '/reset-password',
] as const;

/**
 * True on email/password/social entry flows (including Expo groups, e.g. paths ending in `/signup`).
 */
export function isGuestAuthFlowPathname(pathname: string | undefined): boolean {
  const raw = pathname ?? '';
  const p = raw.split('?')[0] ?? '';
  if (!p || p === '/') {
    return false;
  }
  return GUEST_AUTH_SUFFIXES.some((suffix) => p.endsWith(suffix));
}

/**
 * When the session ends, many screens mount `useRequireAuth` / `index` listeners, so Supabase
 * emits one `SIGNED_OUT` but we previously called `router.replace('/signin')` once per subscriber.
 * This collapses those into a single navigation.
 */
export function replaceWithSignInIfNeeded(currentPathname: string | undefined) {
  if (isGuestAuthFlowPathname(currentPathname)) {
    return;
  }
  const now = Date.now();
  if (now - lastSignInReplaceAt < DEDUP_MS) {
    return;
  }
  lastSignInReplaceAt = now;
  router.replace('/signin');
}
