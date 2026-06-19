import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, Linking } from 'react-native';

import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { AppModal } from '@/components/ui/AppModal';
import {
  formatSnoozeMinutesLabel,
  formatVolumePercentLabel,
  labelForAlarmSoundId,
} from '@/lib/settings-preferences';
import { useBottomSheetPadding } from '@/lib/screen-safe-area';

type NotificationsHubSheetProps = {
  visible: boolean;
  onClose: () => void;
  snoozeMinutes: number;
  soundId: AlarmSoundId;
  vibrationEnabled: boolean;
  volumePercent: number;
  onPressSnooze: () => void;
  onPressSound: () => void;
  onPressVolume: () => void;
  onToggleVibration: (enabled: boolean) => void;
};

export function NotificationsHubSheet({
  visible,
  onClose,
  snoozeMinutes,
  soundId,
  vibrationEnabled,
  volumePercent,
  onPressSnooze,
  onPressSound,
  onPressVolume,
  onToggleVibration,
}: NotificationsHubSheetProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createNotificationsHubStyles(palette), [palette]);
  const sheetPadBottom = useBottomSheetPadding();
  const rowTap = () => void Haptics.selectionAsync();

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalDismiss} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: sheetPadBottom }]}>
          <Text style={styles.sheetTitle}>Notifications</Text>
          <Text style={styles.sheetHint}>
            Snooze, sound & vibration. Alarm volume (Android) targets the alarm stream so rings track your chosen level even when notification volume is low.
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.optionList}>
              <Pressable
                style={[styles.optionRow, styles.optionBorder]}
                onPress={() => {
                  rowTap();
                  onPressSnooze();
                }}
                accessibilityRole="button"
                accessibilityLabel="Default snooze">
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>Default Snooze</Text>
                  <Text style={styles.rowValue}>{formatSnoozeMinutesLabel(snoozeMinutes)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <Pressable
                style={[styles.optionRow, styles.optionBorder]}
                onPress={() => {
                  rowTap();
                  onPressSound();
                }}
                accessibilityRole="button"
                accessibilityLabel="Default sound">
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>Default Sound</Text>
                  <Text style={styles.rowValue}>{labelForAlarmSoundId(soundId)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={[styles.optionRow, styles.optionBorder]}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>Vibration</Text>
                  <Text style={styles.rowValue}>{vibrationEnabled ? 'On' : 'Off'}</Text>
                </View>
                <AlarmToggle
                  enabled={vibrationEnabled}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void onToggleVibration(!vibrationEnabled);
                  }}
                />
              </View>

              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  rowTap();
                  onPressVolume();
                }}
                accessibilityRole="button"
                accessibilityLabel="Alarm volume">
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>Alarm volume</Text>
                  <Text style={styles.rowValue}>{formatVolumePercentLabel(volumePercent)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.systemLink}
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open system notification settings">
              <Text style={styles.systemLinkText}>Open system notification settings</Text>
            </Pressable>
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

function createNotificationsHubStyles(t: AlarmThemePalette) {
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
      maxHeight: '88%',
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
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingBottom: 8,
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
      gap: 12,
    },
    optionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color: t.text,
      fontSize: alarmTypography.body,
      fontWeight: '600',
      marginBottom: 4,
    },
    rowValue: {
      color: t.muted,
      fontSize: alarmTypography.caption,
    },
    chevron: {
      color: t.muted,
      fontSize: alarmTypography.bodyLarge,
      fontWeight: '300',
    },
    systemLink: {
      alignItems: 'center',
      paddingVertical: 14,
      marginBottom: 4,
    },
    systemLinkText: {
      color: t.accentBright,
      fontSize: alarmTypography.caption,
      fontWeight: '600',
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
