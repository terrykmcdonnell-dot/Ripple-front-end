import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { alarmTypography, type AlarmThemePalette, type AlarmTone, useAlarmTheme } from '@/components/alarms/theme';

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

function createToneStyles(t: AlarmThemePalette): Record<AlarmTone, { stripe: string; iconBg: string }> {
  return {
    purple: {
      stripe: t.accent,
      iconBg: t.accentDim,
    },
    green: {
      stripe: t.green,
      iconBg: t.greenDim,
    },
    amber: {
      stripe: t.amber,
      iconBg: t.amberDim,
    },
    off: {
      stripe: t.border,
      iconBg: t.surface2,
    },
  };
}

function createStyles(t: AlarmThemePalette) {
  return StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      borderRadius: 18,
      paddingVertical: 16,
      paddingRight: 18,
      paddingLeft: 18,
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
      fontSize: alarmTypography.titleSm,
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
      fontSize: alarmTypography.timeRow,
      fontWeight: '700',
      lineHeight: alarmTypography.timeRow,
    },
    ampm: {
      fontSize: alarmTypography.caption,
      fontWeight: '500',
      color: t.muted,
    },
    label: {
      fontSize: alarmTypography.caption,
      color: t.muted,
      marginBottom: 4,
    },
    tag: {
      alignSelf: 'flex-start',
      fontSize: alarmTypography.caption,
      color: t.muted,
      fontFamily: 'monospace',
      borderRadius: 8,
      backgroundColor: t.surface2,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 5,
      paddingHorizontal: 10,
      overflow: 'hidden',
    },
  });
}

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
  const theme = useAlarmTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toneStyles = useMemo(() => createToneStyles(theme), [theme]);
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: active ? toneStyle.stripe : theme.border }]} />
      <Pressable style={styles.cardMain} onPress={onPress}>
        <View style={[styles.icon, { backgroundColor: active ? toneStyle.iconBg : theme.surface2 }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: active ? theme.text : theme.muted }]}>{time}</Text>
            <Text style={styles.ampm}>{ampm}</Text>
          </View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.tag}>{tagText}</Text>
        </View>
      </Pressable>
      <AlarmToggle enabled={active} onColor={toggleOnColor} onPress={onToggle} disabled={toggleDisabled} />
    </View>
  );
}
