import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { isAndroidFullScreenIntentGranted } from '@/lib/android-full-screen-intent-granted';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';

const FSI_WARN_KEY = 'ripple_fsi_warn_last_v1';
/** Re-prompt once per day until the user grants the permission. */
const WARN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let shownThisSession = false;

/**
 * Android 14+: shows a themed confirm modal on first launch (and once per day)
 * asking the user to grant the full-screen intent permission.
 * Skips the prompt if the permission is already granted.
 *
 * Uses AppConfirmModal (same style as delete/skip dialogs) rather than the
 * native Alert, which renders as a bright white system dialog that clashes
 * with Ripple's dark theme.
 */
export function AndroidFsiPermissionBootstrap() {
  const [visible, setVisible] = useState(false);
  const [promptShownAt, setPromptShownAt] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || (Platform.Version as number) < 34) {
      return;
    }
    if (shownThisSession) {
      return;
    }

    void (async () => {
      try {
        // Skip entirely if the user already granted the permission.
        if (await isAndroidFullScreenIntentGranted()) {
          shownThisSession = true;
          return;
        }

        const raw = await AsyncStorage.getItem(FSI_WARN_KEY);
        const lastShown = raw ? Number(raw) : 0;
        const now = Date.now();
        if (Number.isFinite(lastShown) && now - lastShown < WARN_INTERVAL_MS) {
          return;
        }

        shownThisSession = true;
        await AsyncStorage.setItem(FSI_WARN_KEY, String(now));

        // Small delay so the app finishes its first render before the modal appears.
        setTimeout(() => {
          setPromptShownAt(now);
          setVisible(true);
        }, 1500);
      } catch {
        /* ignore storage errors */
      }
    })();
  }, []);

  const dismiss = () => setVisible(false);

  return (
    <AppConfirmModal
      visible={visible}
      title="Enable Lock Screen Alarms"
      body={
        'Ripple needs the "Display over other apps" (full-screen) permission to show the alarm ring screen when your phone is locked.\n\nTap "Open Settings", find Ripple in the list, and turn it ON.'
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
            void openAndroidFullScreenAlarmPermissionSettings();
            // Silence further prompts for 30 days once the user visits the page.
            void AsyncStorage.setItem(
              FSI_WARN_KEY,
              String(promptShownAt + 30 * 24 * 60 * 60 * 1000 - WARN_INTERVAL_MS),
            );
          },
        },
      ]}
    />
  );
}
