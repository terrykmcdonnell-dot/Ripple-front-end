import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlarmSetupPermissionsModal } from '@/components/alarms/AlarmSetupPermissionsModal';
import { createSoundIcon } from '@/assets/icons/alarm-create-icons';
import { AlarmTimePickRow } from '@/components/alarms-create/AlarmTimePickRow';
import { IntervalControl } from '@/components/alarms-create/IntervalControl';
import { SectionField } from '@/components/alarms-create/SectionField';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { SoundRow } from '@/components/alarms-create/SoundRow';
import { SoundPickerSheet } from '@/components/settings/SoundPickerSheet';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { fetchAlarms, createAlarm } from '@/lib/alarm-api';
import { getAlarmListCache } from '@/lib/alarm-list-cache';
import { captureAlarmLimitReached } from '@/lib/posthog-analytics';
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
import {
  isAlarmSoundLocked,
  resolveAlarmSoundForUser,
} from '@/lib/alarm-sound-access';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { useBottomSafePadding } from '@/lib/screen-safe-area';
import { findDefaultCategory, useAlarmCategories } from '@/lib/alarm-categories';
import type { AndroidAlarmPermissionWarning } from '@/lib/android-alarm-permissions-status';
import { prepareAlarmPermissionsForSetup } from '@/lib/ensure-alarm-permissions';

const units = ['Hours', 'Days', 'Weeks', 'Months'] as const;

/**
 * Determines whether saving one more alarm would exceed the free-tier cap.
 *
 * Hardened so the free-tier network calls (RevenueCat/Supabase) or a slow Android lock-screen
 * permission modal can never swallow a real block (see RIPPLE-ALARM paywall_viewed gaps):
 *
 * 1. Fast path — no network call at all. If the alarm list's own cache (already loaded before
 *    the user ever reached this screen) shows the cap already hit, and the subscription hook's
 *    cached `limitsApply` (hydrated in memory, not a fresh fetch) confirms limits are on, this
 *    resolves immediately and fires `alarm_limit_reached` before any request goes out.
 * 2. Authoritative path — a fresh alarm count + fresh subscriber check, for the case where the
 *    cache is stale, missing, or under the cap.
 * 3. Fallback — if the authoritative check itself throws (e.g. the network is down), fall back
 *    to the same local signal used in the fast path rather than aborting the whole save with a
 *    generic error. Only re-throws (preserving prior behaviour) when there's no local signal at
 *    all to fall back on.
 */
async function resolveAlarmLimitBlocked(userId: number, limitsApplyHint: boolean): Promise<boolean> {
  const cachedRows = getAlarmListCache(userId);

  if (limitsApplyHint && cachedRows != null && cachedRows.length >= FREE_TIER_MAX_ALARMS) {
    captureAlarmLimitReached('alarm_create');
    return true;
  }

  try {
    const existing = await fetchAlarms(userId);
    const blocked = !(await canAddAlarmFresh(existing.length));
    if (blocked) {
      captureAlarmLimitReached('alarm_create');
    }
    return blocked;
  } catch (err) {
    if (cachedRows != null) {
      const blocked = limitsApplyHint && cachedRows.length >= FREE_TIER_MAX_ALARMS;
      if (blocked) {
        captureAlarmLimitReached('alarm_create');
      }
      return blocked;
    }
    throw err;
  }
}

export default function AlarmCreateScreen() {
  useRequireAuth();
  const router = useRouter();
  const { isSubscriber, limitsApply } = useSubscriptionStatus();
  const [alarmTime, setAlarmTime] = useState(getSmartDefaultAlarmTime);
  const [label, setLabel] = useState('');
  const [interval, setInterval] = useState(3);
  const [unit, setUnit] = useState<(typeof units)[number]>('Days');
  const { categories } = useAlarmCategories();
  const [categoryId, setCategoryId] = useState(1);
  const [selectedSoundId, setSelectedSoundId] = useState<AlarmSoundId>('gentle-rise');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [androidPermWarnings, setAndroidPermWarnings] = useState<AndroidAlarmPermissionWarning[]>([]);
  const [androidPermModalVisible, setAndroidPermModalVisible] = useState(false);
  const androidPermResolverRef = useRef<(() => void) | null>(null);

  const palette = useAlarmTheme();
  const bottomPad = useBottomSafePadding(24);
  const styles = useMemo(() => createAlarmCreateStyles(palette), [palette]);

  useEffect(() => {
    let cancelled = false;
    void loadDefaultAlarmSoundId().then((id) => {
      if (!cancelled) {
        setSelectedSoundId(resolveAlarmSoundForUser(id, isSubscriber));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSubscriber]);

  const onLockedAlarmSoundPress = () => {
    notifyAuthMessage(
      'Ripple Pro',
      'Premium alarm sounds are included with Ripple Pro.',
    );
    router.push('/paywall');
  };

  const isSoundLocked = (id: string) => isAlarmSoundLocked(id as AlarmSoundId, limitsApply);

  useEffect(() => {
    if (!categories.some((item) => item.id === categoryId)) {
      setCategoryId(findDefaultCategory(categories).id);
    }
  }, [categories, categoryId]);

  // Warm the profile cache so Save does not block on a cold fetchCurrentUserRowId().
  useEffect(() => {
    void fetchCurrentUserRowId();
  }, []);

  const selectedSoundLabel = labelForAlarmSoundId(selectedSoundId);

  const promptAndroidLockScreenPermissionsIfNeeded = async (): Promise<void> => {
    const warnings = await prepareAlarmPermissionsForSetup();
    if (warnings.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      androidPermResolverRef.current = resolve;
      setAndroidPermWarnings(warnings);
      setAndroidPermModalVisible(true);
    });
  };

  const onAndroidPermModalComplete = () => {
    setAndroidPermModalVisible(false);
    setAndroidPermWarnings([]);
    androidPermResolverRef.current?.();
    androidPermResolverRef.current = null;
  };

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

      // Limit check runs before the Android permissions modal and before creating anything —
      // if the user backgrounds/kills the app while that modal is awaited, or the app is later
      // killed, a real block was already resolved and the paywall navigation below already ran.
      if (await resolveAlarmLimitBlocked(userId, limitsApply)) {
        notifyAuthMessage(
          'Ripple Pro',
          `Free accounts can save up to ${FREE_TIER_MAX_ALARMS} alarms. Upgrade for unlimited alarms and templates.`,
        );
        router.replace('/paywall?alarmLimit=1');
        return;
      }

      await promptAndroidLockScreenPermissionsIfNeeded();

      const selectedCategory = categories.find((item) => item.id === categoryId) ?? findDefaultCategory(categories);
      const resolvedSoundId = resolveAlarmSoundForUser(selectedSoundId, isSubscriber);

      await createAlarm({
        user_id: userId,
        label: labelValue,
        scheduled_at: scheduledAtIso,
        interval,
        unit,
        category: selectedCategory.name,
        category_id: selectedCategory.id,
        sound: labelForAlarmSoundId(resolvedSoundId),
      });

      setIsSaving(false);
      router.replace('/alarm');
      void Promise.all([syncUpcomingReminderNotifications(), syncAlarmFireNotifications()]).catch(
        () => undefined,
      );
      return;
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
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
                fitSingleLine
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
                key={item.id}
                label={item.name}
                withIcon={item.icon}
                rounded
                active={categoryId === item.id}
                activeColorKey={item.colorKey}
                onPress={() => setCategoryId(item.id)}
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
        isSubscriber={isSubscriber}
        isSoundLocked={isSoundLocked}
        onLockedSoundPress={onLockedAlarmSoundPress}
        onSelectSoundId={(id) => setSelectedSoundId(id as AlarmSoundId)}
      />
      <AlarmSetupPermissionsModal
        visible={androidPermModalVisible}
        warnings={androidPermWarnings}
        onComplete={onAndroidPermModalComplete}
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
  scrollContent: {},
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
