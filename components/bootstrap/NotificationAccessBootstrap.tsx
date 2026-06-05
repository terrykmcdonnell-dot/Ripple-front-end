import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { getNotificationAccessStatus } from '@/lib/notification-access-status';
import { requestNotificationAccess } from '@/lib/request-notification-access';
import { supabase } from '@/lib/supabase';

const WARN_KEY = 'ripple_notification_access_warn_v1';
/** Re-prompt once per day on app open when alerts stay disabled. */
const WARN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let shownModalThisSession = false;

/**
 * When the user is signed in but notifications are off (OS denied or in-app master off),
 * shows a themed modal after login and periodically while using the app.
 */
export function NotificationAccessBootstrap() {
  const [visible, setVisible] = useState(false);
  const [body, setBody] = useState('');
  const [primaryLabel, setPrimaryLabel] = useState('Enable Notifications');
  const hasSessionRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    let promptTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPromptTimer = () => {
      if (promptTimer != null) {
        clearTimeout(promptTimer);
        promptTimer = null;
      }
    };

    const schedulePrompt = (forceAfterLogin: boolean) => {
      clearPromptTimer();
      promptTimer = setTimeout(() => {
        promptTimer = null;
        void maybePrompt(forceAfterLogin);
      }, forceAfterLogin ? 900 : 2800);
    };

    const maybePrompt = async (forceAfterLogin: boolean) => {
      if (cancelled || !hasSessionRef.current) {
        return;
      }

      const status = await getNotificationAccessStatus();
      if (cancelled || status.alertsFullyEnabled) {
        setVisible(false);
        return;
      }

      if (shownModalThisSession) {
        return;
      }

      if (!forceAfterLogin) {
        const raw = await AsyncStorage.getItem(WARN_KEY);
        const lastShown = raw ? Number(raw) : 0;
        const now = Date.now();
        if (Number.isFinite(lastShown) && now - lastShown < WARN_INTERVAL_MS) {
          return;
        }
        await AsyncStorage.setItem(WARN_KEY, String(now));
      }

      shownModalThisSession = true;

      if (!status.osAllowed) {
        setBody(
          status.canAskAgain
            ? 'Ripple needs notification permission so alarms can ring on your lock screen.\n\nTap Enable to allow alerts and sounds.'
            : 'Notifications are blocked for Ripple in your phone settings.\n\nOpen Settings and turn notifications ON so alarms can ring.',
        );
        setPrimaryLabel(status.canAskAgain ? 'Enable Notifications' : 'Open Settings');
      } else {
        setBody(
          'Notifications are turned off inside Ripple.\n\nEnable them so scheduled alarms and reminders can fire.',
        );
        setPrimaryLabel('Turn On Notifications');
      }

      if (!cancelled) {
        setVisible(true);
      }
    };

    const refreshAccess = async () => {
      const status = await getNotificationAccessStatus();
      if (status.alertsFullyEnabled) {
        setVisible(false);
      }
    };

    void (async () => {
      const { data } = await supabase.auth.getSession();
      hasSessionRef.current = !!data.session;
      if (hasSessionRef.current) {
        schedulePrompt(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      hasSessionRef.current = !!session;
      if (!session) {
        clearPromptTimer();
        setVisible(false);
        return;
      }
      if (event === 'SIGNED_IN') {
        schedulePrompt(true);
        return;
      }
      if (event === 'INITIAL_SESSION') {
        schedulePrompt(false);
      }
    });

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && hasSessionRef.current) {
        void refreshAccess();
      }
    });

    return () => {
      cancelled = true;
      clearPromptTimer();
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const dismiss = () => setVisible(false);

  return (
    <AppConfirmModal
      visible={visible}
      title="Notifications Required"
      body={body}
      onRequestClose={dismiss}
      actions={[
        {
          label: 'Later',
          variant: 'secondary',
          onPress: dismiss,
        },
        {
          label: primaryLabel,
          variant: 'primary',
          onPress: () => {
            dismiss();
            void requestNotificationAccess().then((result) => {
              if (result.ok) {
                setVisible(false);
              }
            });
          },
        },
      ]}
    />
  );
}
