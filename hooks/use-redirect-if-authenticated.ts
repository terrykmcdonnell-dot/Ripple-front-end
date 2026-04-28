import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/** Send users with an active session to `/alarm` (guest-only routes: sign-in, sign-up, verify). */
export function useRedirectIfAuthenticated() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted && session) {
        router.replace('/alarm');
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) {
        router.replace('/alarm');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);
}
