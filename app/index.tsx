import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { replaceWithSignInIfNeeded } from '@/lib/auth-sign-in-redirect';
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
      if (!mounted) {
        return;
      }
      if (session) {
        router.replace('/alarm');
      } else {
        replaceWithSignInIfNeeded(pathname);
      }
      setBootstrapping(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return <FullScreenLoadingOverlay visible={bootstrapping} />;
}
