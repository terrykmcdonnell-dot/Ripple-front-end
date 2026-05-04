import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { alarmTheme } from '@/components/alarms/theme';

export type NotificationsMasterRowProps = {
  icon: string;
  title: string;
  statusLabel: string;
  statusColor: string;
  summaryLine?: string;
  toggleEnabled: boolean;
  showToggle: boolean;
  onPressHub: () => void;
  onToggle: () => void;
};

export function NotificationsMasterRow({
  icon,
  title,
  statusLabel,
  statusColor,
  summaryLine,
  toggleEnabled,
  showToggle,
  onPressHub,
  onToggle,
}: NotificationsMasterRowProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.pressMain} onPress={onPressHub}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{title}</Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          {summaryLine ? <Text style={styles.summary}>{summaryLine}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {showToggle ? <AlarmToggle enabled={toggleEnabled} onPress={onToggle} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: alarmTheme.border,
  },
  pressMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: alarmTheme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: alarmTheme.text,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
  },
  summary: {
    color: alarmTheme.muted,
    fontSize: 11,
    marginTop: 3,
  },
  chevron: {
    color: alarmTheme.muted,
    fontSize: 13,
    flexShrink: 0,
  },
});
