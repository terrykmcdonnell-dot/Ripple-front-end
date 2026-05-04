import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { widgetIcons } from '@/assets/icons/widget-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { WidgetMediumCard } from '@/components/widget/WidgetMediumCard';
import { WidgetSmallCard } from '@/components/widget/WidgetSmallCard';
import { useRequireAuth } from '@/hooks/use-require-auth';

function createDockStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#1a1a2e',
    },
    dotOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    content: {
      flex: 1,
      paddingTop: 70,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    lockTime: {
      color: '#ffffff',
      fontSize: 64,
      fontWeight: '800',
      letterSpacing: -2.5,
      textAlign: 'center',
      lineHeight: 64,
      marginBottom: 4,
    },
    lockDate: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 28,
    },
    sectionLabel: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 12,
      fontFamily: 'monospace',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    v2Badge: {
      backgroundColor: 'rgba(251,191,36,0.12)',
      color: '#fbbf24',
      fontSize: 10,
      fontFamily: 'monospace',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
      textTransform: 'none',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    dock: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 20,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingVertical: 12,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    dockIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rippleDockIcon: {
      backgroundColor: alarmTheme.accent,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    dockIconText: {
      fontSize: 24,
    },
  });
}

export default function WidgetScreen() {
  useRequireAuth();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createDockStyles(alarmTheme), [alarmTheme]);
  const [smallToggleOn, setSmallToggleOn] = useState(true);

  const mediumAlarms = useMemo(
    () => [
      { emoji: widgetIcons.medication, name: 'Take Medication', next: 'Tomorrow · Every 3 days', time: '7:00' },
      {
        emoji: widgetIcons.plants,
        name: 'Water the Plants',
        next: 'Today · Every 2 days',
        time: '8:30',
        timeColor: alarmTheme.green,
      },
      {
        emoji: widgetIcons.meal,
        name: 'Meal Prep Day',
        next: 'In 3 days · Every 4 days',
        time: '7:00',
        timeColor: 'rgba(255,255,255,0.7)',
      },
    ],
    [alarmTheme.green],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.dotOverlay} />

      <View style={styles.content}>
        <Text style={styles.lockTime}>9:41</Text>
        <Text style={styles.lockDate}>Thursday, 24 April</Text>

        <Text style={styles.sectionLabel}>
          Ripple Widgets <Text style={styles.v2Badge}>V2</Text>
        </Text>

        <View style={styles.row}>
          <WidgetSmallCard
            headerIcon={widgetIcons.alarm}
            headerTitle="Ripple"
            title="Take Medication"
            time="7:00"
            subtitle="↻ EVERY 3 DAYS · IN 21H"
            enabled={smallToggleOn}
            onToggle={() => setSmallToggleOn((v) => !v)}
          />
          <WidgetSmallCard
            headerIcon={widgetIcons.medication}
            headerTitle="Medication"
            title=""
            time=""
            subtitle=""
            mode="countdown"
            countValue="0"
            countLabel="Tomorrow at"
            countTime="7:00 AM"
          />
        </View>

        <WidgetMediumCard alarms={mediumAlarms} />
      </View>

      <View style={styles.dock}>
        <View style={styles.dockIcon}>
          <Text style={styles.dockIconText}>{widgetIcons.camera}</Text>
        </View>
        <View style={styles.dockIcon}>
          <Text style={styles.dockIconText}>{widgetIcons.messages}</Text>
        </View>
        <View style={[styles.dockIcon, styles.rippleDockIcon]}>
          <Text style={styles.dockIconText}>{widgetIcons.alarm}</Text>
        </View>
        <View style={styles.dockIcon}>
          <Text style={styles.dockIconText}>{widgetIcons.music}</Text>
        </View>
      </View>
    </View>
  );
}
