import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { replaceWithSignInIfNeeded, isGuestAuthFlowPathname } from '@/lib/auth-sign-in-redirect';
import { isScreenshotMode } from '@/lib/screenshot-mode';
import { supabase } from '@/lib/supabase';

/** Redirect to `/signin` when there is no Supabase session (protected app routes). */
export function useRequireAuth() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (isScreenshotMode()) {
      return;
    }

    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || session) {
        return;
      }
      if (isGuestAuthFlowPathname(pathnameRef.current)) {
        return;
      }
      replaceWithSignInIfNeeded(pathnameRef.current);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);
}
