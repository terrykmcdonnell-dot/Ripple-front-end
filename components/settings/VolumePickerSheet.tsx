import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { formatVolumePercentLabel } from '@/lib/settings-preferences';

type VolumePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  options: readonly number[];
  selectedPercent: number;
  onSelectPercent: (percent: number) => void;
};

export function VolumePickerSheet({
  visible,
  onClose,
  options,
  selectedPercent,
  onSelectPercent,
}: VolumePickerSheetProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createVolumePickerStyles(palette), [palette]);

  const pick = (percent: number) => {
    void Haptics.selectionAsync();
    onSelectPercent(percent);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalDismiss} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Volume preference</Text>
          <Text style={styles.sheetHint}>
            {Platform.OS === 'android'
              ? 'Choosing a level updates alarm volume (rings and snoozes use the alarm stream — more likely to be heard when notification sounds are muted). Saved for your account. Applied only when you pick here — not when opening the app.'
              : Platform.OS === 'ios'
                ? 'Choosing a level adjusts system volume used for alerts and similar sounds. Saved for your account. Applied only when you pick here — not when opening the app.'
                : 'Saved for your account.'}
          </Text>
          <View style={styles.optionList}>
            {options.map((p, index) => {
              const active = p === selectedPercent;
              const noBorder = index === options.length - 1;
              return (
                <Pressable
                  key={p}
                  style={[styles.optionRow, noBorder ? styles.optionRowLast : null]}
                  onPress={() => pick(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                    {formatVolumePercentLabel(p)}
                  </Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createVolumePickerStyles(t: AlarmThemePalette) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalDismiss: {
      flex: 1,
      width: '100%',
    },
    sheet: {
      backgroundColor: t.surface,
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
      paddingHorizontal: 22,
      paddingTop: 22,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: t.border,
    },
    sheetTitle: {
      color: t.text,
      fontSize: alarmTypography.bodyLarge,
      fontWeight: '700',
      marginBottom: 6,
      textAlign: 'center',
    },
    sheetHint: {
      color: t.muted,
      fontSize: alarmTypography.caption,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: alarmTypography.caption + 6,
    },
    optionList: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 18,
      backgroundColor: t.surface2,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    optionRowLast: {
      borderBottomWidth: 0,
    },
    optionLabel: {
      color: t.text,
      fontSize: alarmTypography.body,
      fontWeight: '500',
    },
    optionLabelActive: {
      color: t.accentBright,
    },
    check: {
      color: t.accentBright,
      fontSize: alarmTypography.bodyLarge,
      fontWeight: '700',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: t.surface2,
      borderWidth: 1,
      borderColor: t.border,
    },
    cancelText: {
      color: t.muted,
      fontSize: alarmTypography.body,
      fontWeight: '600',
    },
  });
}
