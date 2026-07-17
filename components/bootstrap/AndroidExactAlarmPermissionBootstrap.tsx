import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { AndroidExactAlarmPermissionModal } from '@/components/alarms/AndroidExactAlarmPermissionModal';
import { isAndroidExactAlarmGranted, needsAndroidExactAlarmPermissionCheck } from '@/lib/android-exact-alarm-granted';

const EXACT_ALARM_PROMPT_KEY = 'ripple_exact_alarm_prompt_last_v1';
/** Re-prompt once per day until the user grants the permission. */
const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

let shownThisSession = false;

/**
 * Android 12+: explains why exact alarms are needed, then opens system settings when
 * the user taps Allow. Shown on first launch (and once per day) until granted.
 */
export function AndroidExactAlarmPermissionBootstrap() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!needsAndroidExactAlarmPermissionCheck()) {
      return;
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      void isAndroidExactAlarmGranted().then((granted) => {
        if (granted) {
          shownThisSession = true;
          setVisible(false);
        }
      });
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!needsAndroidExactAlarmPermissionCheck() || shownThisSession) {
      return;
    }

    void (async () => {
      try {
        if (await isAndroidExactAlarmGranted()) {
          shownThisSession = true;
          return;
        }

        const raw = await AsyncStorage.getItem(EXACT_ALARM_PROMPT_KEY);
        const lastShown = raw ? Number(raw) : 0;
        const now = Date.now();
        if (Number.isFinite(lastShown) && now - lastShown < PROMPT_INTERVAL_MS) {
          return;
        }

        shownThisSession = true;
        await AsyncStorage.setItem(EXACT_ALARM_PROMPT_KEY, String(now));

        setTimeout(() => {
          setVisible(true);
        }, 1500);
      } catch {
        /* ignore storage errors */
      }
    })();
  }, []);

  return (
    <AndroidExactAlarmPermissionModal
      visible={visible}
      onComplete={() => setVisible(false)}
    />
  );
}
