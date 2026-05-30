import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { AppModal } from '@/components/ui/AppModal';

export type AppConfirmModalAction = {
  label: string;
  variant?: 'secondary' | 'primary' | 'danger';
  onPress?: () => void;
};

export type AppConfirmModalProps = {
  visible: boolean;
  title: string;
  body: string;
  actions: AppConfirmModalAction[];
  onRequestClose?: () => void;
};

/** Themed confirm dialog — matches delete/skip modals in alarm-edit and settings. */
export function AppConfirmModal({ visible, title, body, actions, onRequestClose }: AppConfirmModalProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createConfirmModalStyles(palette), [palette]);

  return (
    <AppModal
      transparent
      animationType="fade"
      visible={visible}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onRequestClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{body}</Text>
          <View style={styles.modalActions}>
            {actions.map((action) => {
              const btnStyle =
                action.variant === 'primary'
                  ? styles.modalBtnPrimary
                  : action.variant === 'danger'
                    ? styles.modalBtnDanger
                    : styles.modalBtnSecondary;
              const textStyle =
                action.variant === 'primary'
                  ? styles.modalBtnPrimaryText
                  : action.variant === 'danger'
                    ? styles.modalBtnDangerText
                    : styles.modalBtnSecondaryText;

              return (
                <Pressable
                  key={action.label}
                  style={[styles.modalBtn, btnStyle]}
                  onPress={action.onPress}>
                  <Text style={textStyle}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </AppModal>
  );
}

function createConfirmModalStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: alarmTheme.surface,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    modalTitle: {
      color: alarmTheme.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 10,
    },
    modalBody: {
      color: alarmTheme.muted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    modalBtn: {
      minWidth: 96,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    modalBtnSecondary: {
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    modalBtnSecondaryText: {
      color: alarmTheme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    modalBtnPrimary: {
      backgroundColor: alarmTheme.accent,
    },
    modalBtnPrimaryText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    modalBtnDanger: {
      backgroundColor: '#dc2626',
    },
    modalBtnDangerText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
