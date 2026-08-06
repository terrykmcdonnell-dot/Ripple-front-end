import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import { ensureAuthSessionFreshOrSignOut } from '@/lib/auth-session-errors';
import { replaceWithSignInIfNeeded, isGuestAuthFlowPathname } from '@/lib/auth-sign-in-redirect';
import { supabase } from '@/lib/supabase';

/** Redirect to `/signin` when there is no Supabase session (protected app routes). */
export function useRequireAuth() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    // Validate on mount — expired JWT in AsyncStorage does not always emit SIGNED_OUT
    // until the next API call; this forces refresh-or-sign-out on protected screens.
    void (async () => {
      // Defer so cold-start navigation finishes before the Auth server round-trip.
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      const ok = await ensureAuthSessionFreshOrSignOut();
      if (!ok && !isGuestAuthFlowPathname(pathnameRef.current)) {
        replaceWithSignInIfNeeded(pathnameRef.current);
      }
    })();

    // Empty dependency array: the subscription is created once and stays active
    // for the lifetime of the component. We read the latest pathname via the ref
    // so we never need to tear down and re-create the listener on navigation.
    // Previously using [pathname] here caused unsubscribe → re-subscribe on every
    // route change, creating a window where a SIGNED_OUT event could be missed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        return;
      }
      if (isGuestAuthFlowPathname(pathnameRef.current)) {
        return;
      }
      replaceWithSignInIfNeeded(pathnameRef.current);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
