import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import {
  annualSubscriptionSavingsPercent,
  formatSubscriptionUsd,
  proTrialShortLabel,
  SUBSCRIPTION_PRICING_USD,
} from '@/lib/subscription-pricing';

export type PricingPlan = 'lifetime' | 'annual' | 'monthly';

type PricingToggleProps = {
  selected: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
  /** Store price string from RevenueCat (e.g. `$34.99`). Falls back to placeholder when omitted. */
  lifetimePriceLabel?: string | null;
  annualPriceLabel?: string | null;
  monthlyPriceLabel?: string | null;
  showLifetime?: boolean;
  showSubscriptions?: boolean;
  disabled?: boolean;
  /** Rendered directly under the lifetime card (e.g. primary Buy CTA). */
  afterLifetime?: ReactNode;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      gap: 12,
      marginBottom: 16,
    },
    wrapDisabled: {
      opacity: 0.55,
    },
    lifetimeCard: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: alarmTheme.accent,
      backgroundColor: alarmTheme.accentDim,
      paddingVertical: 18,
      paddingHorizontal: 16,
      alignItems: 'center',
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    lifetimeCardInactive: {
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface2,
      shadowOpacity: 0,
      elevation: 0,
    },
    recommendedBadge: {
      color: alarmTheme.bg,
      backgroundColor: alarmTheme.accentBright,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 8,
    },
    lifetimeTitle: {
      fontSize: alarmTypography.bodyLarge,
      fontWeight: '800',
      color: alarmTheme.text,
      textAlign: 'center',
    },
    lifetimePrice: {
      marginTop: 6,
      fontSize: alarmTypography.title,
      fontWeight: '800',
      color: alarmTheme.accentBright,
      textAlign: 'center',
    },
    lifetimeSubline: {
      marginTop: 4,
      fontSize: alarmTypography.micro,
      color: alarmTheme.muted,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    subscriptionSection: {
      width: '100%',
      gap: 8,
      paddingTop: 4,
    },
    subscriptionHeading: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      textAlign: 'center',
      fontFamily: 'monospace',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    subscriptionRow: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      padding: 3,
      gap: 3,
    },
    option: {
      flex: 1,
      borderRadius: 9,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    optionActive: {
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.accent,
    },
    name: {
      fontSize: alarmTypography.micro,
      fontWeight: '600',
      color: alarmTheme.muted,
    },
    price: {
      marginTop: 3,
      fontSize: 10,
      color: alarmTheme.muted,
    },
    activeName: {
      color: alarmTheme.text,
    },
    activePrice: {
      color: alarmTheme.muted,
    },
    saveBadge: {
      color: alarmTheme.green,
      backgroundColor: alarmTheme.greenDim,
      fontSize: 9,
      fontFamily: 'monospace',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: 'hidden',
    },
    trialNote: {
      color: alarmTheme.muted,
      fontSize: 10,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
  });
}

export function PricingToggle({
  selected,
  onSelect,
  lifetimePriceLabel,
  annualPriceLabel,
  monthlyPriceLabel,
  showLifetime = true,
  showSubscriptions = true,
  disabled,
  afterLifetime,
}: PricingToggleProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const lifetimeAmount = lifetimePriceLabel?.trim()
    ? lifetimePriceLabel
    : formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.lifetime);
  const annualLine = annualPriceLabel?.trim()
    ? `${annualPriceLabel}/yr`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.annual)}/yr`;
  const monthlyLine = monthlyPriceLabel?.trim()
    ? `${monthlyPriceLabel}/mo`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.monthly)}/mo`;
  const savingsPercent = annualSubscriptionSavingsPercent();
  const lifetimeSelected = selected === 'lifetime';

  return (
    <View style={[styles.wrap, disabled ? styles.wrapDisabled : null]} pointerEvents={disabled ? 'none' : 'auto'}>
      {showLifetime ? (
        <>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: lifetimeSelected }}
            style={[styles.lifetimeCard, !lifetimeSelected ? styles.lifetimeCardInactive : null]}
            onPress={() => onSelect('lifetime')}>
            <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
            <Text style={styles.lifetimeTitle}>Lifetime Pro</Text>
            <Text style={styles.lifetimePrice}>{lifetimeAmount}</Text>
            <Text style={styles.lifetimeSubline}>Pay once · Keep forever · No subscription</Text>
          </Pressable>
          {afterLifetime}
        </>
      ) : null}

      {showLifetime && showSubscriptions ? (
        <View style={styles.subscriptionSection}>
          <Text style={styles.subscriptionHeading}>Prefer a subscription?</Text>
          <Text style={styles.trialNote}>{proTrialShortLabel()} on monthly & annual plans</Text>
          <View style={styles.subscriptionRow}>
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === 'annual' }}
              hitSlop={8}
              style={[styles.option, selected === 'annual' ? styles.optionActive : null]}
              onPress={() => onSelect('annual')}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Text style={[styles.name, selected === 'annual' ? styles.activeName : null]}>Annual</Text>
                  <Text style={styles.saveBadge}>−{savingsPercent}%</Text>
                </View>
                <Text style={[styles.price, selected === 'annual' ? styles.activePrice : null]}>{annualLine}</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === 'monthly' }}
              hitSlop={8}
              style={[styles.option, selected === 'monthly' ? styles.optionActive : null]}
              onPress={() => onSelect('monthly')}>
              <Text style={[styles.name, selected === 'monthly' ? styles.activeName : null]}>Monthly</Text>
              <Text style={[styles.price, selected === 'monthly' ? styles.activePrice : null]}>{monthlyLine}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!showLifetime && showSubscriptions ? (
        <>
          <Text style={styles.trialNote}>{proTrialShortLabel()} on monthly & annual</Text>
          <View style={styles.subscriptionRow}>
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === 'annual' }}
              hitSlop={8}
              style={[styles.option, selected === 'annual' ? styles.optionActive : null]}
              onPress={() => onSelect('annual')}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Text style={[styles.name, selected === 'annual' ? styles.activeName : null]}>Annual</Text>
                  <Text style={styles.saveBadge}>−{savingsPercent}%</Text>
                </View>
                <Text style={[styles.price, selected === 'annual' ? styles.activePrice : null]}>{annualLine}</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === 'monthly' }}
              hitSlop={8}
              style={[styles.option, selected === 'monthly' ? styles.optionActive : null]}
              onPress={() => onSelect('monthly')}>
              <Text style={[styles.name, selected === 'monthly' ? styles.activeName : null]}>Monthly</Text>
              <Text style={[styles.price, selected === 'monthly' ? styles.activePrice : null]}>{monthlyLine}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}
