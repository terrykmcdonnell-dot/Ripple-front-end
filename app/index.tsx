import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;

    const routeBySession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        router.replace(session ? '/alarm' : '/signin');
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    void routeBySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      router.replace(session ? '/alarm' : '/signin');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return <FullScreenLoadingOverlay visible={bootstrapping} />;
}
