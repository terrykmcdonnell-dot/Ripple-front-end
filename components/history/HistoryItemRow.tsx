import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type RowStatus = 'dismissed' | 'snoozed' | 'missed';

type HistoryItemRowProps = {
  icon: string;
  name: string;
  timeText: string;
  status: RowStatus;
};

function statusMapFor(t: AlarmThemePalette) {
  return {
    dismissed: {
      iconBg: t.greenDim,
      badgeBg: t.greenDim,
      badgeColor: t.green,
      label: 'Dismissed',
    },
    snoozed: {
      iconBg: t.amberDim,
      badgeBg: t.amberDim,
      badgeColor: t.amber,
      label: 'Snoozed',
    },
    missed: {
      iconBg: t.redDim,
      badgeBg: t.redDim,
      badgeColor: t.red,
      label: 'Missed',
    },
  } as const;
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 6,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    icon: {
      fontSize: alarmTypography.titleSm,
    },
    info: {
      flex: 1,
    },
    name: {
      color: alarmTheme.text,
      fontSize: alarmTypography.body,
      fontWeight: '500',
      marginBottom: 3,
    },
    time: {
      color: alarmTheme.muted,
      fontSize: alarmTypography.caption,
      fontFamily: 'monospace',
    },
    badge: {
      fontSize: alarmTypography.micro,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 3,
      fontFamily: 'monospace',
      overflow: 'hidden',
    },
  });
}

export function HistoryItemRow({ icon, name, timeText, status }: HistoryItemRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const statusMap = useMemo(() => statusMapFor(alarmTheme), [alarmTheme]);
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
