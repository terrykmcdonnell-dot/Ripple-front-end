import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { alarmTypography, useAlarmTheme } from '@/components/alarms/theme';

export type FullScreenLoadingOverlayProps = {
  visible: boolean;
  /** Optional caption below the spinner */
  message?: string;
  /**
   * `modal` — separate native Modal (blocks whole app).
   * `embedded` — absolutely positioned inside parent — prefer when the next frame navigates away;
   * avoids Android Fabric races between Modal teardown and stack transitions (`child already has a parent`).
   */
  variant?: 'modal' | 'embedded';
};

/**
 * Blocks interaction with the entire screen while `visible` — use during awaited API calls.
 */
export function FullScreenLoadingOverlay({
  visible,
  message,
  variant = 'modal',
}: FullScreenLoadingOverlayProps) {
  const t = useAlarmTheme();

  if (!visible) {
    return null;
  }

  const backdrop = (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.bg, opacity: 0.96 }]} />
  );
  const spinnerBlock = (
    <View style={styles.content} pointerEvents="none">
      <ActivityIndicator size="large" color={t.accent} />
      {message ? (
        <Text style={[styles.message, { color: t.muted }]} numberOfLines={2}>
          {message}
        </Text>
      ) : null}
    </View>
  );

  if (variant === 'embedded') {
    return (
      <View
        collapsable={false}
        pointerEvents="auto"
        style={[StyleSheet.absoluteFillObject, styles.wrap, styles.embeddedLayer]}>
        {backdrop}
        {spinnerBlock}
      </View>
    );
  }

  return (
    <AppModal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}>
      <View style={styles.wrap}>
        {backdrop}
        {spinnerBlock}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  embeddedLayer: {
    zIndex: 100000,
    elevation: 100000,
  },
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
    fontSize: alarmTypography.caption,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
