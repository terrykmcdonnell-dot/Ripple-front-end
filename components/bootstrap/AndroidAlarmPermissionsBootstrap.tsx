import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import {
  getAndroidAlarmPermissionWarnings,
  type AndroidAlarmPermissionWarning,
} from '@/lib/android-alarm-permissions-status';

const WARN_KEY = 'ripple_android_alarm_perm_warn_last_v1';
/** Re-prompt once per day until the user grants missing permissions. */
const WARN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Android: prompts when full-screen intent and/or DND access is missing.
 * Re-checks when the app returns from Settings so users who missed the first
 * prompt still get guided after visiting system pages.
 */
export function AndroidAlarmPermissionsBootstrap() {
  const [visible, setVisible] = useState(false);
  const [warnings, setWarnings] = useState<AndroidAlarmPermissionWarning[]>([]);
  const [promptShownAt, setPromptShownAt] = useState(0);

  const maybeShowPrompt = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    const missing = await getAndroidAlarmPermissionWarnings();
    if (missing.length === 0) {
      setVisible(false);
      setWarnings([]);
      return;
    }

    const raw = await AsyncStorage.getItem(WARN_KEY);
    const lastShown = raw ? Number(raw) : 0;
    const now = Date.now();
    if (Number.isFinite(lastShown) && now - lastShown < WARN_INTERVAL_MS) {
      setWarnings(missing);
      return;
    }

    await AsyncStorage.setItem(WARN_KEY, String(now));
    setWarnings(missing);
    setPromptShownAt(now);
    setVisible(true);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void maybeShowPrompt(), 2000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void maybeShowPrompt();
      }
    });
    return () => {
      clearTimeout(timeout);
      sub.remove();
    };
  }, [maybeShowPrompt]);

  const dismiss = () => setVisible(false);
  const primary = warnings[0];
  if (!primary) {
    return null;
  }

  const bodyLines = warnings.map((w) => `• ${w.title}: ${w.body}`).join('\n\n');

  return (
    <AppConfirmModal
      visible={visible}
      title="Enable lock-screen alarms"
      body={
        'Ripple is missing Android permissions needed for full-screen lock-screen alarms.\n\n' +
        `${bodyLines}\n\n` +
        'Tap Open Settings, find Ripple in the list, and turn it ON.'
      }
      onRequestClose={dismiss}
      actions={[
        {
          label: 'Later',
          variant: 'secondary',
          onPress: dismiss,
        },
        {
          label: 'Open Settings',
          variant: 'primary',
          onPress: () => {
            dismiss();
            void primary.openSettings();
            void AsyncStorage.setItem(
              WARN_KEY,
              String(promptShownAt + 30 * 24 * 60 * 60 * 1000 - WARN_INTERVAL_MS),
            );
          },
        },
      ]}
    />
  );
}
