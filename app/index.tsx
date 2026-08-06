import { usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import { consumeInitialAlarmFireResponse } from '@/lib/android-alarm-cold-start';
import {
  ensureAuthSessionFreshOrSignOut,
  refreshOrSignOutOnExpiredSession,
} from '@/lib/auth-session-errors';
import { replaceWithSignInIfNeeded } from '@/lib/auth-sign-in-redirect';
import { supabase } from '@/lib/supabase';

/** Local JWT still valid — route immediately without waiting on Auth server round-trip. */
function sessionLooksValidLocally(expiresAtSec: number | undefined): boolean {
  if (!expiresAtSec || expiresAtSec <= 0) {
    return true;
  }
  return expiresAtSec > Math.floor(Date.now() / 1000) + 30;
}

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const routedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const routeFromSession = (hasSession: boolean, openedFromAlarm: boolean) => {
      if (!mounted || routedRef.current) {
        return;
      }
      routedRef.current = true;
      if (hasSession) {
        if (!openedFromAlarm) {
          router.replace('/alarm');
        }
      } else {
        replaceWithSignInIfNeeded(pathname);
      }
      void SplashScreen.hideAsync().catch(() => undefined);
    };

    void (async () => {
      const [openedFromAlarm, sessionResult] = await Promise.all([
        consumeInitialAlarmFireResponse(),
        supabase.auth.getSession(),
      ]);
      let { session } = sessionResult.data;

      if (session && !sessionLooksValidLocally(session.expires_at)) {
        await refreshOrSignOutOnExpiredSession();
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }

      if (!mounted) {
        return;
      }

      routeFromSession(
        session != null && sessionLooksValidLocally(session.expires_at),
        openedFromAlarm,
      );

      InteractionManager.runAfterInteractions(() => {
        void ensureAuthSessionFreshOrSignOut();
      });
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (!mounted) {
        return;
      }
      if (session) {
        void consumeInitialAlarmFireResponse().then((openedFromAlarm) => {
          routeFromSession(true, openedFromAlarm);
        });
        return;
      }
      routedRef.current = false;
      replaceWithSignInIfNeeded(pathname);
      void SplashScreen.hideAsync().catch(() => undefined);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
