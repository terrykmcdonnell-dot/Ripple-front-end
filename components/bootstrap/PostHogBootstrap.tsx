import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import {
  createPostHogClient,
  getSharedPostHogClient,
  isPostHogConfigured,
  RIPPLE_POSTHOG_APP_NAME,
  setSharedPostHogClient,
} from '@/lib/posthog-client';
import { syncPostHogAndroidExactAlarmStatus } from '@/lib/posthog-analytics';
import { supabase } from '@/lib/supabase';

function PostHogAndroidExactAlarmSync() {
  useEffect(() => {
    if (!isPostHogConfigured() || Platform.OS !== 'android') {
      return;
    }

    void syncPostHogAndroidExactAlarmStatus();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncPostHogAndroidExactAlarmStatus();
      }
    });

    return () => sub.remove();
  }, []);

  return null;
}

function PostHogAuthSync() {
  useEffect(() => {
    if (!isPostHogConfigured()) {
      return;
    }

    const identifyFromSession = async () => {
      const client = getSharedPostHogClient();
      if (!client) {
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        client.identify(session.user.id, { app_name: RIPPLE_POSTHOG_APP_NAME });
        await syncPostHogAndroidExactAlarmStatus();
      }
    };

    void identifyFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const client = getSharedPostHogClient();
      if (!client) {
        return;
      }
      if (session?.user?.id) {
        client.identify(session.user.id, { app_name: RIPPLE_POSTHOG_APP_NAME });
        void syncPostHogAndroidExactAlarmStatus();
      } else {
        client.reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

type PostHogProviderShellProps = {
  children: ReactNode;
};

export function PostHogProviderShell({ children }: PostHogProviderShellProps) {
  const client = useMemo(() => createPostHogClient(), []);

  useEffect(() => {
    if (!client) {
      setSharedPostHogClient(null);
      return;
    }
    client.register({ app_name: RIPPLE_POSTHOG_APP_NAME });
    setSharedPostHogClient(client);
    return () => {
      setSharedPostHogClient(null);
    };
  }, [client]);

  if (!client || Platform.OS === 'web') {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={client} autocapture={false}>
      <PostHogAuthSync />
      <PostHogAndroidExactAlarmSync />
      {children}
    </PostHogProvider>
  );
}
