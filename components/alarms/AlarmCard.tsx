import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { alarmTheme, AlarmTone } from '@/components/alarms/theme';

type AlarmCardProps = {
  icon: string;
  time: string;
  ampm: string;
  label: string;
  tagText: string;
  active: boolean;
  tone: AlarmTone;
  toggleOnColor?: string;
  onToggle?: () => void;
  toggleDisabled?: boolean;
  onPress?: () => void;
};

const toneStyles: Record<AlarmTone, { stripe: string; iconBg: string }> = {
  purple: {
    stripe: alarmTheme.accent,
    iconBg: alarmTheme.accentDim,
  },
  green: {
    stripe: alarmTheme.green,
    iconBg: alarmTheme.greenDim,
  },
  amber: {
    stripe: alarmTheme.amber,
    iconBg: alarmTheme.amberDim,
  },
  off: {
    stripe: alarmTheme.border,
    iconBg: alarmTheme.surface2,
  },
};

export function AlarmCard({
  icon,
  time,
  ampm,
  label,
  tagText,
  active,
  tone,
  toggleOnColor,
  onToggle,
  toggleDisabled,
  onPress,
}: AlarmCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: active ? toneStyle.stripe : alarmTheme.border }]} />
      <Pressable style={styles.cardMain} onPress={onPress}>
        <View style={[styles.icon, { backgroundColor: active ? toneStyle.iconBg : alarmTheme.surface2 }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: active ? alarmTheme.text : alarmTheme.muted }]}>{time}</Text>
            <Text style={styles.ampm}>{ampm}</Text>
          </View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.tag}>
            {tagText}
          </Text>
        </View>
      </Pressable>
      <AlarmToggle
        enabled={active}
        onColor={toggleOnColor}
        onPress={onToggle}
        disabled={toggleDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: alarmTheme.surface,
    borderColor: alarmTheme.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 19,
  },
  info: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  time: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 24,
  },
  ampm: {
    fontSize: 12,
    fontWeight: '500',
    color: alarmTheme.muted,
  },
  label: {
    fontSize: 12,
    color: alarmTheme.muted,
    marginBottom: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: '#d6def7',
    fontFamily: 'monospace',
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#404040',
    paddingVertical: 4,
    paddingHorizontal: 9,
    overflow: 'hidden',
  },
});
