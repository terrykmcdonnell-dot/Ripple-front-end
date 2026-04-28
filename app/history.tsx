import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { historyIcons } from '@/assets/icons/history-icons';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { alarmTheme } from '@/components/alarms/theme';
import { ComplianceBanner } from '@/components/history/ComplianceBanner';
import { HistoryFilterTabs } from '@/components/history/HistoryFilterTabs';
import { HistoryItemRow } from '@/components/history/HistoryItemRow';
import { useRequireAuth } from '@/hooks/use-require-auth';

const tabs = [
  { key: 'all', label: 'All Alarms' },
  { key: 'medication', label: '💊 Medication' },
  { key: 'plants', label: '🌱 Plants' },
  { key: 'maintenance', label: '🔧 Maintenance' },
];

const groups = [
  { 
    day: 'Today - 24 April',
    items: [
      { icon: historyIcons.medication, name: 'Take Medication', timeText: '7:00 AM - dismissed at 7:02 AM', status: 'dismissed' as const },
      { icon: historyIcons.plants, name: 'Water the Plants', timeText: '8:30 AM - snoozed 10 mins', status: 'snoozed' as const },
    ],
  },
  {
    day: 'Yesterday - 23 April',
    items: [
      { icon: historyIcons.meal, name: 'Meal Prep Day', timeText: '7:00 AM - dismissed at 7:01 AM', status: 'dismissed' as const },
      { icon: historyIcons.medication, name: 'Take Medication', timeText: '7:00 AM - no action taken', status: 'missed' as const },
    ],
  },
  {
    day: '21 April',
    items: [{ icon: historyIcons.medication, name: 'Take Medication', timeText: '7:00 AM - dismissed at 7:03 AM', status: 'dismissed' as const }],
  },
];

export default function HistoryScreen() {
  useRequireAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable style={styles.filterBtn}>
          <Text style={styles.filterBtnText}>Filter {historyIcons.filter}</Text>
        </Pressable>
      </View>

      <HistoryFilterTabs tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />

      <ComplianceBanner
        percent={90}
        completedText="18 of 20 completed"
        detailText="This month · 2 missed"
      />

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.day} style={styles.group}>
            <Text style={styles.groupLabel}>{group.day}</Text>
            {group.items.map((item) => (
              <HistoryItemRow
                key={`${group.day}-${item.name}-${item.timeText}`}
                icon={item.icon}
                name={item.name}
                timeText={item.timeText}
                status={item.status}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <BottomNavbar
        items={[
          { icon: historyIcons.alarms, label: 'Alarms', onPress: () => router.push('/alarm') },
          { icon: historyIcons.history, label: 'History', active: true, onPress: () => router.push('/history') },
          { icon: historyIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: historyIcons.settings, label: 'Settings', onPress: () => router.push('/setting') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: alarmTheme.bg, paddingTop: 20 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: alarmTheme.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  filterBtn: {
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterBtnText: { color: alarmTheme.muted, fontSize: 12 },
  list: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingBottom: 88 },
  group: { marginBottom: 16 },
  groupLabel: {
    color: alarmTheme.muted,
    fontSize: 10,
    marginBottom: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
});
