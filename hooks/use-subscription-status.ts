import { Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

import {
  derivePremiumPlan,
  isActiveSubscriber,
  limitsApply,
  subscriptionDisplayTitle,
  subscriptionPlanHeadline,
  subscriptionRenewalHint,
} from '@/lib/subscription-access';
import { configureRevenueCat, getRevenueCatApiKey } from '@/lib/revenuecat';
import {
  getSubscriptionGeneration,
  subscribeSubscriptionGeneration,
} from '@/lib/subscription-sync-hub';
import {
  dbIndicatesActivePro,
  displayPlanFromDb,
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

  const planKind = derivePremiumPlan(customerInfo);
  const planShort = subscriberSdk
    ? subscriptionPlanHeadline(planKind)
    : subscriberDb
      ? displayPlanFromDb(dbRow)
      : subscriptionPlanHeadline(planKind);

  const titleLine = subscriberSdk
    ? subscriptionDisplayTitle(customerInfo)
    : subscriberDb
      ? `Ripple Pro · ${displayPlanFromDb(dbRow)}`
      : subscriptionDisplayTitle(customerInfo);

  const renewalHint = useMemo(() => {
    if (subscriberSdk) {
      return subscriptionRenewalHint(customerInfo);
    }
    if (subscriberDb) {
      return 'Synced from your store subscription.';
    }
    return null;
  }, [subscriberSdk, subscriberDb, customerInfo]);

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
