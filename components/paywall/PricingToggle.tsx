import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import {
  annualSubscriptionSavingsPercent,
  formatSubscriptionUsd,
  SUBSCRIPTION_PRICING_USD,
} from '@/lib/subscription-pricing';

export type PricingPlan = 'annual' | 'monthly';

type PricingToggleProps = {
  selected: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
  /** Store price string from RevenueCat (e.g. `$19.99`). Falls back to placeholder when omitted. */
  annualPriceLabel?: string | null;
  monthlyPriceLabel?: string | null;
  disabled?: boolean;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      marginBottom: 16,
    },
    wrapDisabled: {
      opacity: 0.55,
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
  });
}

export function PricingToggle({
  selected,
  onSelect,
  annualPriceLabel,
  monthlyPriceLabel,
  disabled,
}: PricingToggleProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const annualLine = annualPriceLabel?.trim()
    ? `${annualPriceLabel} / year`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.annual)} / year`;
  const monthlyLine = monthlyPriceLabel?.trim()
    ? `${monthlyPriceLabel} / month`
    : `${formatSubscriptionUsd(SUBSCRIPTION_PRICING_USD.monthly)} / month`;
  const savingsPercent = annualSubscriptionSavingsPercent();

  return (
    <View style={[styles.wrap, disabled ? styles.wrapDisabled : null]} pointerEvents={disabled ? 'none' : 'auto'}>
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
  );
}
