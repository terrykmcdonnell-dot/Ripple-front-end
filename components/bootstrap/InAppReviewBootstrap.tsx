import { useEffect, useState } from 'react';

import { InAppReviewModal } from '@/components/review/InAppReviewModal';
import { useAppToast } from '@/components/ui/AppToastProvider';
import {
  completeInAppReviewSubmission,
  dismissInAppReviewPrompt,
  markInAppReviewAppOpened,
} from '@/lib/in-app-review';
import { subscribeInAppReviewPrompt } from '@/lib/in-app-review-hub';

/** Tracks app launches and shows the in-app review modal when triggered. */
export function InAppReviewBootstrap() {
  const { showToast } = useAppToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void markInAppReviewAppOpened();
    return subscribeInAppReviewPrompt(() => setVisible(true));
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
