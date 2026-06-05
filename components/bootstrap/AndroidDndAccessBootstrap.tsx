import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { openAndroidNotificationPolicyAccessSettings } from '@/lib/open-android-notification-policy-access-settings';

const DND_WARN_KEY = 'ripple_android_dnd_warn_last_v1';
/** Show once, then suppress for 30 days after the user taps "Open Settings". */
const DND_WARN_INTERVAL_MS = 24 * 60 * 60 * 1000; // re-prompt daily until actioned
const DND_WARN_SILENCE_AFTER_OPEN_MS = 30 * 24 * 60 * 60 * 1000;

let shownThisSession = false;

/**
 * Android: prompts the user once to grant Ripple "Do Not Disturb access".
 *
 * Without this access:
 *   - Silent / vibrate mode  → alarm still sounds (USAGE_ALARM bypasses ringer).
 *   - DND Priority / Alarms  → alarm still sounds (bypassDnd: true on channel).
 *   - DND Total Silence      → alarm may be silenced on strict OEMs.
 *
 * With DND access (ACCESS_NOTIFICATION_POLICY) granted by the user:
 *   - Ripple appears in the Android "Do Not Disturb" exceptions list.
 *   - Android treats the app's USAGE_ALARM channel with the highest DND bypass
 *     priority, maximising the chance of sounding even in Total Silence.
 *
 * Uses the same AppConfirmModal style as the FSI permission prompt.
 */
export function AndroidDndAccessBootstrap() {
  const [visible, setVisible] = useState(false);
  const [promptShownAt, setPromptShownAt] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (shownThisSession) {
      return;
    }

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DND_WARN_KEY);
        const lastShown = raw ? Number(raw) : 0;
        const now = Date.now();

        if (Number.isFinite(lastShown) && now - lastShown < DND_WARN_INTERVAL_MS) {
          return;
        }

        shownThisSession = true;
        await AsyncStorage.setItem(DND_WARN_KEY, String(now));

        // Delay so the app finishes its first render — avoids two modals stacking
        // with the FSI prompt that fires at the same time.
        setTimeout(() => {
          setPromptShownAt(now);
          setVisible(true);
        }, 3500);
      } catch {
        /* ignore storage errors */
      }
    })();
  }, []);

  const dismiss = () => setVisible(false);

  return (
    <AppConfirmModal
      visible={visible}
      title="Allow Alarms in Silent Mode"
      body={
        'Ripple must appear in Android “Modes access” (Do Not Disturb) so alarms can ring during Total Silence.\n\nIf Ripple is not in the list yet, install the latest app build first — then tap Open Settings and turn Ripple ON.'
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
            void openAndroidNotificationPolicyAccessSettings();
            // Silence re-prompts for 30 days after the user visits settings.
            void AsyncStorage.setItem(
              DND_WARN_KEY,
              String(promptShownAt + DND_WARN_SILENCE_AFTER_OPEN_MS - DND_WARN_INTERVAL_MS),
            );
          },
        },
      ]}
    />
  );
}
