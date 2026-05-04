import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { loadDefaultSnoozeMinutes } from '@/lib/settings-preferences';

/**
 * Reads persisted Settings → Default Snooze. Reloads when the screen gains focus
 * so changes from `/setting` apply without restarting the app.
 */
export function useDefaultSnoozeMinutes() {
  const [minutes, setMinutes] = useState(10);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDefaultSnoozeMinutes().then((m) => {
        if (active) {
          setMinutes(m);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return minutes;
}
