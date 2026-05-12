import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * If the user already has a session, leave guest-only screens once on mount.
 *
 * Intentionally does **not** subscribe to `onAuthStateChange`: during sign-in / verify we
 * establish or upgrade the session in multiple async steps; a listener would navigate to
 * `/alarm` too early and can stack duplicate `replace` calls with explicit navigation.
 */
export function useRedirectIfAuthenticated() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled && session) {
        router.replace('/alarm');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
}
