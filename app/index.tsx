import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { consumeInitialAlarmFireResponse } from '@/lib/android-alarm-cold-start';
import { replaceWithSignInIfNeeded } from '@/lib/auth-sign-in-redirect';
import { isScreenshotMode } from '@/lib/screenshot-mode';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!mounted) {
          return;
        }
        if (session) {
          const openedFromAlarm = await consumeInitialAlarmFireResponse();
          if (!openedFromAlarm) {
            router.replace(isScreenshotMode() ? '/screenshots' : '/alarm');
          }
        } else if (isScreenshotMode()) {
          router.replace('/screenshots');
        } else {
          replaceWithSignInIfNeeded(pathname);
        }
        if (mounted) {
          setBootstrapping(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return <FullScreenLoadingOverlay visible={bootstrapping} />;
}
