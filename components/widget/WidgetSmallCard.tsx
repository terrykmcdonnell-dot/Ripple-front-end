import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmThemes, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type WidgetSmallCardProps = {
  headerIcon: string;
  headerTitle: string;
  title: string;
  time: string;
  subtitle: string;
  mode?: 'alarm' | 'countdown';
  countValue?: string;
  countLabel?: string;
  countTime?: string;
  enabled?: boolean;
  onToggle?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  const glass = alarmTheme === alarmThemes.dark;
  return StyleSheet.create({
    card: {
      width: 155,
      height: 155,
      backgroundColor: glass ? 'rgba(8,8,24,0.85)' : alarmTheme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: glass ? 'rgba(6,182,212,0.2)' : alarmTheme.accentBannerBorder,
      padding: 14,
    },
    header: {
      color: alarmTheme.accentBright,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    logo: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'none',
    },
    nextLabel: {
      color: glass ? 'rgba(255,255,255,0.72)' : alarmTheme.muted,
      fontSize: 11,
      marginBottom: 3,
    },
    alarmName: {
      color: glass ? '#ffffff' : alarmTheme.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16.8,
      marginBottom: 2,
    },
    time: {
      color: alarmTheme.accentBright,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 22,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    interval: {
      color: glass ? 'rgba(255,255,255,0.68)' : alarmTheme.muted,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    toggleRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    onLabel: {
      color: glass ? 'rgba(255,255,255,0.72)' : alarmTheme.muted,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    toggle: {
      width: 34,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
    },
    toggleOn: {
      backgroundColor: alarmTheme.accent,
    },
    toggleOff: {
      backgroundColor: glass ? 'rgba(255,255,255,0.2)' : alarmTheme.surface3,
    },
    knob: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#ffffff',
      position: 'absolute',
      top: 3,
    },
    knobOn: {
      left: 17,
    },
    knobOff: {
      left: 3,
    },
    countValue: {
      fontSize: 42,
      fontWeight: '800',
      color: alarmTheme.accentBright,
      lineHeight: 42,
      marginBottom: 4,
    },
    countLabel: {
      fontSize: 12,
      color: glass ? 'rgba(255,255,255,0.72)' : alarmTheme.muted,
    },
    countTime: {
      fontSize: 16,
      fontWeight: '700',
      color: glass ? '#ffffff' : alarmTheme.text,
    },
  });
}

export function WidgetSmallCard({
  headerIcon,
  headerTitle,
  title,
  time,
  subtitle,
  mode = 'alarm',
  countValue,
  countLabel,
  countTime,
  enabled,
  onToggle,
}: WidgetSmallCardProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.card}>
      <Text style={styles.header}>
        {headerIcon} <Text style={styles.logo}>{headerTitle}</Text>
      </Text>
      {mode === 'alarm' ? (
        <>
          <Text style={styles.nextLabel}>Next alarm</Text>
          <Text style={styles.alarmName}>{title}</Text>
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.interval}>{subtitle}</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.onLabel}>{enabled ? 'ON' : 'OFF'}</Text>
            <Pressable
              style={[styles.toggle, enabled ? styles.toggleOn : styles.toggleOff]}
              onPress={onToggle}>
              <View style={[styles.knob, enabled ? styles.knobOn : styles.knobOff]} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.nextLabel}>Days until next</Text>
          <Text style={styles.countValue}>{countValue ?? '0'}</Text>
          <Text style={styles.countLabel}>{countLabel ?? 'Tomorrow at'}</Text>
          <Text style={styles.countTime}>{countTime ?? '7:00 AM'}</Text>
        </>
      )}
    </View>
  );
}
