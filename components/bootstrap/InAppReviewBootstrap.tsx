import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { runDeferredAppWork, runOnAppForeground } from '@/lib/defer-app-work';
import { handleInAppReviewForegroundReturn, markInAppReviewAppOpened } from '@/lib/in-app-review';

/** Tracks cold-start app opens for the first-launch guard on native store review prompts. */
export function InAppReviewBootstrap() {
  useEffect(() => {
    runDeferredAppWork(() => {
      void markInAppReviewAppOpened();
    });

    let lastState: AppStateStatus = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (lastState.match(/inactive|background/) && nextState === 'active') {
        runOnAppForeground(() => {
          void handleInAppReviewForegroundReturn();
        });
      }
      lastState = nextState;
    });

    return () => {
      appStateSub.remove();
    };
  }, []);

  return null;
}
