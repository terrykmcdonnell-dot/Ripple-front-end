import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { AppModal } from '@/components/ui/AppModal';
import { previewAlarmSoundId, resolveAlarmPreviewVolumePercent, stopAlarmSoundPreview } from '@/lib/preview-alarm-sound';
import { useBottomSheetPadding } from '@/lib/screen-safe-area';

export type SoundPickerOption = { id: string; label: string };

type SoundPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  options: readonly SoundPickerOption[];
  selectedId: string;
  /** Called only after the user taps OK with a staged choice that differs from the value when the sheet opened. */
  onSelectSoundId: (id: string) => void;
  sheetTitle?: string;
  sheetHint?: string;
  /** When set, sound previews use this level instead of loading from storage. */
  previewVolumePercent?: number;
  /** Pro-only sounds — row shows lock label and triggers {@link onLockedSoundPress}. */
  isSoundLocked?: (id: string) => boolean;
  onLockedSoundPress?: () => void;
  /** Passed to preview playback so free users hear the resolved fallback, not locked sounds. */
  isSubscriber?: boolean;
};

export function SoundPickerSheet({
  visible,
  onClose,
  options,
  selectedId,
  onSelectSoundId,
  sheetTitle = 'Default Sound',
  sheetHint = 'Sounds preview when you open this sheet and when you tap a row. Tap OK to apply.',
  previewVolumePercent,
  isSoundLocked,
  onLockedSoundPress,
  isSubscriber = true,
}: SoundPickerSheetProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createSoundPickerStyles(palette), [palette]);
  const sheetPadBottom = useBottomSheetPadding();

  const [pendingId, setPendingId] = useState(selectedId);
  const committedOnOpenRef = useRef(selectedId);

  useEffect(() => {
    if (!visible) {
      void stopAlarmSoundPreview();
      return;
    }
    committedOnOpenRef.current = selectedId;
    setPendingId(selectedId);
    void (async () => {
      const volume = await resolveAlarmPreviewVolumePercent(previewVolumePercent);
      await previewAlarmSoundId(selectedId, volume, isSubscriber);
    })();
  }, [visible, selectedId, previewVolumePercent, isSubscriber]);

  const dismiss = () => {
    void stopAlarmSoundPreview();
    onClose();
  };

  const onRowPress = async (id: string) => {
    if (isSoundLocked?.(id)) {
      onLockedSoundPress?.();
      return;
    }
    void Haptics.selectionAsync();
    setPendingId(id);
    const volume = await resolveAlarmPreviewVolumePercent(previewVolumePercent);
    await previewAlarmSoundId(id, volume, isSubscriber);
  };

  const onConfirm = () => {
    if (isSoundLocked?.(pendingId)) {
      onLockedSoundPress?.();
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void stopAlarmSoundPreview();
    if (pendingId !== committedOnOpenRef.current) {
      onSelectSoundId(pendingId);
    }
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={dismiss}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalDismiss} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: sheetPadBottom }]}>
          <Text style={styles.sheetTitle}>{sheetTitle}</Text>
          <Text style={styles.sheetHint}>{sheetHint}</Text>
          <View style={styles.optionList}>
            {options.map((opt, index) => {
              const active = opt.id === pendingId;
              const locked = isSoundLocked?.(opt.id) ?? false;
              const noBorder = index === options.length - 1;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.optionRow, noBorder ? styles.optionRowLast : null, locked ? styles.optionRowLocked : null]}
                  onPress={() => void onRowPress(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: locked }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      active ? styles.optionLabelActive : null,
                      locked ? styles.optionLabelLocked : null,
                    ]}>
                    {locked ? `${opt.label} · Pro` : opt.label}
                  </Text>
                  {active && !locked ? <Text style={styles.check}>✓</Text> : null}
                  {locked ? <Text style={styles.lock}>🔒</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.okBtn} onPress={onConfirm} accessibilityRole="button">
            <Text style={styles.okText}>OK</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

function createSoundPickerStyles(t: AlarmThemePalette) {
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
    optionLabelLocked: {
      color: t.muted,
    },
    optionRowLocked: {
      opacity: 0.72,
    },
    check: {
      color: t.accentBright,
      fontSize: alarmTypography.bodyLarge,
      fontWeight: '700',
    },
    lock: {
      fontSize: alarmTypography.caption,
    },
    okBtn: {
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: t.accent,
      borderWidth: 1,
      borderColor: t.accent,
      marginBottom: 10,
    },
    okText: {
      color: '#ffffff',
      fontSize: alarmTypography.body,
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
