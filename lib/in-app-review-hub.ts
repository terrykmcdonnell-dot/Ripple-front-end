type InAppReviewPromptListener = () => void;

const listeners = new Set<InAppReviewPromptListener>();

export function subscribeInAppReviewPrompt(onShow: InAppReviewPromptListener): () => void {
  listeners.add(onShow);
  return () => {
    listeners.delete(onShow);
  };
}

export function publishInAppReviewPrompt(): void {
  for (const fn of listeners) {
    fn();
  }
}
