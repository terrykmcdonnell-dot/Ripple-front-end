/** Fallback USD prices when RevenueCat offerings have not loaded yet. */
export const SUBSCRIPTION_PRICING_USD = {
  monthly: 2.99,
  annual: 19.99,
} as const;

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
