import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

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

export function WidgetMediumCard({ alarms }: WidgetMediumCardProps) {
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

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(8,8,24,0.85)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(124,106,240,0.2)',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  logoAccent: {
    color: alarmTheme.accentBright,
  },
  count: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 1,
  },
  next: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  time: {
    color: alarmTheme.accentBright,
    fontSize: 14,
    fontWeight: '700',
  },
});
