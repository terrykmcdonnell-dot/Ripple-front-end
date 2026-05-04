import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { useAlarmTheme } from '@/components/alarms/theme';

export type FullScreenLoadingOverlayProps = {
  visible: boolean;
  /** Optional caption below the spinner */
  message?: string;
};

/**
 * Blocks interaction with the entire screen while `visible` — use during awaited API calls.
 */
export function FullScreenLoadingOverlay({ visible, message }: FullScreenLoadingOverlayProps) {
  const t = useAlarmTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}>
      <View style={styles.wrap}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.bg, opacity: 0.96 }]} />
        <View style={styles.content} pointerEvents="none">
          <ActivityIndicator size="large" color={t.accent} />
          {message ? (
            <Text style={[styles.message, { color: t.muted }]} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
