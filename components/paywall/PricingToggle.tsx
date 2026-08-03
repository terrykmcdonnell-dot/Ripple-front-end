import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import {
  annualSubscriptionSavingsPercent,
  formatSubscriptionUsd,
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
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      gap: 10,
      marginBottom: 16,
    },
    wrapDisabled: {
      opacity: 0.55,
    },
    lifetimeCard: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      backgroundColor: alarmTheme.surface2,
      paddingVertical: 14,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    lifetimeCardActive: {
      borderColor: alarmTheme.accent,
      backgroundColor: alarmTheme.accentDim,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 3,
    },
    lifetimeBadge: {
      color: alarmTheme.green,
      backgroundColor: alarmTheme.greenDim,
      fontSize: 10,
      fontFamily: 'monospace',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 6,
    },
    subscriptionRow: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    option: {
      flex: 1,
      borderRadius: 9,
      paddingVertical: 11,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    optionActive: {
      backgroundColor: alarmTheme.accent,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
    name: {
      fontSize: alarmTypography.caption,
      fontWeight: '600',
      color: alarmTheme.text,
    },
    price: {
      marginTop: 4,
      fontSize: alarmTypography.micro,
      color: alarmTheme.muted,
    },
    activeText: {
      color: '#ffffff',
    },
    saveBadge: {
      color: alarmTheme.green,
      backgroundColor: alarmTheme.greenDim,
      fontSize: 10,
      fontFamily: 'monospace',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: 'hidden',
    },
    orSubscribe: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
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
}: PricingToggleProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const lifetimeLine = lifetimePriceLabel?.trim()
    ? `${lifetimePriceLabel} once`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.lifetime)} once`;
  const annualLine = annualPriceLabel?.trim()
    ? `${annualPriceLabel} / year`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.annual)} / year`;
  const monthlyLine = monthlyPriceLabel?.trim()
    ? `${monthlyPriceLabel} / month`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.monthly)} / month`;
  const savingsPercent = annualSubscriptionSavingsPercent();

  return (
    <View style={[styles.wrap, disabled ? styles.wrapDisabled : null]} pointerEvents={disabled ? 'none' : 'auto'}>
      {showLifetime ? (
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === 'lifetime' }}
          style={[styles.lifetimeCard, selected === 'lifetime' ? styles.lifetimeCardActive : null]}
          onPress={() => onSelect('lifetime')}>
          <Text style={styles.lifetimeBadge}>PAY ONCE · KEEP FOREVER</Text>
          <Text style={[styles.name, selected === 'lifetime' ? { color: alarmTheme.accentBright } : null]}>
            Lifetime Pro
          </Text>
          <Text style={[styles.price, selected === 'lifetime' ? { color: alarmTheme.text } : null]}>{lifetimeLine}</Text>
        </Pressable>
      ) : null}

      {showLifetime && showSubscriptions ? <Text style={styles.orSubscribe}>Or subscribe</Text> : null}

      {showSubscriptions ? (
        <View style={styles.subscriptionRow}>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === 'annual' }}
            hitSlop={8}
            style={[styles.option, selected === 'annual' ? styles.optionActive : null]}
            onPress={() => onSelect('annual')}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Text style={[styles.name, selected === 'annual' ? styles.activeText : null]}>Annual</Text>
                <Text style={styles.saveBadge}>SAVE {savingsPercent}%</Text>
              </View>
              <Text style={[styles.price, selected === 'annual' ? styles.activeText : null]}>{annualLine}</Text>
            </View>
          </Pressable>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === 'monthly' }}
            hitSlop={8}
            style={[styles.option, selected === 'monthly' ? styles.optionActive : null]}
            onPress={() => onSelect('monthly')}>
            <Text style={[styles.name, selected === 'monthly' ? styles.activeText : null]}>Monthly</Text>
            <Text style={[styles.price, selected === 'monthly' ? styles.activeText : null]}>{monthlyLine}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
