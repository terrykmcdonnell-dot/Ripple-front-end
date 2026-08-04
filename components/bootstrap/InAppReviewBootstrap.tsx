import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { InAppReviewModal } from '@/components/review/InAppReviewModal';
import { useAppToast } from '@/components/ui/AppToastProvider';
import {
  clearInAppReviewMissedAlarmSuppressOnForeground,
  completeInAppReviewSubmission,
  dismissInAppReviewPrompt,
  markInAppReviewAppOpened,
} from '@/lib/in-app-review';
import { subscribeInAppReviewPrompt } from '@/lib/in-app-review-hub';

/** Tracks app sessions and shows the in-app review modal when triggered. */
export function InAppReviewBootstrap() {
  const { showToast } = useAppToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribePrompt = subscribeInAppReviewPrompt(() => setVisible(true));

    void markInAppReviewAppOpened();

    let lastState: AppStateStatus = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (lastState.match(/inactive|background/) && nextState === 'active') {
        clearInAppReviewMissedAlarmSuppressOnForeground();
        void markInAppReviewAppOpened();
      }
      lastState = nextState;
    });

    return () => {
      appStateSub.remove();
      unsubscribePrompt();
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    dismissInAppReviewPrompt();
  };

  const handleSubmit = async (stars: number, message: string) => {
    setVisible(false);
    await completeInAppReviewSubmission(stars, message);
    showToast('Thanks for your feedback!');
  };

  return (
    <InAppReviewModal visible={visible} onDismiss={handleDismiss} onSubmit={handleSubmit} />
  );
}
