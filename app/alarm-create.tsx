import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createCategoryIcons, createSoundIcon } from '@/assets/icons/alarm-create-icons';
import { AlarmTimePickRow } from '@/components/alarms-create/AlarmTimePickRow';
import { SectionField } from '@/components/alarms-create/SectionField';
import { IntervalControl } from '@/components/alarms-create/IntervalControl';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { SoundRow } from '@/components/alarms-create/SoundRow';
import { alarmTheme } from '@/components/alarms/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { getSmartDefaultAlarmTime } from '@/lib/alarm-time';

const units = ['Hours', 'Days', 'Weeks', 'Months'] as const;
const categories = [
  { key: 'health', label: 'Health', icon: createCategoryIcons.health },
  { key: 'plants', label: 'Plants', icon: createCategoryIcons.plants },
  { key: 'maintenance', label: 'Maintenance', icon: createCategoryIcons.maintenance },
  { key: 'pets', label: 'Pets', icon: createCategoryIcons.pets },
  { key: 'work', label: 'Work', icon: createCategoryIcons.work },
  { key: 'custom', label: 'Custom', icon: createCategoryIcons.custom },
] as const;

export default function AlarmCreateScreen() {
  useRequireAuth();
  const router = useRouter();
  const [alarmTime, setAlarmTime] = useState(getSmartDefaultAlarmTime);
  const [label, setLabel] = useState('');
  const [interval, setInterval] = useState(3);
  const [unit, setUnit] = useState<(typeof units)[number]>('Days');
  const [category, setCategory] = useState<(typeof categories)[number]['key']>('health');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.push('/alarm')}>
          <Text style={styles.backBtnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Alarm</Text>
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>

      <AlarmTimePickRow value={alarmTime} onChange={setAlarmTime} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionField label="Label">
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Take medication"
            placeholderTextColor={alarmTheme.muted}
            style={styles.input}
          />
        </SectionField>

        <SectionField label="Repeat Every">
          <IntervalControl
            value={interval}
            onDecrease={() => setInterval((v) => Math.max(1, v - 1))}
            onIncrease={() => setInterval((v) => v + 1)}
          />
          <View style={styles.unitTabs}>
            {units.map((item) => (
              <SegmentButton
                key={item}
                label={item}
                flex
                active={unit === item}
                onPress={() => setUnit(item)}
              />
            ))}
          </View>
        </SectionField>

        <SectionField label="Category">
          <View style={styles.chipRow}>
            {categories.map((item) => (
              <SegmentButton
                key={item.key}
                label={item.label}
                withIcon={item.icon}
                rounded
                active={category === item.key}
                onPress={() => setCategory(item.key)}
              />
            ))}
          </View>
        </SectionField>

        <SectionField label="Sound">
          <SoundRow icon={createSoundIcon} title="Gentle Rise" />
        </SectionField>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    backgroundColor: alarmTheme.surface2,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  backBtnText: {
    color: alarmTheme.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    color: alarmTheme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: alarmTheme.accent,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  input: {
    width: '100%',
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: alarmTheme.text,
    fontSize: 14,
  },
  unitTabs: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    width: '100%',
  },
  chipRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
});
