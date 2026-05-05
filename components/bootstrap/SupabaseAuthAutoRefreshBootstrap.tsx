import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * React Native cannot detect foreground like a browser tab. Supabase recommends tying
 * `startAutoRefresh` / `stopAutoRefresh` to AppState so tokens refresh when the user returns,
 * and background work does not rely on a stalled ticker. When the access token is expired,
 * `getSession()` triggers a refresh; if refresh fails, GoTrue removes storage and emits
 * `SIGNED_OUT` — `useRequireAuth` / index routing then send users to sign-in.
 */
export function SupabaseAuthAutoRefreshBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void supabase.auth.startAutoRefresh();
        void supabase.auth.getSession();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    onChange(AppState.currentState);

    return () => {
      sub.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  return null;
}
