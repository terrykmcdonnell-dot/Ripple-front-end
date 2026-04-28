import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/** Redirect to `/signin` when there is no Supabase session (protected app routes). */
export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted && !session) {
        router.replace('/signin');
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && !session) {
        router.replace('/signin');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);
}
