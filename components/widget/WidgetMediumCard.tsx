import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isAlarmPaletteDark, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type WidgetAlarm = {
  emoji: string;
  name: string;
  next: string;
  time: string;
  timeColor?: string;
};

type WidgetMediumCardProps = {
  alarms: WidgetAlarm[];
};

function createStyles(alarmTheme: AlarmThemePalette) {
  const glass = isAlarmPaletteDark(alarmTheme);
  return StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: glass ? 'rgba(8,8,24,0.85)' : alarmTheme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: glass ? 'rgba(6,182,212,0.2)' : alarmTheme.accentBannerBorder,
      padding: 14,
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    logo: {
      color: glass ? '#ffffff' : alarmTheme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    logoAccent: {
      color: alarmTheme.accentBright,
    },
    count: {
      color: glass ? 'rgba(255,255,255,0.7)' : alarmTheme.muted,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: glass ? 'rgba(255,255,255,0.06)' : alarmTheme.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    emoji: {
      fontSize: 16,
    },
    info: {
      flex: 1,
    },
    name: {
      color: glass ? '#ffffff' : alarmTheme.text,
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 1,
    },
    next: {
      color: glass ? 'rgba(255,255,255,0.7)' : alarmTheme.muted,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    time: {
      color: alarmTheme.accentBright,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

export function WidgetMediumCard({ alarms }: WidgetMediumCardProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Rip<Text style={styles.logoAccent}>ple</Text>
        </Text>
        <Text style={styles.count}>{alarms.length + 2} active alarms</Text>
      </View>
      {alarms.map((alarm, idx) => (
        <View key={`${alarm.name}-${alarm.time}`} style={[styles.row, idx === alarms.length - 1 ? styles.lastRow : null]}>
          <Text style={styles.emoji}>{alarm.emoji}</Text>
          <View style={styles.info}>
            <Text style={styles.name}>{alarm.name}</Text>
            <Text style={styles.next}>{alarm.next}</Text>
          </View>
          <Text style={[styles.time, alarm.timeColor ? { color: alarm.timeColor } : null]}>{alarm.time}</Text>
        </View>
      ))}
    </View>
  );
}
