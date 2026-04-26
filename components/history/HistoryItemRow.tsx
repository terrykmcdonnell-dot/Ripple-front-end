import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type RowStatus = 'dismissed' | 'snoozed' | 'missed';

type HistoryItemRowProps = {
  icon: string;
  name: string;
  timeText: string;
  status: RowStatus;
};

const statusMap = {
  dismissed: {
    iconBg: 'rgba(52,211,153,0.12)',
    badgeBg: 'rgba(52,211,153,0.12)',
    badgeColor: '#34d399',
    label: 'Dismissed',
  },
  snoozed: {
    iconBg: 'rgba(251,191,36,0.12)',
    badgeBg: 'rgba(251,191,36,0.12)',
    badgeColor: '#fbbf24',
    label: 'Snoozed',
  },
  missed: {
    iconBg: 'rgba(248,113,113,0.12)',
    badgeBg: 'rgba(248,113,113,0.12)',
    badgeColor: '#f87171',
    label: 'Missed',
  },
} as const;

export function HistoryItemRow({ icon, name, timeText, status }: HistoryItemRowProps) {
  const s = statusMap[status];
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: s.iconBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.time}>{timeText}</Text>
      </View>
      <Text style={[styles.badge, { backgroundColor: s.badgeBg, color: s.badgeColor }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: alarmTheme.surface,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    color: alarmTheme.text,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  time: {
    color: alarmTheme.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  badge: {
    fontSize: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: 'monospace',
    overflow: 'hidden',
  },
});
