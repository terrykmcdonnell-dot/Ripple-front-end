import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCategoryIcons, createSoundIcon } from '@/assets/icons/alarm-create-icons';
import { AlarmTimePickRow } from '@/components/alarms-create/AlarmTimePickRow';
import { IntervalControl } from '@/components/alarms-create/IntervalControl';
import { SectionField } from '@/components/alarms-create/SectionField';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { SoundRow } from '@/components/alarms-create/SoundRow';
import { SoundPickerSheet } from '@/components/settings/SoundPickerSheet';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { fetchAlarms, createAlarm } from '@/lib/alarm-api';
import { toAlarmIsoString } from '@/lib/alarm-date';
import { getSmartDefaultAlarmTime } from '@/lib/alarm-time';
import { notifyAuthError, notifyAuthMessage, notifyAuthWarning } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { HEADER_NAV_HIT_SLOP } from '@/lib/header-hit-slop';
import {
  AlarmSoundId,
  DEFAULT_ALARM_SOUND_OPTIONS,
  labelForAlarmSoundId,
  loadDefaultAlarmSoundId,
} from '@/lib/settings-preferences';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';
import { canAddAlarmFresh, FREE_TIER_MAX_ALARMS } from '@/lib/subscription-access';
import { fetchCurrentUserRowId } from '@/lib/users-table';

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
  const [selectedSoundId, setSelectedSoundId] = useState<AlarmSoundId>('gentle-rise');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  const palette = useAlarmTheme();
  const styles = useMemo(() => createAlarmCreateStyles(palette), [palette]);

  useEffect(() => {
    let cancelled = false;
    void loadDefaultAlarmSoundId().then((id) => {
      if (!cancelled) {
        setSelectedSoundId(id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSoundLabel = labelForAlarmSoundId(selectedSoundId);

  const handleSave = async () => {
    const labelValue = label.trim();
    if (!labelValue) {
      const msg = 'Enter a label for this alarm.';
      setLabelError(msg);
      notifyAuthWarning('New Alarm', msg);
      return;
    }
    setLabelError(null);

    const scheduledAtIso = toAlarmIsoString(alarmTime);
    if (!scheduledAtIso) {
      notifyAuthWarning('New Alarm', 'Choose a valid alarm time.');
      return;
    }

    setIsSaving(true);
    try {
      const { id: userId, error: userIdError } = await fetchCurrentUserRowId();
      if (userIdError || userId == null) {
        if (!(await shouldSkipAuthFailureAlerts())) {
          notifyAuthError('New Alarm', userIdError ?? new Error('Missing user profile.'));
        }
        return;
      }

      const categoryLabel = categories.find((item) => item.key === category)?.label ?? 'Health';

      const existing = await fetchAlarms(userId);
      if (!(await canAddAlarmFresh(existing.length))) {
        notifyAuthMessage(
          'Ripple Pro',
          `Free accounts can save up to ${FREE_TIER_MAX_ALARMS} alarms. Upgrade for unlimited alarms and templates.`,
        );
        router.replace('/paywall');
        return;
      }

      await createAlarm({
        user_id: userId,
        label: labelValue,
        scheduled_at: scheduledAtIso,
        interval,
        unit,
        category: categoryLabel,
        sound: selectedSoundLabel,
      });

      router.replace('/alarm');
      void Promise.all([syncUpcomingReminderNotifications(), syncAlarmFireNotifications()]).catch(
        () => undefined,
      );
    } catch (err) {
      notifyAuthError('New Alarm', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={[styles.headerThird, styles.headerThirdLeft]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={HEADER_NAV_HIT_SLOP}
              style={({ pressed }) => [styles.backBtn, pressed && styles.headerBtnPressed]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/alarm'))}>
              <Text style={styles.backBtnText}>Cancel</Text>
            </Pressable>
          </View>
          <View style={[styles.headerThird, styles.headerThirdMid]} pointerEvents="none">
            <Text style={styles.headerTitle}>New Alarm</Text>
          </View>
          <View style={[styles.headerThird, styles.headerThirdRight]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save alarm"
              hitSlop={HEADER_NAV_HIT_SLOP}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.saveBtn,
                isSaving && styles.saveBtnDisabled,
                !isSaving && pressed && styles.headerBtnPressed,
              ]}
              onPress={() => void handleSave()}>
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <AlarmTimePickRow value={alarmTime} onChange={setAlarmTime} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <SectionField label="Label" errorMessage={labelError ?? undefined}>
          <TextInput
            value={label}
            onChangeText={(text) => {
              setLabel(text);
              if (text.trim()) {
                setLabelError(null);
              }
            }}
            placeholder="e.g. Take medication"
            placeholderTextColor={palette.muted}
            style={[styles.input, labelError ? styles.inputError : null]}
            editable={!isSaving}
            returnKeyType="done"
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
          <SoundRow
            icon={createSoundIcon}
            title={selectedSoundLabel}
            onPress={() => setSoundPickerOpen(true)}
          />
        </SectionField>
      </ScrollView>

      <SoundPickerSheet
        visible={soundPickerOpen}
        onClose={() => setSoundPickerOpen(false)}
        options={DEFAULT_ALARM_SOUND_OPTIONS}
        selectedId={selectedSoundId}
        sheetTitle="Alarm sound"
        sheetHint="Preview plays when this opens and when you tap a sound. Tap OK to use it for this alarm."
        onSelectSoundId={(id) => setSelectedSoundId(id as AlarmSoundId)}
      />
      <FullScreenLoadingOverlay visible={isSaving} />
    </View>
  );
}

function createAlarmCreateStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  headerSafe: {
    backgroundColor: alarmTheme.bg,
    zIndex: 2,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerThird: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerThirdLeft: {
    alignItems: 'flex-start',
  },
  headerThirdMid: {
    alignItems: 'center',
  },
  headerThirdRight: {
    alignItems: 'flex-end',
  },
  backBtn: {
    backgroundColor: alarmTheme.surface2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnPressed: {
    opacity: 0.85,
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
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: alarmTheme.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.65,
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
  inputError: {
    borderColor: alarmTheme.amber,
    backgroundColor: alarmTheme.amberDim,
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
}
