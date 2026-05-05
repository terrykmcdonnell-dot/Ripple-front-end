import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

import {
  configureRevenueCat,
  getRevenueCatApiKey,
  getRevenueCatEntitlementId,
  hasPremiumEntitlement,
} from '@/lib/revenuecat';
import { dbIndicatesActivePro, fetchUserRcSubscriptionFromDb } from '@/lib/user-subscription-row';

/** Free tier cap — must match paywall copy. */
export const FREE_TIER_MAX_ALARMS = 5;

export type DerivedPremiumPlan = 'annual' | 'monthly' | 'trial' | 'intro' | 'unknown';

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
 * When true, enforce free-tier limits (alarm cap, template install, premium themes).
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
