import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { alarmIcons, navIcons } from '@/assets/icons/alarm-icons';
import { AlarmCard } from '@/components/alarms/AlarmCard';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { RichWordText } from '@/components/alarms/RichWordText';
import { alarmTheme } from '@/components/alarms/theme';

const initialAlarmRows = [
  { icon: alarmIcons.medication, time: '7:00', ampm: 'AM', label: 'Take Medication', tag: '↻ Every 3 days', active: true, tone: 'purple' as const },
  { icon: alarmIcons.plants, time: '8:30', ampm: 'AM', label: 'Water the Plants', tag: '↻ Every 2 days', active: true, tone: 'green' as const, toggleOnColor: alarmTheme.green },
  { icon: alarmIcons.maintenance, time: '9:00', ampm: 'AM', label: 'Change HVAC Filter', tag: '↻ Every 3 months', active: false, tone: 'amber' as const },
  { icon: alarmIcons.pet, time: '10:00', ampm: 'AM', label: 'Flea Treatment', tag: '↻ Every 30 days', active: false, tone: 'off' as const },
  { icon: alarmIcons.meal, time: '7:00', ampm: 'AM', label: 'Meal Prep Day', tag: '↻ Every 4 days', active: true, tone: 'purple' as const },
];

export default function AlarmScreen() {
  const router = useRouter();
  const [alarmRows, setAlarmRows] = useState(initialAlarmRows);

  const toggleAlarmAt = (index: number) => {
    setAlarmRows((prevRows) =>
      prevRows.map((row, rowIndex) => (rowIndex === index ? { ...row, active: !row.active } : row)),
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.logo}>
          Rip<Text style={styles.logoAccent}>ple</Text>
        </Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/alarm-create')}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.clockWrap}>
        <Text style={styles.bigClock}>9:41</Text>
        <Text style={styles.bigDate}>Thursday, 24 April 2026</Text>
      </View>

      <RichWordText
        style={styles.nextAlarm}
        words={[
          { text: 'Next alarm: ', color: alarmTheme.muted },
          { text: '7:00 AM - in 21h 19m', color: alarmTheme.accentBright },
        ]}
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {alarmRows.map((row, index) => (
          <AlarmCard
            key={`${row.label}-${row.time}`}
            icon={row.icon}
            time={row.time}
            ampm={row.ampm}
            label={row.label}
            tagText={row.tag}
            active={row.active}
            tone={row.tone}
            toggleOnColor={row.toggleOnColor}
            onToggle={() => toggleAlarmAt(index)}
            onPress={() => router.push('/alarm-edit')}
          />
        ))}
      </ScrollView>

      <BottomNavbar
        items={[
          { icon: navIcons.alarms, label: 'Alarms', active: true, onPress: () => router.push('/alarm') },
          { icon: navIcons.history, label: 'History', onPress: () => router.push('/history') },
          { icon: navIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: navIcons.settings, label: 'Settings', onPress: () => router.push('/setting') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
    paddingTop: 20,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    color: alarmTheme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  logoAccent: {
    color: alarmTheme.accentBright,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: alarmTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: alarmTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 22,
  },
  clockWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  bigClock: {
    color: alarmTheme.text,
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 58,
    letterSpacing: -1.2,
  },
  bigDate: {
    color: alarmTheme.muted,
    fontSize: 13,
    marginTop: 4,
  },
  nextAlarm: {
    textAlign: 'center',
    marginBottom: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    gap: 10,
    paddingBottom: 88,
  },
});
