import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createCategoryIcons } from '@/assets/icons/alarm-create-icons';
import { editActionIcons } from '@/assets/icons/alarm-edit-icons';
import { DangerActionButton } from '@/components/alarms-create/DangerActionButton';
import { IntervalControl } from '@/components/alarms-create/IntervalControl';
import { SectionField } from '@/components/alarms-create/SectionField';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { alarmTheme } from '@/components/alarms/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';

const units = ['Hours', 'Days', 'Weeks', 'Months'] as const;
const categories = [
  { key: 'health', label: 'Health', icon: createCategoryIcons.health },
  { key: 'plants', label: 'Plants', icon: createCategoryIcons.plants },
  { key: 'maintenance', label: 'Maintenance', icon: createCategoryIcons.maintenance },
  { key: 'pets', label: 'Pets', icon: createCategoryIcons.pets },
  { key: 'work', label: 'Work', icon: createCategoryIcons.work },
] as const;

export default function AlarmEditScreen() {
  useRequireAuth();
  const router = useRouter();
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('AM');
  const [label, setLabel] = useState('Take Medication');
  const [interval, setInterval] = useState(3);
  const [unit, setUnit] = useState<(typeof units)[number]>('Days');
  const [category, setCategory] = useState<(typeof categories)[number]['key']>('health');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.push('/alarm')}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Alarm</Text>
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.timePicker}>
        <Text style={styles.timeVal}>7</Text>
        <Text style={styles.timeSep}>:</Text>
        <Text style={styles.timeVal}>00</Text>
        <View style={styles.ampmWrap}>
          {(['AM', 'PM'] as const).map((item) => (
            <SegmentButton
              key={item}
              label={item}
              compact
              active={meridiem === item}
              onPress={() => setMeridiem(item)}
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionField label="Label">
          <TextInput value={label} onChangeText={setLabel} style={styles.input} />
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

        <View style={styles.dangerZone}>
          <DangerActionButton icon={editActionIcons.skip} label="Skip Next Occurrence" variant="skip" />
          <DangerActionButton icon={editActionIcons.delete} label="Delete Alarm" variant="delete" />
        </View>
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
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: alarmTheme.border,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  timeVal: {
    color: alarmTheme.text,
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 52,
    letterSpacing: -1.5,
    paddingHorizontal: 6,
  },
  timeSep: {
    color: alarmTheme.muted,
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 40,
    paddingBottom: 4,
  },
  ampmWrap: {
    gap: 4,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20,
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
  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: alarmTheme.border,
    paddingTop: 14,
    marginTop: 4,
    gap: 8,
    width: '100%',
  },
});
