import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { ensureAuthSessionFreshOrSignOut } from '@/lib/auth-session-errors';
import { supabase } from '@/lib/supabase';

/** Re-check session while app stays in foreground (access JWT default ≈ 1 hour). */
const SESSION_VALIDATION_INTERVAL_MS = 60_000;

/**
 * React Native cannot detect foreground like a browser tab. Supabase recommends tying
 * `startAutoRefresh` / `stopAutoRefresh` to AppState so tokens refresh when the user returns.
 *
 * We also call {@link ensureAuthSessionFreshOrSignOut} on foreground and every minute while
 * active: `getSession()` can keep an expired access token in memory until an API fails.
 * Failed refresh signs out and emits `SIGNED_OUT` — `useRequireAuth` sends users to sign-in.
 */
export function SupabaseAuthAutoRefreshBootstrap() {
  useEffect(() => {
    let validationInterval: ReturnType<typeof setInterval> | null = null;
    let coldStart = true;

    const clearValidationInterval = () => {
      if (validationInterval != null) {
        clearInterval(validationInterval);
        validationInterval = null;
      }
    };

    const startValidationInterval = () => {
      clearValidationInterval();
      validationInterval = setInterval(() => {
        void ensureAuthSessionFreshOrSignOut();
      }, SESSION_VALIDATION_INTERVAL_MS);
    };

    const scheduleSessionValidation = (deferForColdStart: boolean) => {
      if (deferForColdStart) {
        setTimeout(() => {
          void ensureAuthSessionFreshOrSignOut();
        }, 2500);
        return;
      }
      void ensureAuthSessionFreshOrSignOut();
    };

    if (Platform.OS === 'web') {
      scheduleSessionValidation(false);
      startValidationInterval();
      return () => {
        clearValidationInterval();
      };
    }

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void supabase.auth.startAutoRefresh();
        scheduleSessionValidation(coldStart);
        coldStart = false;
        startValidationInterval();
      } else {
        clearValidationInterval();
        void supabase.auth.stopAutoRefresh();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    onChange(AppState.currentState);

    return () => {
      sub.remove();
      clearValidationInterval();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  return null;
}
