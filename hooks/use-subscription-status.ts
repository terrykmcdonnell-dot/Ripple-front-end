import { Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

import {
  derivePremiumPlan,
  isActiveSubscriber,
  limitsApply,
  resolveDisplayedPremiumPlan,
  subscriptionPlanHeadline,
  subscriptionRenewalDisplay,
} from '@/lib/subscription-access';
import { configureRevenueCat, getRevenueCatApiKey, hasPremiumEntitlement } from '@/lib/revenuecat';
import {
  getSubscriptionGeneration,
  subscribeSubscriptionGeneration,
} from '@/lib/subscription-sync-hub';
import {
  dbIndicatesActivePro,
  fetchUserRcSubscriptionFromDb,
  type UserRcSubscriptionRow,
} from '@/lib/user-subscription-row';

/**
 * In-memory, app-session cache of the last resolved status.
 *
 * Every screen that calls this hook mounts its own component state, so without this cache each
 * remount (e.g. leaving Settings and coming back) briefly renders the default "not a subscriber"
 * state (`customerInfo`/`dbRow` = null) while `Purchases.getCustomerInfo()` + the Supabase lookup
 * are in flight — showing Pro sounds/features as locked for a moment before flipping open once the
 * fetch resolves. Seeding state from the last known-good result removes that flash; `refresh()`
 * still re-verifies in the background on every mount and on `syncGeneration` changes.
 *
 * Safe to treat as UI-only: anything that actually gates playback/scheduling (e.g.
 * `resolveAlarmSoundForUser` via `fetchIsSubscriberFresh()`) re-checks fresh at the point it matters.
 */
let cachedCustomerInfo: CustomerInfo | null = null;
let cachedDbRow: UserRcSubscriptionRow | null = null;
let cacheHydrated = false;

/** Call on sign-out so a different account signing in next never briefly inherits this cache. */
export function resetSubscriptionStatusCache(): void {
  cachedCustomerInfo = null;
  cachedDbRow = null;
  cacheHydrated = false;
}

export function useSubscriptionStatus() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(cachedCustomerInfo);
  const [dbRow, setDbRow] = useState<UserRcSubscriptionRow | null>(cachedDbRow);
  const [loading, setLoading] = useState(Platform.OS !== 'web' && !cacheHydrated);

  const syncGeneration = useSyncExternalStore(
    subscribeSubscriptionGeneration,
    getSubscriptionGeneration,
    () => 0,
  );

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setCustomerInfo(null);
      setDbRow(null);
      setLoading(false);
      return;
    }
    if (!getRevenueCatApiKey()) {
      setCustomerInfo(null);
      setDbRow(null);
      setLoading(false);
      return;
    }
    configureRevenueCat();
    // Only show a loading state on a cold cache — a background re-verify should not
    // regress the UI back to "unknown" while it runs.
    if (!cacheHydrated) {
      setLoading(true);
    }
    try {
      const [info, row] = await Promise.all([
        Purchases.getCustomerInfo(),
        fetchUserRcSubscriptionFromDb(),
      ]);
      setCustomerInfo(info);
      setDbRow(row);
      cachedCustomerInfo = info;
      cachedDbRow = row;
      cacheHydrated = true;
    } catch {
      setCustomerInfo(null);
      cachedCustomerInfo = null;
      try {
        const row = await fetchUserRcSubscriptionFromDb();
        setDbRow(row);
        cachedDbRow = row;
      } catch {
        setDbRow(null);
        cachedDbRow = null;
      }
      cacheHydrated = true;
    } finally {
      setLoading(false);
    }
  }, []);

  /** RevenueCat events, app foreground, and auth are signaled via `syncGeneration` (see RevenueCatBootstrap). */
  useEffect(() => {
    void refresh();
  }, [syncGeneration, refresh]);

  const subscriberSdk = isActiveSubscriber(customerInfo);
  const subscriberDb = dbIndicatesActivePro(dbRow);
  const isSubscriber = subscriberSdk || subscriberDb;

  const resolvedPlan = useMemo(
    () => resolveDisplayedPremiumPlan(customerInfo, dbRow),
    [customerInfo, dbRow],
  );

  const planKind = resolvedPlan;

  const planShort = isSubscriber
    ? subscriptionPlanHeadline(resolvedPlan)
    : subscriptionPlanHeadline(derivePremiumPlan(customerInfo));

  const titleLine = useMemo(() => {
    if (!isSubscriber) {
      const plan = derivePremiumPlan(customerInfo);
      const head = subscriptionPlanHeadline(plan);
      if (plan === 'unknown') {
        return 'Ripple Pro';
      }
      return `Ripple Pro · ${head}`;
    }
    const head = subscriptionPlanHeadline(resolvedPlan);
    if (resolvedPlan === 'unknown' && customerInfo && hasPremiumEntitlement(customerInfo)) {
      return 'Ripple Pro';
    }
    return `Ripple Pro · ${head}`;
  }, [isSubscriber, customerInfo, resolvedPlan]);

  const renewalHint = useMemo(() => {
    return subscriptionRenewalDisplay(customerInfo, resolvedPlan, subscriberSdk, subscriberDb);
  }, [customerInfo, resolvedPlan, subscriberSdk, subscriberDb]);

  const limitsActive = limitsApply(isSubscriber);

  return {
    customerInfo,
    dbRow,
    loading,
    refresh,
    isSubscriber,
    subscriberFromSdk: subscriberSdk,
    subscriberFromDb: subscriberDb,
    limitsApply: limitsActive,
    planKind,
    planShort,
    titleLine,
    renewalHint,
    managementURL: customerInfo?.managementURL ?? null,
  };
}
