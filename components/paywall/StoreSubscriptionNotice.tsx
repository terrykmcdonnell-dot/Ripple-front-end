import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import {
  cancelStoreSubscriptionFooter,
  lifetimeExistingSubscriptionWarning,
  lifetimeOwnerActiveSubscriptionReminder,
} from '@/lib/subscription-pricing';

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    warningBox: {
      backgroundColor: alarmTheme.amberDim,
      borderWidth: 1,
      borderColor: `${alarmTheme.amber}55`,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    warningText: {
      color: alarmTheme.amber,
      fontSize: alarmTypography.caption,
      lineHeight: alarmTypography.caption + 8,
      textAlign: 'center',
    },
    footerNote: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.micro,
      textAlign: 'center',
      fontFamily: 'monospace',
      marginBottom: 6,
    },
    cancelLink: {
      color: alarmTheme.red,
      fontSize: alarmTypography.caption,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 12,
    },
    cancelMuted: {
      color: alarmTheme.muted,
    },
  });
}

type LifetimePurchaseWarningProps = {
  storeLabel: string;
  billingProviderLabel: string;
};

export function LifetimePurchaseWarning({
  storeLabel,
  billingProviderLabel,
}: LifetimePurchaseWarningProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.warningBox}>
      <Text style={styles.warningText}>
        {lifetimeExistingSubscriptionWarning(storeLabel, billingProviderLabel)}
      </Text>
    </View>
  );
}

type CancelStoreSubscriptionBlockProps = {
  storeLabel: string;
  billingProviderLabel: string;
  onOpenManagement: () => void;
  disabled?: boolean;
  /** Lifetime owner with a store subscription still renewing. */
  lifetimeOwnerReminder?: boolean;
};

export function CancelStoreSubscriptionBlock({
  storeLabel,
  billingProviderLabel,
  onOpenManagement,
  disabled,
  lifetimeOwnerReminder,
}: CancelStoreSubscriptionBlockProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <>
      {lifetimeOwnerReminder ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            {lifetimeOwnerActiveSubscriptionReminder(storeLabel)}
          </Text>
        </View>
      ) : (
        <Text style={styles.footerNote}>
          Subscriptions are billed through {billingProviderLabel}. To stop future charges, cancel in
          your store account.
        </Text>
      )}
      <Pressable disabled={disabled} onPress={onOpenManagement}>
        <Text style={[styles.cancelLink, disabled ? styles.cancelMuted : null]}>
          Cancel subscription
        </Text>
      </Pressable>
      <Text style={[styles.footerNote, { marginTop: 4, marginBottom: 8 }]}>
        {cancelStoreSubscriptionFooter(storeLabel)}
      </Text>
    </>
  );
}
