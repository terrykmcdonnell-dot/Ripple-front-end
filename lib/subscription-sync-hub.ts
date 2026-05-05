/**
 * Coordinates subscription refresh across screens: RevenueCat SDK updates,
 * app foreground, auth identity changes → bump generation → hooks refetch SDK + Supabase `users.rc_*`.
 */

let generation = 0;
const listeners = new Set<() => void>();

export function subscribeSubscriptionGeneration(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSubscriptionGeneration(): number {
  return generation;
}

/** Bump when RevenueCat customer info may have changed or backend webhook may have landed. */
export function invalidateSubscriptionCache(): void {
  generation += 1;
  for (const fn of listeners) {
    fn();
  }
}
