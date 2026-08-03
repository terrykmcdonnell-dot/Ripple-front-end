import { useEffect } from 'react';

import { markInAppReviewAppOpened } from '@/lib/in-app-review';

/** Tracks app launches so the review prompt never appears on first install open. */
export function InAppReviewBootstrap() {
  useEffect(() => {
    void markInAppReviewAppOpened();
  }, []);

  return null;
}
