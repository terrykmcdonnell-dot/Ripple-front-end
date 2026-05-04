import * as Haptics from 'expo-haptics';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';
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
          <Text style={styles.sheetTitle}>Volume</Text>
          <Text style={styles.sheetHint}>Default level for alarm playback</Text>
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
