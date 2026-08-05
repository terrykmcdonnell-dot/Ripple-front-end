import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { paywallIcons } from '@/assets/icons/paywall-icons';
import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FeatureRow } from '@/components/paywall/FeatureRow';
import { PricingPlan, PricingToggle } from '@/components/paywall/PricingToggle';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { FREE_TIER_MAX_RINGS_PER_ALARM, freeTierRingLimitPaywallBanner } from '@/lib/alarm-free-ring-limit';
import { derivePremiumPlan, FREE_TIER_MAX_ALARMS, isLifetimePremiumPlan, resolveDisplayedPremiumPlan } from '@/lib/subscription-access';
import {
  proTrialPaywallSubline,
  proTrialSubscribeCtaLabel,
  proTrialSubscriptionFooter,
  lifetimePaywallHeadlineSuffix,
} from '@/lib/subscription-pricing';
import { fetchAlarms } from '@/lib/alarm-api';
import { capturePaywallDismissed, capturePaywallViewed } from '@/lib/posthog-analytics';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { useBottomSafePadding } from '@/lib/screen-safe-area';
import {
  configureRevenueCat,
  getRevenueCatApiKey,
  hasPremiumEntitlement,
  isPackageInActiveSubscription,
  isPurchasesUserCancelled,
  isRevenueCatConfigured,
  pickMonthlyAnnualPackages,
  purchasesErrorMessage,
  syncPurchasesAfterTransaction,
} from '@/lib/revenuecat';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

const PRO_PLAN_FEATURES = [
  'Unlimited alarms — no cap, ever',
  `Unlimited rings per alarm — no ${FREE_TIER_MAX_RINGS_PER_ALARM}-ring cap`,
  'Template gallery — install ready-made alarm packs',
  'Auto theme — matches your device',
  'Premium alarm sounds',
] as const;

function subscriptionStoreLabel(): string {
  return Platform.OS === 'ios' ? 'App Store' : 'Play Store';
}

function subscriptionBillingProviderLabel(): string {
  return Platform.OS === 'ios' ? 'Apple' : 'Google';
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: alarmTheme.bg,
    },
    closeBtn: {
      position: 'absolute',
      top: 60,
      right: 20,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    closeText: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.body,
    },
    glowBg: {
      position: 'absolute',
      top: 80,
      left: '50%',
      marginLeft: -150,
      width: 300,
      height: 200,
      borderRadius: 150,
      backgroundColor: alarmTheme.accentDim,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 50,
      elevation: 0,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: 54,
      paddingHorizontal: 24,
    },
    proIconWrap: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 16,
    },
    proIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: alarmTheme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 5,
    },
    proIcon: {
      fontSize: alarmTypography.titleLg,
    },
    limitBox: {
      backgroundColor: alarmTheme.redDim,
      borderWidth: 1,
      borderColor: `${alarmTheme.red}44`,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    limitText: {
      color: alarmTheme.red,
      fontSize: alarmTypography.caption,
    },
    subscribedBox: {
      backgroundColor: alarmTheme.greenDim,
      borderWidth: 1,
      borderColor: 'rgba(52,211,153,0.35)',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    subscribedText: {
      color: alarmTheme.green,
      fontSize: alarmTypography.caption,
      fontWeight: '700',
    },
    headline: {
      color: alarmTheme.text,
      fontSize: alarmTypography.title,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 8,
      lineHeight: alarmTypography.title + 4,
    },
    headlineAccent: {
      color: alarmTheme.accentBright,
    },
    sub: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
      textAlign: 'center',
      lineHeight: alarmTypography.caption + 8,
      marginBottom: 24,
    },
    features: {
      gap: 8,
      marginBottom: 24,
    },
    ctaBtn: {
      width: '100%',
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
      marginBottom: 10,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    ctaDisabled: {
      opacity: 0.55,
    },
    ctaText: {
      color: '#ffffff',
      fontSize: alarmTypography.body,
      fontWeight: '700',
    },
    footerNote: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      textAlign: 'center',
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    restore: {
      color: alarmTheme.accentBright,
      fontSize: alarmTypography.caption,
      textAlign: 'center',
      paddingVertical: 10,
    },
    restoreMuted: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
      textAlign: 'center',
    },
    cancelSubscriptionLink: {
      color: alarmTheme.red,
      fontSize: alarmTypography.caption,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 12,
    },
    noticeBox: {
      marginTop: 48,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface2,
    },
    noticeTitle: {
      color: alarmTheme.text,
      fontSize: alarmTypography.body,
      fontWeight: '700',
      marginBottom: 10,
    },
    noticeBody: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
      lineHeight: alarmTypography.caption + 8,
    },
    errorBox: {
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: alarmTheme.redDim,
      borderWidth: 1,
      borderColor: `${alarmTheme.red}44`,
    },
    errorText: {
      color: alarmTheme.red,
      fontSize: alarmTypography.caption,
      marginBottom: 8,
    },
    retryText: {
      color: alarmTheme.accentBright,
      fontSize: alarmTypography.caption,
      fontWeight: '600',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 16,
    },
    loadingLabel: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
    },
  });
}

export default function PaywallScreen() {
  useRequireAuth();
  const alarmTheme = useAlarmTheme();
  const bottomPad = useBottomSafePadding(24);
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
  const { alarmLimit, ringLimit } = useLocalSearchParams<{ alarmLimit?: string; ringLimit?: string }>();
  const isAlarmLimitPaywall = alarmLimit === '1' || alarmLimit === 'true';
  const isRingLimitPaywall = ringLimit === '1' || ringLimit === 'true';
  const paywallViewedRef = useRef(false);
  const purchasedThisSessionRef = useRef(false);
  const { showToast } = useAppToast();

  const {
    isSubscriber,
    loading: subLoading,
    titleLine,
    renewalHint,
    managementURL,
    customerInfo,
    dbRow,
  } = useSubscriptionStatus();

  const openSubscriptionManagement = useCallback(() => {
    if (managementURL) {
      void Linking.openURL(managementURL);
    } else {
      void Linking.openSettings();
    }
  }, [managementURL]);

  const [plan, setPlan] = useState<PricingPlan>('lifetime');
  /** When true, do not overwrite `plan` from subscription sync (user tapped a plan). */
  const userPickedPlanRef = useRef(false);
  const [lifetimePkg, setLifetimePkg] = useState<PurchasesPackage | undefined>();
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | undefined>();
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | undefined>();
  const [loadingOfferings, setLoadingOfferings] = useState(Platform.OS !== 'web');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [alarmCount, setAlarmCount] = useState<number | null>(null);

  const refreshAlarmCount = useCallback(async () => {
    if (isSubscriber || Platform.OS === 'web') {
      setAlarmCount(null);
      return;
    }
    try {
      const { id, error } = await fetchCurrentUserRowId();
      if (error || id == null) {
        setAlarmCount(null);
        return;
      }
      const alarms = await fetchAlarms(id);
      setAlarmCount(alarms.length);
    } catch {
      setAlarmCount(null);
    }
  }, [isSubscriber]);

  const showAlarmLimitReached =
    alarmCount !== null && alarmCount >= FREE_TIER_MAX_ALARMS;

  const lifetimePriceLabel = lifetimePkg?.product.priceString ?? null;
  const monthlyPriceLabel = monthlyPkg?.product.priceString ?? null;
  const annualPriceLabel = annualPkg?.product.priceString ?? null;

  const selectedPackage =
    plan === 'lifetime' ? lifetimePkg : plan === 'annual' ? annualPkg : monthlyPkg;
  const showLifetimeOption = !!lifetimePkg;
  const showSubscriptionOptions = !!monthlyPkg || !!annualPkg;
  const canPurchase =
    Platform.OS !== 'web' && isRevenueCatConfigured() && !!selectedPackage && !loadingOfferings && !loadError;

  const displayedPremiumPlan = useMemo(
    () => resolveDisplayedPremiumPlan(customerInfo, dbRow),
    [customerInfo, dbRow],
  );

  const ownsSelectedPlan = useMemo(() => {
    if (displayedPremiumPlan === 'lifetime') return plan === 'lifetime';
    if (displayedPremiumPlan === 'annual') return plan === 'annual';
    if (displayedPremiumPlan === 'monthly') return plan === 'monthly';
    return (
      !!customerInfo &&
      !!selectedPackage &&
      isPackageInActiveSubscription(selectedPackage, customerInfo)
    );
  }, [displayedPremiumPlan, plan, customerInfo, selectedPackage]);

  const isLifetimeOwner = isLifetimePremiumPlan(displayedPremiumPlan);

  const selectPlan = useCallback((next: PricingPlan) => {
    userPickedPlanRef.current = true;
    setPlan(next);
  }, []);

  useEffect(() => {
    if (!isSubscriber || loadingOfferings || userPickedPlanRef.current) {
      return;
    }
    const resolved = resolveDisplayedPremiumPlan(customerInfo, dbRow);
    if (resolved === 'lifetime') {
      setPlan('lifetime');
      return;
    }
    if (resolved === 'annual') {
      setPlan('annual');
      return;
    }
    if (resolved === 'monthly') {
      setPlan('monthly');
      return;
    }
    if (!customerInfo) {
      return;
    }
    const monthlyActive = monthlyPkg && isPackageInActiveSubscription(monthlyPkg, customerInfo);
    const annualActive = annualPkg && isPackageInActiveSubscription(annualPkg, customerInfo);
    const lifetimeActive = lifetimePkg && isPackageInActiveSubscription(lifetimePkg, customerInfo);
    if (lifetimeActive) {
      setPlan('lifetime');
      return;
    }
    if (annualActive) {
      setPlan('annual');
      return;
    }
    if (monthlyActive) {
      setPlan('monthly');
      return;
    }
    const derived = derivePremiumPlan(customerInfo);
    if (derived === 'lifetime') {
      setPlan('lifetime');
    } else if (derived === 'annual') {
      setPlan('annual');
    } else if (derived === 'monthly') {
      setPlan('monthly');
    }
  }, [isSubscriber, customerInfo, dbRow, monthlyPkg, annualPkg, lifetimePkg, loadingOfferings]);

  const navigateAfterSubscriptionSuccess = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/alarm');
    }
  }, [router]);

  const scheduleExitAfterPurchaseFlow = useCallback(
    (exit: () => void) => {
      if (Platform.OS === 'android') {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(exit, 48);
        });
      } else {
        exit();
      }
    },
    [],
  );

  const loadOfferings = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoadingOfferings(false);
      return;
    }
    if (!getRevenueCatApiKey()) {
      setLoadError(
        Platform.OS === 'ios'
          ? 'Subscriptions are temporarily unavailable. Add EXPO_PUBLIC_REVENUECAT_API_KEY_IOS to .env and restart.'
          : 'Subscriptions are temporarily unavailable. Add EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID to .env and restart.',
      );
      setLoadingOfferings(false);
      setMonthlyPkg(undefined);
      setAnnualPkg(undefined);
      setLifetimePkg(undefined);
      return;
    }

    setLoadingOfferings(true);
    setLoadError(null);
    configureRevenueCat();
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const { monthly, annual, lifetime } = pickMonthlyAnnualPackages(current ?? undefined);
      setMonthlyPkg(monthly);
      setAnnualPkg(annual);
      setLifetimePkg(lifetime);
      if (!monthly && !annual && !lifetime) {
        setLoadError(
          current
            ? 'No purchase packages in this offering. Add Lifetime / Monthly / Annual packages in the RevenueCat dashboard.'
            : 'No current offering. Configure an offering as "current" in RevenueCat.',
        );
      }
      if (lifetime) {
        setPlan('lifetime');
      } else if (monthly && !annual) {
        setPlan('monthly');
      } else if (annual && !monthly) {
        setPlan('annual');
      }
    } catch (e) {
      setLoadError(purchasesErrorMessage(e));
      setMonthlyPkg(undefined);
      setAnnualPkg(undefined);
      setLifetimePkg(undefined);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      userPickedPlanRef.current = false;
      invalidateSubscriptionCache();
      void loadOfferings();
      void refreshAlarmCount();
    }, [loadOfferings, refreshAlarmCount]),
  );

  const rcKeyPresent = !!getRevenueCatApiKey();
  const subscriptionGatePending = rcKeyPresent && subLoading;

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      !(isAlarmLimitPaywall || isRingLimitPaywall) ||
      subscriptionGatePending ||
      paywallViewedRef.current
    ) {
      return;
    }
    paywallViewedRef.current = true;
    capturePaywallViewed();
  }, [isAlarmLimitPaywall, isRingLimitPaywall, subscriptionGatePending]);

  const onSubscribe = useCallback(async () => {
    if (!selectedPackage || purchasing) {
      return;
    }
    const wasExistingSubscriber = isSubscriber;
    setPurchasing(true);
    try {
      const { customerInfo: nextInfo } = await Purchases.purchasePackage(selectedPackage);
      purchasedThisSessionRef.current = true;
      await syncPurchasesAfterTransaction();
      invalidateSubscriptionCache();
      if (hasPremiumEntitlement(nextInfo)) {
        purchasedThisSessionRef.current = true;
        showToast(
          wasExistingSubscriber
            ? 'Plan updated.'
            : plan === 'lifetime'
              ? 'Lifetime Pro unlocked. Welcome to Ripple Pro!'
              : 'Your free trial has started. Welcome to Ripple Pro!',
        );
      } else {
        showToast('Purchase completed. It may take a moment for access to unlock.');
      }
      scheduleExitAfterPurchaseFlow(navigateAfterSubscriptionSuccess);
    } catch (e) {
      if (isPurchasesUserCancelled(e)) {
        return;
      }
      showToast(purchasesErrorMessage(e));
    } finally {
      setPurchasing(false);
    }
  }, [
    isSubscriber,
    navigateAfterSubscriptionSuccess,
    purchasing,
    scheduleExitAfterPurchaseFlow,
    selectedPackage,
    showToast,
    plan,
  ]);

  const onRestore = useCallback(async () => {
    if (restoring || Platform.OS === 'web') {
      return;
    }
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (hasPremiumEntitlement(customerInfo)) {
        purchasedThisSessionRef.current = true;
        showToast('Purchases restored.');
        await syncPurchasesAfterTransaction();
        invalidateSubscriptionCache();
        scheduleExitAfterPurchaseFlow(navigateAfterSubscriptionSuccess);
      } else {
        showToast('No active Pro purchase found for this account.');
      }
    } catch (e) {
      showToast(purchasesErrorMessage(e));
    } finally {
      setRestoring(false);
    }
  }, [
    navigateAfterSubscriptionSuccess,
    restoring,
    scheduleExitAfterPurchaseFlow,
    showToast,
  ]);

  const onClose = () => {
    if (
      (isAlarmLimitPaywall || isRingLimitPaywall) &&
      paywallViewedRef.current &&
      !isSubscriber &&
      !purchasedThisSessionRef.current
    ) {
      capturePaywallDismissed();
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/setting');
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>{paywallIcons.close}</Text>
        </Pressable>
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingTop: 100, paddingBottom: bottomPad }]}>
          <Text style={styles.headline}>Ripple Pro</Text>
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Mobile subscriptions</Text>
            <Text style={styles.noticeBody}>
              Apple and Google subscriptions run through the Ripple iOS and Android apps (development build or App Store /
              Play Store). Install the app on a device to subscribe with RevenueCat.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (subscriptionGatePending) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>{paywallIcons.close}</Text>
        </Pressable>
        <View style={[styles.loadingRow, { paddingTop: 140 }]}>
          <ActivityIndicator color={alarmTheme.accent} />
          <Text style={styles.loadingLabel}>Checking subscription…</Text>
        </View>
      </View>
    );
  }

  if (rcKeyPresent && isSubscriber) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.glowBg} />

        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>{paywallIcons.close}</Text>
        </Pressable>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.proIconWrap}>
            <View style={styles.proIconCircle}>
              <Text style={styles.proIcon}>{paywallIcons.pro}</Text>
            </View>
          </View>

          <View style={styles.subscribedBox}>
            <Text style={styles.subscribedText}>{isLifetimeOwner ? 'Lifetime Pro active' : 'Subscription active'}</Text>
          </View>

          <Text style={styles.headline}>
            You&apos;re on <Text style={styles.headlineAccent}>Ripple Pro</Text>
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.sub, { marginBottom: renewalHint ? 8 : 24 }]}>{titleLine}</Text>
            {renewalHint ? (
              <Text style={[styles.sub, { fontSize: alarmTypography.caption, lineHeight: alarmTypography.caption + 6, marginBottom: 0 }]}>{renewalHint}</Text>
            ) : null}
          </View>

          {!isLifetimeOwner ? (
            <>
              <Text style={[styles.sub, { fontSize: alarmTypography.caption, marginBottom: 12 }]}>
                Switch between monthly and annual anytime — {subscriptionBillingProviderLabel()} may prorate or schedule the
                change for your next renewal.
              </Text>
            </>
          ) : (
            <Text style={[styles.sub, { fontSize: alarmTypography.caption, marginBottom: 12 }]}>
              You own Ripple Pro forever on this account. No renewals or cancellation needed.
            </Text>
          )}

          <Text style={[styles.sub, { fontSize: alarmTypography.caption, marginBottom: 12 }]}>Included with your plan:</Text>

          <View style={[styles.features, { marginBottom: 16 }]}>
            {PRO_PLAN_FEATURES.map((text) => (
              <FeatureRow key={text} text={text} />
            ))}
          </View>

          {loadingOfferings ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={alarmTheme.accent} />
              <Text style={styles.loadingLabel}>Loading plans…</Text>
            </View>
          ) : null}

          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
              <Pressable onPress={() => void loadOfferings()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : null}

          {!isLifetimeOwner ? (
            <PricingToggle
              selected={plan}
              onSelect={selectPlan}
              lifetimePriceLabel={lifetimePriceLabel}
              annualPriceLabel={annualPriceLabel}
              monthlyPriceLabel={monthlyPriceLabel}
              showLifetime={showLifetimeOption}
              showSubscriptions={showSubscriptionOptions}
              disabled={loadingOfferings || purchasing}
              afterLifetime={
                showLifetimeOption && plan === 'lifetime' ? (
                  <Pressable
                    disabled={ownsSelectedPlan || !canPurchase || purchasing}
                    onPress={() => void onSubscribe()}>
                    <LinearGradient
                      colors={ownsSelectedPlan ? ['#334155', '#475569'] : ['#06b6d4', '#0891b2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.ctaBtn,
                        { marginBottom: 4 },
                        (ownsSelectedPlan || !canPurchase || purchasing) && styles.ctaDisabled,
                      ]}>
                      <Text style={styles.ctaText}>
                        {purchasing
                          ? 'Processing…'
                          : ownsSelectedPlan
                            ? 'Current plan'
                            : 'Buy Lifetime Pro'}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                ) : null
              }
            />
          ) : null}

          {!isLifetimeOwner && (!showLifetimeOption || plan !== 'lifetime') ? (
            <Pressable
              disabled={ownsSelectedPlan || !canPurchase || purchasing}
              onPress={() => void onSubscribe()}>
              <LinearGradient
                colors={ownsSelectedPlan ? ['#334155', '#475569'] : ['#06b6d4', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.ctaBtn,
                  (ownsSelectedPlan || !canPurchase || purchasing) && styles.ctaDisabled,
                ]}>
                <Text style={styles.ctaText}>
                  {purchasing
                    ? 'Processing…'
                    : ownsSelectedPlan
                      ? 'Current plan'
                      : plan === 'annual'
                        ? 'Switch to Annual'
                        : 'Switch to Monthly'}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {!isLifetimeOwner ? (
            <>
              <Text style={[styles.footerNote, { marginBottom: 6 }]}>
                Subscriptions are billed through {subscriptionBillingProviderLabel()}. To stop future charges, cancel in your
                store account.
              </Text>
              <Pressable disabled={purchasing} onPress={() => openSubscriptionManagement()}>
                <Text style={[styles.cancelSubscriptionLink, purchasing && styles.restoreMuted]}>
                  Cancel subscription
                </Text>
              </Pressable>
              <Text style={[styles.footerNote, { marginTop: 4 }]}>
                Opens {subscriptionStoreLabel()} subscription management for Ripple Pro.
              </Text>
            </>
          ) : null}
        </ScrollView>

        <FullScreenLoadingOverlay variant="embedded" visible={purchasing && !loadError} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.glowBg} />

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>{paywallIcons.close}</Text>
      </Pressable>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}>
        <View style={styles.proIconWrap}>
          <View style={styles.proIconCircle}>
            <Text style={styles.proIcon}>{paywallIcons.pro}</Text>
          </View>
        </View>

        {isRingLimitPaywall ? (
          <View style={styles.limitBox}>
            <Text style={styles.limitText}>{freeTierRingLimitPaywallBanner()}</Text>
          </View>
        ) : showAlarmLimitReached ? (
          <View style={styles.limitBox}>
            <Text style={styles.limitText}>
              You&apos;ve reached the {FREE_TIER_MAX_ALARMS}-alarm free limit
            </Text>
          </View>
        ) : null}

        <Text style={styles.headline}>
          Unlock <Text style={styles.headlineAccent}>Ripple Pro</Text>
        </Text>
        <Text style={styles.sub}>
          {showLifetimeOption
            ? `${lifetimePaywallHeadlineSuffix()} ${proTrialPaywallSubline()}`
            : proTrialPaywallSubline()}
        </Text>

        <View style={styles.features}>
          {PRO_PLAN_FEATURES.map((text) => (
            <FeatureRow key={text} text={text} />
          ))}
        </View>

        {loadingOfferings ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={alarmTheme.accent} />
            <Text style={styles.loadingLabel}>Loading plans…</Text>
          </View>
        ) : null}

        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable onPress={() => void loadOfferings()}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}

        <PricingToggle
          selected={plan}
          onSelect={selectPlan}
          lifetimePriceLabel={lifetimePriceLabel}
          annualPriceLabel={annualPriceLabel}
          monthlyPriceLabel={monthlyPriceLabel}
          showLifetime={showLifetimeOption}
          showSubscriptions={showSubscriptionOptions}
          disabled={loadingOfferings || restoring}
          afterLifetime={
            showLifetimeOption && plan === 'lifetime' ? (
              <>
                <Pressable
                  disabled={!canPurchase || purchasing || restoring}
                  onPress={() => void onSubscribe()}>
                  <LinearGradient
                    colors={['#06b6d4', '#0891b2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.ctaBtn,
                      { marginBottom: 4 },
                      (!canPurchase || purchasing || restoring) && styles.ctaDisabled,
                    ]}>
                    <Text style={styles.ctaText}>
                      {purchasing
                        ? 'Processing…'
                        : `Buy Lifetime Pro ${paywallIcons.arrow}`}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Text style={[styles.footerNote, { marginBottom: 0 }]}>
                  {`One-time purchase through the ${subscriptionStoreLabel()} · Restore on new devices anytime`}
                </Text>
              </>
            ) : null
          }
        />

        {!showLifetimeOption || plan !== 'lifetime' ? (
          <>
            <Pressable disabled={!canPurchase || purchasing || restoring} onPress={() => void onSubscribe()}>
              <LinearGradient
                colors={['#06b6d4', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaBtn, (!canPurchase || purchasing || restoring) && styles.ctaDisabled]}>
                <Text style={styles.ctaText}>
                  {purchasing
                    ? 'Processing…'
                    : `${proTrialSubscribeCtaLabel()} ${paywallIcons.arrow}`}
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.footerNote}>
              {proTrialSubscriptionFooter(subscriptionStoreLabel())}
            </Text>
          </>
        ) : null}

        <Pressable disabled={restoring || purchasing || loadingOfferings} onPress={() => void onRestore()}>
          <Text style={[styles.restore, restoring && styles.restoreMuted]}>
            {restoring ? 'Restoring…' : 'Restore purchases'}
          </Text>
        </Pressable>
      </ScrollView>

      <FullScreenLoadingOverlay variant="embedded" visible={purchasing && !loadError} />
    </View>
  );
}
