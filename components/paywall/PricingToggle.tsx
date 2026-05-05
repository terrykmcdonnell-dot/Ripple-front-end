import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

export type PricingPlan = 'annual' | 'monthly';

type PricingToggleProps = {
  selected: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
  /** Store price string from RevenueCat (e.g. `$9.99`). Falls back to placeholder when omitted. */
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
      padding: 9,
      alignItems: 'center',
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
      fontSize: 12,
      fontWeight: '600',
      color: alarmTheme.text,
    },
    price: {
      marginTop: 2,
      fontSize: 11,
      color: alarmTheme.muted,
    },
    activeText: {
      color: '#ffffff',
    },
    saveBadge: {
      color: alarmTheme.green,
      backgroundColor: alarmTheme.greenDim,
      fontSize: 9,
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

  const annualLine = annualPriceLabel?.trim() ? `${annualPriceLabel} / year` : '$9.99 / year';
  const monthlyLine = monthlyPriceLabel?.trim() ? `${monthlyPriceLabel} / month` : '$1.99 / month';

  return (
    <View style={[styles.wrap, disabled ? styles.wrapDisabled : null]}>
      <Pressable
        disabled={disabled}
        style={[styles.option, selected === 'annual' ? styles.optionActive : null]}
        onPress={() => onSelect('annual')}>
        <Text style={[styles.name, selected === 'annual' ? styles.activeText : null]}>
          Annual <Text style={styles.saveBadge}>SAVE 58%</Text>
        </Text>
        <Text style={[styles.price, selected === 'annual' ? styles.activeText : null]}>{annualLine}</Text>
      </Pressable>
      <Pressable
        disabled={disabled}
        style={[styles.option, selected === 'monthly' ? styles.optionActive : null]}
        onPress={() => onSelect('monthly')}>
        <Text style={[styles.name, selected === 'monthly' ? styles.activeText : null]}>Monthly</Text>
        <Text style={[styles.price, selected === 'monthly' ? styles.activeText : null]}>{monthlyLine}</Text>
      </Pressable>
    </View>
  );
}
