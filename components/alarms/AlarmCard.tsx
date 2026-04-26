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
  onPress?: () => void;
};

const toneStyles: Record<AlarmTone, { stripe: string; iconBg: string; tagBg: string; tagColor: string }> = {
  purple: {
    stripe: alarmTheme.accent,
    iconBg: alarmTheme.accentDim,
    tagBg: alarmTheme.accentDim,
    tagColor: alarmTheme.accentBright,
  },
  green: {
    stripe: alarmTheme.green,
    iconBg: alarmTheme.greenDim,
    tagBg: alarmTheme.greenDim,
    tagColor: alarmTheme.green,
  },
  amber: {
    stripe: alarmTheme.amber,
    iconBg: alarmTheme.amberDim,
    tagBg: alarmTheme.amberDim,
    tagColor: alarmTheme.amber,
  },
  off: {
    stripe: alarmTheme.border,
    iconBg: alarmTheme.surface2,
    tagBg: 'rgba(255,255,255,0.05)',
    tagColor: alarmTheme.muted,
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
  onPress,
}: AlarmCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.stripe, { backgroundColor: active ? toneStyle.stripe : alarmTheme.border }]} />
      <View style={[styles.icon, { backgroundColor: active ? toneStyle.iconBg : alarmTheme.surface2 }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: active ? alarmTheme.text : alarmTheme.muted }]}>{time}</Text>
          <Text style={styles.ampm}>{ampm}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.tag, { backgroundColor: toneStyle.tagBg, color: toneStyle.tagColor }]}>
          {tagText}
        </Text>
      </View>
      <AlarmToggle enabled={active} onColor={toggleOnColor} onPress={onToggle} />
    </Pressable>
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
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
    fontSize: 11,
    color: alarmTheme.muted,
    marginBottom: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontFamily: 'monospace',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
});
