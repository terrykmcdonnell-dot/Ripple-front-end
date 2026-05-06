import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FeatureRow } from '@/components/paywall/FeatureRow';
import { PricingPlan, PricingToggle } from '@/components/paywall/PricingToggle';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { derivePremiumPlan, resolveDisplayedPremiumPlan } from '@/lib/subscription-access';
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
      fontSize: 14,
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
      paddingBottom: 32,
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
      fontSize: 32,
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
      fontSize: 12,
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
      fontSize: 12,
      fontWeight: '700',
    },
    headline: {
      color: alarmTheme.text,
      fontSize: 26,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 6,
      lineHeight: 30,
    },
    headlineAccent: {
      color: alarmTheme.accentBright,
    },
    sub: {
      color: alarmTheme.muted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 24,
    },
    features: {
      gap: 8,
      marginBottom: 24,
    },
    ctaBtn: {
      width: '100%',
      borderRadius: 14,
      paddingVertical: 16,
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
      fontSize: 16,
      fontWeight: '700',
    },
    trialNote: {
      color: alarmTheme.muted,
      fontSize: 11,
      textAlign: 'center',
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    restore: {
      color: alarmTheme.accentBright,
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: 8,
    },
    restoreMuted: {
      color: alarmTheme.muted,
      fontSize: 12,
      textAlign: 'center',
    },
    cancelSubscriptionLink: {
      color: alarmTheme.red,
      fontSize: 13,
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
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    noticeBody: {
      color: alarmTheme.muted,
      fontSize: 13,
      lineHeight: 20,
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
      fontSize: 13,
      marginBottom: 8,
    },
    retryText: {
      color: alarmTheme.accentBright,
      fontSize: 13,
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
      fontSize: 13,
    },
  });
}

export default function PaywallScreen() {
  useRequireAuth();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
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

  const [plan, setPlan] = useState<PricingPlan>('annual');
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | undefined>();
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | undefined>();
  const [loadingOfferings, setLoadingOfferings] = useState(Platform.OS !== 'web');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const monthlyPriceLabel = monthlyPkg?.product.priceString ?? null;
  const annualPriceLabel = annualPkg?.product.priceString ?? null;

  const selectedPackage = plan === 'annual' ? annualPkg : monthlyPkg;
  const canPurchase =
    Platform.OS !== 'web' && isRevenueCatConfigured() && !!selectedPackage && !loadingOfferings && !loadError;

  const displayedPremiumPlan = useMemo(
    () => resolveDisplayedPremiumPlan(customerInfo, dbRow),
    [customerInfo, dbRow],
  );

  const ownsSelectedPlan = useMemo(() => {
    if (displayedPremiumPlan === 'annual') return plan === 'annual';
    if (displayedPremiumPlan === 'monthly') return plan === 'monthly';
    return (
      !!customerInfo &&
      !!selectedPackage &&
      isPackageInActiveSubscription(selectedPackage, customerInfo)
    );
  }, [displayedPremiumPlan, plan, customerInfo, selectedPackage]);

  useEffect(() => {
    if (!isSubscriber || loadingOfferings || loadError) {
      return;
    }
    const resolved = resolveDisplayedPremiumPlan(customerInfo, dbRow);
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
    if (annualActive) {
      setPlan('annual');
      return;
    }
    if (monthlyActive) {
      setPlan('monthly');
      return;
    }
    const derived = derivePremiumPlan(customerInfo);
    if (derived === 'annual') {
      setPlan('annual');
    } else if (derived === 'monthly') {
      setPlan('monthly');
    }
  }, [isSubscriber, customerInfo, dbRow, monthlyPkg, annualPkg, loadingOfferings, loadError]);

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
      setLoadError('Missing RevenueCat API key. Add EXPO_PUBLIC_REVENUECAT_API_KEY to .env and restart Expo.');
      setLoadingOfferings(false);
      setMonthlyPkg(undefined);
      setAnnualPkg(undefined);
      return;
    }

    setLoadingOfferings(true);
    setLoadError(null);
    configureRevenueCat();
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const { monthly, annual } = pickMonthlyAnnualPackages(current ?? undefined);
      setMonthlyPkg(monthly);
      setAnnualPkg(annual);
      if (!monthly && !annual) {
        setLoadError(
          current
            ? 'No subscription packages in this offering. Add Monthly / Annual packages in the RevenueCat dashboard.'
            : 'No current offering. Configure an offering as "current" in RevenueCat.',
        );
      }
      if (monthly && !annual) {
        setPlan('monthly');
      }
      if (annual && !monthly) {
        setPlan('annual');
      }
    } catch (e) {
      setLoadError(purchasesErrorMessage(e));
      setMonthlyPkg(undefined);
      setAnnualPkg(undefined);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      invalidateSubscriptionCache();
      void loadOfferings();
    }, [loadOfferings]),
  );

  const onSubscribe = useCallback(async () => {
    if (!selectedPackage || purchasing) {
      return;
    }
    const wasExistingSubscriber = isSubscriber;
    setPurchasing(true);
    try {
      const { customerInfo: nextInfo } = await Purchases.purchasePackage(selectedPackage);
      await syncPurchasesAfterTransaction();
      invalidateSubscriptionCache();
      if (hasPremiumEntitlement(nextInfo)) {
        showToast(wasExistingSubscriber ? 'Plan updated.' : 'Subscription active. Welcome to Ripple Pro!');
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
  ]);

  const onRestore = useCallback(async () => {
    if (restoring || Platform.OS === 'web') {
      return;
    }
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (hasPremiumEntitlement(customerInfo)) {
        showToast('Purchases restored.');
        await syncPurchasesAfterTransaction();
        invalidateSubscriptionCache();
        scheduleExitAfterPurchaseFlow(navigateAfterSubscriptionSuccess);
      } else {
        showToast('No active subscription found for this account.');
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
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingTop: 100 }]}>
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

  const rcKeyPresent = !!getRevenueCatApiKey();
  const subscriptionGatePending = rcKeyPresent && subLoading;

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

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.proIconWrap}>
            <View style={styles.proIconCircle}>
              <Text style={styles.proIcon}>{paywallIcons.pro}</Text>
            </View>
          </View>

          <View style={styles.subscribedBox}>
            <Text style={styles.subscribedText}>Subscription active</Text>
          </View>

          <Text style={styles.headline}>
            You&apos;re on <Text style={styles.headlineAccent}>Ripple Pro</Text>
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.sub, { marginBottom: renewalHint ? 8 : 24 }]}>{titleLine}</Text>
            {renewalHint ? (
              <Text style={[styles.sub, { fontSize: 12, lineHeight: 18, marginBottom: 0 }]}>{renewalHint}</Text>
            ) : null}
          </View>

          <Text style={[styles.sub, { fontSize: 12, marginBottom: 12 }]}>
            Switch between monthly and annual anytime — Apple / Google may prorate or schedule the change for your next
            renewal.
          </Text>

          <Text style={[styles.sub, { fontSize: 12, marginBottom: 12 }]}>Included with your plan:</Text>

          <View style={[styles.features, { marginBottom: 16 }]}>
            <FeatureRow text="Unlimited alarms — no cap, ever" />
            <FeatureRow text="Home screen widget (iOS + Android)" />
            <FeatureRow text="iCloud & Google sync across devices" />
            <FeatureRow text="Premium themes" />
            <FeatureRow text="Template gallery access" />
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
            onSelect={setPlan}
            annualPriceLabel={annualPriceLabel}
            monthlyPriceLabel={monthlyPriceLabel}
            disabled={loadingOfferings || !!loadError || purchasing}
          />

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

          <Text style={[styles.trialNote, { marginBottom: 6 }]}>
            Subscriptions are billed through {Platform.OS === 'ios' ? 'Apple' : 'Google'}. To stop future charges, cancel
            in your store account.
          </Text>
          <Pressable disabled={purchasing} onPress={() => openSubscriptionManagement()}>
            <Text style={[styles.cancelSubscriptionLink, purchasing && styles.restoreMuted]}>
              Cancel subscription
            </Text>
          </Pressable>
          <Text style={[styles.trialNote, { marginTop: 4 }]}>
            Opens {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} subscription management for Ripple Pro.
          </Text>
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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.proIconWrap}>
          <View style={styles.proIconCircle}>
            <Text style={styles.proIcon}>{paywallIcons.pro}</Text>
          </View>
        </View>

        <View style={styles.limitBox}>
          <Text style={styles.limitText}>You&apos;ve reached the 5-alarm free limit</Text>
        </View>

        <Text style={styles.headline}>
          Unlock <Text style={styles.headlineAccent}>Ripple Pro</Text>
        </Text>
        <Text style={styles.sub}>
          Unlimited alarms, cloud sync, widgets and more — billed through {Platform.OS === 'ios' ? 'Apple' : 'Google'} via
          RevenueCat.
        </Text>

        <View style={styles.features}>
          <FeatureRow text="Unlimited alarms — no cap, ever" />
          <FeatureRow text="Home screen widget (iOS + Android)" />
          <FeatureRow text="iCloud & Google sync across devices" />
          <FeatureRow text="Premium themes" />
          <FeatureRow text="Template gallery access" />
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
          onSelect={setPlan}
          annualPriceLabel={annualPriceLabel}
          monthlyPriceLabel={monthlyPriceLabel}
          disabled={loadingOfferings || !!loadError || restoring}
        />

        <Pressable disabled={!canPurchase || purchasing || restoring} onPress={() => void onSubscribe()}>
          <LinearGradient
            colors={['#06b6d4', '#0891b2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, (!canPurchase || purchasing || restoring) && styles.ctaDisabled]}>
            <Text style={styles.ctaText}>
              {purchasing ? 'Processing…' : `Subscribe ${paywallIcons.arrow}`}
            </Text>
          </LinearGradient>
        </Pressable>

        <Text style={styles.trialNote}>Subscriptions managed by the App Store / Play Store · Cancel anytime in Settings</Text>

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
