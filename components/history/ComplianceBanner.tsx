import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type ComplianceBannerProps = {
  percent: number;
  completedText: string;
  detailText: string;
};

export function ComplianceBanner({ percent, completedText, detailText }: ComplianceBannerProps) {
  return (
    <View style={styles.card}>
      <View style={styles.ring}>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{completedText}</Text>
        <Text style={styles.sub}>{detailText}</Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: alarmTheme.surface,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: alarmTheme.accentDim,
    borderWidth: 2,
    borderColor: alarmTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  percent: {
    fontSize: 15,
    fontWeight: '800',
    color: alarmTheme.accentBright,
  },
  info: {
    flex: 1,
  },
  title: {
    color: alarmTheme.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  sub: {
    color: alarmTheme.muted,
    fontSize: 11,
  },
  bar: {
    height: 4,
    backgroundColor: alarmTheme.surface2,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: alarmTheme.accent,
    borderRadius: 2,
  },
});
