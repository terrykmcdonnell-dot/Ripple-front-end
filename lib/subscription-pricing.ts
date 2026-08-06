/** Fallback USD prices when RevenueCat offerings have not loaded yet. */
export const SUBSCRIPTION_PRICING_USD = {
  monthly: 2.99,
  annual: 19.99,
  lifetime: 34.99,
} as const;

/** Free trial length on monthly / annual Pro — must match App Store Connect & Play Console. */
export const PRO_TRIAL_DAYS = 14;

export function proTrialShortLabel(): string {
  return `${PRO_TRIAL_DAYS}-day free trial`;
}

export function proTrialPaywallSubline(): string {
  return `Own Pro forever with a one-time purchase — or try monthly or annual free for ${PRO_TRIAL_DAYS} days.`;
}

export function lifetimePaywallHeadlineSuffix(): string {
  return 'One payment. Pro forever.';
}

export function proTrialSubscribeCtaLabel(): string {
  return 'Start free trial';
}

export function proTrialSubscriptionFooter(storeLabel: string): string {
  return `${PRO_TRIAL_DAYS}-day free trial, then billed through the ${storeLabel}. Cancel anytime in Settings before the trial ends to avoid charges.`;
}

/** Shown before a lifetime purchase when the user already has a store subscription or trial. */
export function lifetimeExistingSubscriptionWarning(
  storeLabel: string,
  billingProviderLabel: string,
): string {
  return `You already have an active subscription or trial through ${billingProviderLabel}. Buying Lifetime does not cancel it — open ${storeLabel} subscription settings and cancel to avoid being charged twice.`;
}

/** Shown after lifetime is owned while an auto-renewing subscription is still active in the store. */
export function lifetimeOwnerActiveSubscriptionReminder(storeLabel: string): string {
  return `You still have an active auto-renewing subscription in ${storeLabel}. Cancel it to stop future charges — Lifetime already covers your Pro access.`;
}

export function cancelStoreSubscriptionFooter(storeLabel: string): string {
  return `Opens ${storeLabel} subscription management for Ripple Pro.`;
}

export function formatSubscriptionUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Rounded percent saved vs paying monthly for 12 months. */
export function annualSubscriptionSavingsPercent(
  monthlyUsd = SUBSCRIPTION_PRICING_USD.monthly,
  annualUsd = SUBSCRIPTION_PRICING_USD.annual,
): number {
  const monthlyYear = monthlyUsd * 12;
  if (monthlyYear <= 0) return 0;
  return Math.round(((monthlyYear - annualUsd) / monthlyYear) * 100);
}
