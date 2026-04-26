import { Pressable, StyleSheet, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type AlarmToggleProps = {
  enabled: boolean;
  onColor?: string;
  onPress?: () => void;
};

export function AlarmToggle({ enabled, onColor, onPress }: AlarmToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      style={[
        styles.track,
        {
          backgroundColor: enabled ? (onColor ?? alarmTheme.accent) : alarmTheme.surface3,
        },
      ]}>
      <View style={[styles.knob, enabled ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  knobOn: {
    left: 21,
  },
  knobOff: {
    left: 3,
  },
});
