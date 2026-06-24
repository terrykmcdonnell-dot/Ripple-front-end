import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

import {
  configureRevenueCat,
  getRevenueCatApiKey,
  getRevenueCatEntitlementId,
  hasPremiumEntitlement,
} from '@/lib/revenuecat';
import {
  dbIndicatesActivePro,
  fetchUserRcSubscriptionFromDb,
  type UserRcSubscriptionRow,
} from '@/lib/user-subscription-row';

/** Free tier cap — must match paywall copy. */
export const FREE_TIER_MAX_ALARMS = 5;

export type DerivedPremiumPlan = 'annual' | 'monthly' | 'trial' | 'intro' | 'unknown';

/**
 * Plan shown in Settings / paywall.
 * When Supabase has `rc_subscription_plan` from RevenueCat webhooks, prefer that over SDK inference so UI matches backend.
 */
export function resolveDisplayedPremiumPlan(
  customerInfo: CustomerInfo | null | undefined,
  dbRow: UserRcSubscriptionRow | null | undefined,
): DerivedPremiumPlan {
  const dbRaw = (dbRow?.rc_subscription_plan ?? '').trim().toLowerCase();
  if (dbRaw === 'annual') return 'annual';
  if (dbRaw === 'monthly') return 'monthly';
  if (dbRaw === 'trial') return 'trial';
  if (dbRaw === 'intro') return 'intro';
  return derivePremiumPlan(customerInfo);
}

export function derivePremiumPlan(info: CustomerInfo | null | undefined): DerivedPremiumPlan {
  if (!info || !hasPremiumEntitlement(info)) {
    return 'unknown';
  }
  const id = getRevenueCatEntitlementId();
  const ent = info.entitlements.active[id];
  if (!ent) {
    return 'unknown';
  }
  if (ent.periodType === 'TRIAL') {
    return 'trial';
  }
  if (ent.periodType === 'INTRO') {
    return 'intro';
  }

  const pid = ent.productIdentifier.toLowerCase();
  if (
    pid.includes('annual') ||
    pid.includes('year') ||
    pid.includes('_yr') ||
    pid.includes('.year') ||
    pid.includes('yearly')
  ) {
    return 'annual';
  }
  if (pid.includes('month')) {
    return 'monthly';
  }

  const sub = info.subscriptionsByProductIdentifier[ent.productIdentifier];
  if (sub?.expiresDate && sub?.purchaseDate) {
    const ms = new Date(sub.expiresDate).getTime() - new Date(sub.purchaseDate).getTime();
    const days = ms / 86400000;
    if (days >= 200) {
      return 'annual';
    }
    if (days >= 25 && days <= 40) {
      return 'monthly';
    }
  }

  return 'unknown';
}

/** Short label for Settings / paywall (exact plan family). */
export function subscriptionPlanHeadline(plan: DerivedPremiumPlan): string {
  switch (plan) {
    case 'annual':
      return 'Annual';
    case 'monthly':
      return 'Monthly';
    case 'trial':
      return 'Free trial';
    case 'intro':
      return 'Intro offer';
    default:
      return 'Ripple Pro';
  }
}

export function subscriptionDisplayTitle(info: CustomerInfo | null | undefined): string {
  const plan = derivePremiumPlan(info);
  const head = subscriptionPlanHeadline(plan);
  if (plan === 'unknown' && info && hasPremiumEntitlement(info)) {
    return 'Ripple Pro';
  }
  return `Ripple Pro · ${head}`;
}

/** Strict: active entitlement from RevenueCat only (no dev bypass). */
export function isActiveSubscriber(info: CustomerInfo | null | undefined): boolean {
  return info != null && hasPremiumEntitlement(info);
}

/**
 * When true, enforce free-tier limits (alarm cap, template gallery install, premium themes).
 * Web and builds without an RC key skip limits so local/dev keeps working.
 */
export function limitsApply(isSubscriber: boolean): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  if (!getRevenueCatApiKey()) {
    return false;
  }
  return !isSubscriber;
}

export function canAddAlarm(alarmCount: number, isSubscriber: boolean): boolean {
  if (!limitsApply(isSubscriber)) {
    return true;
  }
  return alarmCount < FREE_TIER_MAX_ALARMS;
}

/** Template gallery packs require Ripple Pro on mobile builds with RevenueCat configured. */
export function canInstallTemplatePack(isSubscriber: boolean): boolean {
  return !limitsApply(isSubscriber);
}

/** Fresh read before creating an alarm (avoids stale hook state). */
export async function fetchAlarmLimitApplies(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  if (!getRevenueCatApiKey()) {
    return false;
  }
  configureRevenueCat();
  try {
    const [info, dbRow] = await Promise.all([
      Purchases.getCustomerInfo(),
      fetchUserRcSubscriptionFromDb(),
    ]);
    const merged = isActiveSubscriber(info) || dbIndicatesActivePro(dbRow);
    return limitsApply(merged);
  } catch {
    try {
      const dbRow = await fetchUserRcSubscriptionFromDb();
      return limitsApply(dbIndicatesActivePro(dbRow));
    } catch {
      return true;
    }
  }
}

/** Fresh read before creating an alarm (avoids stale hook state). */
export async function fetchIsSubscriberFresh(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  if (!getRevenueCatApiKey()) {
    return true;
  }
  configureRevenueCat();
  try {
    const [info, dbRow] = await Promise.all([
      Purchases.getCustomerInfo(),
      fetchUserRcSubscriptionFromDb(),
    ]);
    return isActiveSubscriber(info) || dbIndicatesActivePro(dbRow);
  } catch {
    try {
      const dbRow = await fetchUserRcSubscriptionFromDb();
      return dbIndicatesActivePro(dbRow);
    } catch {
      return false;
    }
  }
}

export async function canAddAlarmFresh(alarmCount: number): Promise<boolean> {
  if (!(await fetchAlarmLimitApplies())) {
    return true;
  }
  return alarmCount < FREE_TIER_MAX_ALARMS;
}

/** User-facing renewal / trial line for subscriber UI. */
export function subscriptionRenewalHint(info: CustomerInfo | null | undefined): string | null {
  if (!info || !isActiveSubscriber(info)) {
    return null;
  }
  const id = getRevenueCatEntitlementId();
  const ent = info.entitlements.active[id];
  if (!ent) {
    return null;
  }
  if (!ent.expirationDate) {
    return 'Active subscription';
  }
  const d = new Date(ent.expirationDate);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const dateStr = d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  if (ent.periodType === 'TRIAL') {
    return `Trial ends ${dateStr}`;
  }
  return `Renews or expires ${dateStr}`;
}

/** Renewal line plus context when displayed billing is monthly but entitlement end date is still far out (common after switching from annual). */
export function subscriptionRenewalDisplay(
  customerInfo: CustomerInfo | null | undefined,
  resolvedPlan: DerivedPremiumPlan,
  subscriberSdk: boolean,
  subscriberDb: boolean,
): string | null {
  if (subscriberSdk) {
    const line = subscriptionRenewalHint(customerInfo);
    if (!line) {
      return null;
    }
    if (
      resolvedPlan === 'monthly' &&
      customerInfo &&
      isActiveSubscriber(customerInfo)
    ) {
      const id = getRevenueCatEntitlementId();
      const ent = customerInfo.entitlements.active[id];
      if (ent?.expirationDate && ent.periodType !== 'TRIAL') {
        const days =
          (new Date(ent.expirationDate).getTime() - Date.now()) / 86400000;
        if (days > 42) {
          return `${line} On monthly billing this date may still reflect prepaid access—confirm your next charge in subscription settings.`;
        }
      }
    }
    return line;
  }
  if (subscriberDb) {
    return 'Synced from your store subscription.';
  }
  return null;
}
