import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import {
  cancelStoreSubscriptionFooter,
  lifetimeCancelSubscriptionFirstLabel,
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
    warningAction: {
      color: alarmTheme.accentBright,
      fontSize: alarmTypography.caption,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 10,
      paddingVertical: 4,
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
  onOpenManagement: () => void;
  disabled?: boolean;
};

export function LifetimePurchaseWarning({
  storeLabel,
  onOpenManagement,
  disabled,
}: LifetimePurchaseWarningProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.warningBox}>
      <Text style={styles.warningText}>{lifetimeExistingSubscriptionWarning(storeLabel)}</Text>
      <Pressable disabled={disabled} onPress={onOpenManagement}>
        <Text style={[styles.warningAction, disabled ? styles.cancelMuted : null]}>
          {lifetimeCancelSubscriptionFirstLabel()} →
        </Text>
      </Pressable>
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
          Subscriptions are billed through {billingProviderLabel}. Cancel in {storeLabel} to stop
          future charges.
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
