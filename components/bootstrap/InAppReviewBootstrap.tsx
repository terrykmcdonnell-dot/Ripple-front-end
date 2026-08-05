import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  clearInAppReviewMissedAlarmSuppressOnForeground,
  markInAppReviewAppOpened,
  tryShowPendingNativeStoreReview,
} from '@/lib/in-app-review';

/** Tracks app opens for the first-launch guard on native store review prompts. */
export function InAppReviewBootstrap() {
  useEffect(() => {
    void markInAppReviewAppOpened();

    let lastState: AppStateStatus = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (lastState.match(/inactive|background/) && nextState === 'active') {
        clearInAppReviewMissedAlarmSuppressOnForeground();
        void markInAppReviewAppOpened();
        void tryShowPendingNativeStoreReview();
      }
      lastState = nextState;
    });

    return () => {
      appStateSub.remove();
    };
  }, []);

  return null;
}
