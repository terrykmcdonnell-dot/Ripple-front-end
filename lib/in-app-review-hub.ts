type InAppReviewPromptListener = () => void;

const listeners = new Set<InAppReviewPromptListener>();
let pendingPrompt = false;

export function subscribeInAppReviewPrompt(onShow: InAppReviewPromptListener): () => void {
  listeners.add(onShow);
  if (pendingPrompt) {
    pendingPrompt = false;
    onShow();
  }
  return () => {
    listeners.delete(onShow);
  };
}

export function publishInAppReviewPrompt(): void {
  if (listeners.size === 0) {
    pendingPrompt = true;
    return;
  }
  pendingPrompt = false;
  for (const fn of listeners) {
    fn();
  }
}
