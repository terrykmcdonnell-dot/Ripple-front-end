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

export function useSubscriptionStatus() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [dbRow, setDbRow] = useState<UserRcSubscriptionRow | null>(null);
  const [loading, setLoading] = useState(Platform.OS !== 'web');

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
    setLoading(true);
    try {
      const [info, row] = await Promise.all([
        Purchases.getCustomerInfo(),
        fetchUserRcSubscriptionFromDb(),
      ]);
      setCustomerInfo(info);
      setDbRow(row);
    } catch {
      setCustomerInfo(null);
      try {
        setDbRow(await fetchUserRcSubscriptionFromDb());
      } catch {
        setDbRow(null);
      }
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
