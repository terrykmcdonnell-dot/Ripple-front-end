import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isSentryConfigured } from '@/lib/sentry-client';
import { supabase } from '@/lib/supabase';

export function SentryAuthSync() {
  useEffect(() => {
    if (!isSentryConfigured()) {
      return;
    }

    const syncUserFromSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        Sentry.setUser({ id: session.user.id });
      } else {
        Sentry.setUser(null);
      }
    };

    void syncUserFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        Sentry.setUser({ id: session.user.id });
      } else {
        Sentry.setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (Platform.OS === 'web' || !isSentryConfigured()) {
    return null;
  }

  return null;
}
