import * as Haptics from 'expo-haptics';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';
import { formatSnoozeMinutesLabel } from '@/lib/settings-preferences';

type SnoozePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  options: readonly number[];
  selectedMinutes: number;
  onSelectMinutes: (minutes: number) => void;
};

export function SnoozePickerSheet({
  visible,
  onClose,
  options,
  selectedMinutes,
  onSelectMinutes,
}: SnoozePickerSheetProps) {
  const pick = (minutes: number) => {
    void Haptics.selectionAsync();
    onSelectMinutes(minutes);
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
          <Text style={styles.sheetTitle}>Default Snooze</Text>
          <Text style={styles.sheetHint}>Used when you snooze an alarm</Text>
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
                    {formatSnoozeMinutesLabel(m)}
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

const styles = StyleSheet.create({
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
    backgroundColor: alarmTheme.surface,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: alarmTheme.border,
  },
  sheetTitle: {
    color: alarmTheme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  sheetHint: {
    color: alarmTheme.muted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  optionList: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alarmTheme.border,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: alarmTheme.surface2,
    borderBottomWidth: 1,
    borderBottomColor: alarmTheme.border,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionLabel: {
    color: alarmTheme.text,
    fontSize: 16,
    fontWeight: '500',
  },
  optionLabelActive: {
    color: alarmTheme.accentBright,
  },
  check: {
    color: alarmTheme.accentBright,
    fontSize: 18,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
  },
  cancelText: {
    color: alarmTheme.muted,
    fontSize: 16,
    fontWeight: '600',
  },
});
