import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { loadDefaultVibrationEnabled } from '@/lib/settings-preferences';

/**
 * Persisted Settings → Vibration. Reloads on focus so `/setting` changes apply immediately.
 */
export function useDefaultVibrationEnabled() {
  const [enabled, setEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDefaultVibrationEnabled().then((v) => {
        if (active) {
          setEnabled(v);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return enabled;
}
