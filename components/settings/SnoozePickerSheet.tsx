import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { AppModal } from '@/components/ui/AppModal';
import { formatSnoozeMinutesLabel } from '@/lib/settings-preferences';

type SnoozePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  options: readonly number[];
  selectedMinutes: number;
  onSelectMinutes: (minutes: number) => void;
  sheetTitle?: string;
  sheetHint?: string;
  formatOptionLabel?: (minutes: number) => string;
};

export function SnoozePickerSheet({
  visible,
  onClose,
  options,
  selectedMinutes,
  onSelectMinutes,
  sheetTitle = 'Default Snooze',
  sheetHint = 'Used when you snooze an alarm',
  formatOptionLabel = formatSnoozeMinutesLabel,
}: SnoozePickerSheetProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createSnoozePickerStyles(palette), [palette]);

  const pick = (minutes: number) => {
    void Haptics.selectionAsync();
    onSelectMinutes(minutes);
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalDismiss} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{sheetTitle}</Text>
          <Text style={styles.sheetHint}>{sheetHint}</Text>
          <View style={styles.optionList}>
            {options.map((m, index) => {
              const active = m === selectedMinutes;
              const noBorder = index === options.length - 1;
              return (
                <Pressable
                  key={m}
                  style={[styles.optionRow, noBorder ? styles.optionRowLast : null]}
                  onPress={() => pick(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                    {formatOptionLabel(m)}
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
    </AppModal>
  );
}

function createSnoozePickerStyles(t: AlarmThemePalette) {
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
