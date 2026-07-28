import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSoundIcon } from '@/assets/icons/alarm-create-icons';
import { editActionIcons } from '@/assets/icons/alarm-edit-icons';
import { AlarmTimePickRow } from '@/components/alarms-create/AlarmTimePickRow';
import { DangerActionButton } from '@/components/alarms-create/DangerActionButton';
import { IntervalControl } from '@/components/alarms-create/IntervalControl';
import { SectionField } from '@/components/alarms-create/SectionField';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { SoundRow } from '@/components/alarms-create/SoundRow';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { SoundPickerSheet } from '@/components/settings/SoundPickerSheet';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { AppModal } from '@/components/ui/AppModal';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { deleteAlarm, fetchAlarmForEdit, patchAlarm } from '@/lib/alarm-api';
import {
  clearFreeRingCount,
  FREE_TIER_MAX_RINGS_PER_ALARM,
  isFreeRingLimitReached,
} from '@/lib/alarm-free-ring-limit';
import { parseAlarmDate, toAlarmIsoString } from '@/lib/alarm-date';
import { coerceAlarmUnit, formatScheduledLocalParts } from '@/lib/alarm-format';
import { peekStashedAlarmForEditMatch } from '@/lib/alarm-navigation-cache';
import {
  computeScheduledAtAfterSkipNext,
  getNextOccurrenceForAlarmSchedule,
} from '@/lib/alarm-skip-next';
import { notifyAuthError, notifyAuthWarning } from '@/lib/auth-notify';
import { shouldSkipAuthFailureAlerts } from '@/lib/auth-session-errors';
import { HEADER_NAV_HIT_SLOP } from '@/lib/header-hit-slop';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';
import { fetchCurrentUserRowId } from '@/lib/users-table';
import { useBottomSafePadding } from '@/lib/screen-safe-area';
import { findCategoryByName, findDefaultCategory, useAlarmCategories } from '@/lib/alarm-categories';
import {
  type AlarmSoundId,
  coerceAlarmSoundId,
  DEFAULT_ALARM_SOUND_OPTIONS,
  labelForAlarmSoundId,
} from '@/lib/settings-preferences';
import {
  isAlarmSoundLocked,
  resolveAlarmSoundForUser,
} from '@/lib/alarm-sound-access';

const units = ['Hours', 'Days', 'Weeks', 'Months'] as const;

export default function AlarmEditScreen() {
  useRequireAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = useMemo(() => {
    const raw = params.id;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return typeof s === 'string' ? s.trim() : '';
  }, [params.id]);

  const alarmIdParsed = idParam !== '' ? Number(idParam) : NaN;
  const alarmIdOk = Number.isFinite(alarmIdParsed) && alarmIdParsed > 0;

  const [alarmTime, setAlarmTime] = useState(() => new Date());
  const [label, setLabel] = useState('');
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState<(typeof units)[number]>('Days');
  const { categories } = useAlarmCategories();
  const [categoryId, setCategoryId] = useState(1);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [selectedSoundId, setSelectedSoundId] = useState<AlarmSoundId>('gentle-rise');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [skipConfirmVisible, setSkipConfirmVisible] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  const palette = useAlarmTheme();
  const { showToast } = useAppToast();
  const { isSubscriber, limitsApply } = useSubscriptionStatus();
  const bottomPad = useBottomSafePadding(24);
  const styles = useMemo(() => createAlarmEditStyles(palette), [palette]);

  const applyAlarmFieldsToForm = useCallback(
    (payload: {
      scheduledAt: string;
      label: string;
      interval: number;
      unit: string;
      categoryRef: unknown;
      categoryName?: string;
      sound?: string;
      isEnabled?: boolean;
    }) => {
      setAlarmTime(parseAlarmDate(payload.scheduledAt) ?? new Date());
      setLabel(payload.label);
      setInterval(payload.interval > 0 ? payload.interval : 1);
      setUnit(coerceAlarmUnit(payload.unit));
      const id = typeof payload.categoryRef === 'number' && Number.isFinite(payload.categoryRef)
        ? payload.categoryRef
        : findCategoryByName(categories, payload.categoryName ?? String(payload.categoryRef))?.id;
      setCategoryId(id ?? findDefaultCategory(categories).id);
      setSelectedSoundId(resolveAlarmSoundForUser(coerceAlarmSoundId(payload.sound), isSubscriber));
      setAlarmEnabled(typeof payload.isEnabled === 'boolean' ? payload.isEnabled : true);
      setError(null);
    },
    [categories, isSubscriber],
  );

  const skipScheduleFromForm = useMemo(
    () => ({
      scheduledAt: alarmTime.toISOString(),
      interval: interval > 0 ? interval : 1,
      unit,
    }),
    [alarmTime, interval, unit],
  );

  const nextSkippableFireAt = useMemo(() => {
    if (!alarmEnabled) {
      return null;
    }
    return getNextOccurrenceForAlarmSchedule(skipScheduleFromForm, new Date());
  }, [alarmEnabled, skipScheduleFromForm]);

  const skipModalTimeLabel = useMemo(() => {
    if (!nextSkippableFireAt) {
      return '';
    }
    const { time, ampm } = formatScheduledLocalParts(nextSkippableFireAt.toISOString());
    return `${time} ${ampm}`;
  }, [nextSkippableFireAt]);

  const selectedSoundLabel = labelForAlarmSoundId(selectedSoundId);

  const handleSave = useCallback(async () => {
    const labelValue = label.trim();
    if (!labelValue) {
      const msg = 'Enter a label for this alarm.';
      setLabelError(msg);
      notifyAuthWarning('Edit Alarm', msg);
      return;
    }
    setLabelError(null);
    if (!alarmIdOk || isSkipping) {
      return;
    }
    const scheduledAtIso = toAlarmIsoString(alarmTime);
    if (!scheduledAtIso) {
      notifyAuthWarning('Edit Alarm', 'Choose a valid alarm time.');
      return;
    }

    if (alarmEnabled && limitsApply && (await isFreeRingLimitReached(alarmIdParsed))) {
      showToast(
        `Free plan limits an alarm to ${FREE_TIER_MAX_RINGS_PER_ALARM} rings. Upgrade to Pro to keep using it.`,
      );
      router.push('/paywall?ringLimit=1');
      return;
    }

    setIsSaving(true);
    try {
      const selectedCategory = categories.find((item) => item.id === categoryId) ?? findDefaultCategory(categories);
      await patchAlarm(alarmIdParsed, {
        label: labelValue,
        scheduled_at: scheduledAtIso,
        interval,
        unit,
        category: selectedCategory.name,
        category_id: selectedCategory.id,
        sound: labelForAlarmSoundId(resolveAlarmSoundForUser(selectedSoundId, isSubscriber)),
        is_enabled: alarmEnabled,
      });
      router.replace('/alarm');
      void Promise.all([syncUpcomingReminderNotifications(), syncAlarmFireNotifications()]).catch(
        () => undefined,
      );
    } catch (e) {
      notifyAuthError('Edit Alarm', e);
    } finally {
      setIsSaving(false);
    }
  }, [
    alarmEnabled,
    alarmIdOk,
    alarmIdParsed,
    alarmTime,
    categoryId,
    categories,
    interval,
    isSkipping,
    label,
    limitsApply,
    selectedSoundId,
    isSubscriber,
    router,
    showToast,
    unit,
  ]);

  const handleConfirmDeleteAlarm = useCallback(async () => {
    if (!alarmIdOk) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAlarm(alarmIdParsed);
      void clearFreeRingCount(alarmIdParsed);
      setDeleteConfirmVisible(false);
      router.replace('/alarm');
      void Promise.all([syncUpcomingReminderNotifications(), syncAlarmFireNotifications()]).catch(
        () => undefined,
      );
    } catch (e) {
      notifyAuthError('Delete Alarm', e);
    } finally {
      setIsDeleting(false);
    }
  }, [alarmIdOk, alarmIdParsed, router]);

  const promptDeleteAlarm = useCallback(() => {
    if (!alarmIdOk || isDeleting || isSaving || isSkipping) {
      return;
    }
    Keyboard.dismiss();
    setDeleteConfirmVisible(true);
  }, [alarmIdOk, isDeleting, isSaving, isSkipping]);

  const promptSkipNext = useCallback(() => {
    if (!alarmIdOk || isDeleting || isSaving || isSkipping || !alarmEnabled || nextSkippableFireAt == null) {
      return;
    }
    Keyboard.dismiss();
    setSkipConfirmVisible(true);
  }, [alarmEnabled, alarmIdOk, isDeleting, isSaving, isSkipping, nextSkippableFireAt]);

  const handleConfirmSkipNext = useCallback(async () => {
    if (!alarmIdOk) {
      return;
    }
    const baseline = {
      scheduledAt: toAlarmIsoString(alarmTime) ?? new Date().toISOString(),
      interval: interval > 0 ? interval : 1,
      unit,
    };
    const now = new Date();
    const newIso = computeScheduledAtAfterSkipNext(baseline, now);
    if (newIso == null) {
      setSkipConfirmVisible(false);
      showToast('There is no upcoming occurrence to skip.');
      return;
    }

    setIsSkipping(true);
    try {
      await patchAlarm(alarmIdParsed, {
        scheduled_at: newIso,
        interval: interval > 0 ? interval : 1,
        unit,
      });
      setSkipConfirmVisible(false);
      setAlarmTime(new Date(newIso));
      showToast('Skipped the next occurrence.');
      void Promise.all([syncUpcomingReminderNotifications(), syncAlarmFireNotifications()]).catch(
        () => undefined,
      );
    } catch (e) {
      notifyAuthError('Edit Alarm', e);
    } finally {
      setIsSkipping(false);
    }
  }, [alarmIdOk, alarmIdParsed, alarmTime, interval, showToast, unit]);

  const loadAlarmFromApi = useCallback(async () => {
    if (!alarmIdOk) {
      setLoading(false);
      setError('Missing or invalid alarm id.');
      return;
    }

    setLoading(true);
    setError(null);

    const { id: userId, error: userErr } = await fetchCurrentUserRowId();
    if (userErr || userId == null) {
      setLoading(false);
      if (await shouldSkipAuthFailureAlerts()) {
        return;
      }
      setError(userErr?.message ?? 'Could not resolve your profile.');
      notifyAuthError('Edit Alarm', userErr ?? new Error('Missing user profile.'));
      return;
    }

    try {
      const alarm = await fetchAlarmForEdit(alarmIdParsed, userId);
      if (!alarm) {
        setError('Alarm not found.');
        return;
      }

      applyAlarmFieldsToForm({
        scheduledAt: alarm.scheduledAt,
        label: alarm.label,
        interval: alarm.interval,
        unit: alarm.unit,
        categoryRef: alarm.categoryId,
        categoryName: alarm.categoryName,
        sound: alarm.sound,
        isEnabled: alarm.isEnabled,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load alarm.';
      setError(msg);
      notifyAuthError('Edit Alarm', e);
    } finally {
      setLoading(false);
    }
  }, [alarmIdOk, alarmIdParsed, applyAlarmFieldsToForm]);

  useLayoutEffect(() => {
    if (!alarmIdOk) {
      setLoading(false);
      setError('Missing or invalid alarm id.');
      return;
    }

    const stashed = peekStashedAlarmForEditMatch(alarmIdParsed);
    if (stashed) {
      applyAlarmFieldsToForm({
        scheduledAt: stashed.scheduledAt,
        label: stashed.label,
        interval: stashed.interval,
        unit: stashed.unit,
        categoryRef: stashed.categoryId ?? stashed.category,
        categoryName: stashed.category,
        sound: stashed.sound,
        isEnabled: stashed.isEnabled,
      });
      setLoading(false);
      return;
    }

    void loadAlarmFromApi();
    // Only react to route alarm id changes; loaders close over fresh callbacks on each edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit loadAlarmFromApi / apply to avoid redundant effect runs
  }, [alarmIdOk, alarmIdParsed]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={[styles.headerThird, styles.headerThirdLeft]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={HEADER_NAV_HIT_SLOP}
              style={({ pressed }) => [styles.backBtn, pressed && styles.headerBtnPressed]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/alarm'))}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          </View>
          <View style={[styles.headerThird, styles.headerThirdMid]} pointerEvents="none">
            <Text style={styles.headerTitle}>Edit Alarm</Text>
          </View>
          <View style={[styles.headerThird, styles.headerThirdRight]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save alarm"
              hitSlop={HEADER_NAV_HIT_SLOP}
              disabled={isSaving || isDeleting || isSkipping || loading || error != null || !alarmIdOk}
              style={({ pressed }) => [
                styles.saveBtn,
                (isSaving || isDeleting || isSkipping || loading || error != null || !alarmIdOk) &&
                  styles.saveBtnDisabled,
                !(isSaving || isDeleting || isSkipping || loading || error != null || !alarmIdOk) &&
                  pressed &&
                  styles.headerBtnPressed,
              ]}
              onPress={() => void handleSave()}>
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {!alarmIdOk ? (
        <View style={styles.centered}>
          <Text style={styles.errorBanner}>{error ?? 'Missing alarm.'}</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingPlaceholder} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorBanner}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void loadAlarmFromApi()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AlarmTimePickRow value={alarmTime} onChange={setAlarmTime} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
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
                placeholder="Alarm label"
                placeholderTextColor={palette.muted}
                style={[styles.input, labelError ? styles.inputError : null]}
                editable={!isSaving && !isDeleting && !isSkipping}
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

            <View style={styles.dangerZone}>
              <DangerActionButton
                icon={editActionIcons.skip}
                label="Skip Next Occurrence"
                variant="skip"
                disabled={
                  isSkipping ||
                  isSaving ||
                  isDeleting ||
                  !alarmEnabled ||
                  nextSkippableFireAt == null
                }
                onPress={promptSkipNext}
              />
              <DangerActionButton
                icon={editActionIcons.delete}
                label="Delete Alarm"
                variant="delete"
                disabled={isDeleting || isSaving || isSkipping}
                onPress={promptDeleteAlarm}
              />
            </View>
          </ScrollView>
        </>
      )}
      <SoundPickerSheet
        visible={soundPickerOpen}
        onClose={() => setSoundPickerOpen(false)}
        options={DEFAULT_ALARM_SOUND_OPTIONS}
        selectedId={selectedSoundId}
        sheetTitle="Alarm sound"
        sheetHint="Preview plays when this opens and when you tap a sound. Tap OK to use it for this alarm."
        isSubscriber={isSubscriber}
        isSoundLocked={(id) => isAlarmSoundLocked(id as AlarmSoundId, limitsApply)}
        onLockedSoundPress={() => {
          showToast('Premium alarm sounds are included with Ripple Pro.');
          router.push('/paywall');
        }}
        onSelectSoundId={(id) => setSelectedSoundId(id as AlarmSoundId)}
      />
      <AppModal
        transparent
        animationType="fade"
        visible={skipConfirmVisible}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => !isSkipping && setSkipConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Skip next occurrence?</Text>
            <Text style={styles.modalBody}>
              The next ring for &quot;{label.trim() || 'this alarm'}&quot; is scheduled for{' '}
              <Text style={styles.modalBodyEmphasis}>{skipModalTimeLabel}</Text>. It will not fire; later
              repeats stay on the same schedule.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                disabled={isSkipping}
                onPress={() => !isSkipping && setSkipConfirmVisible(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                disabled={isSkipping}
                onPress={() => void handleConfirmSkipNext()}>
                {isSkipping ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Skip</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>
      <AppModal
        transparent
        animationType="fade"
        visible={deleteConfirmVisible}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => !isDeleting && setDeleteConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete alarm?</Text>
            <Text style={styles.modalBody}>
              This will permanently remove &quot;{label.trim() || 'this alarm'}&quot;. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                disabled={isDeleting}
                onPress={() => !isDeleting && setDeleteConfirmVisible(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDanger]}
                disabled={isDeleting}
                onPress={() => void handleConfirmDeleteAlarm()}>
                {isDeleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>
      <FullScreenLoadingOverlay visible={isSaving || isDeleting || isSkipping} />
    </View>
  );
}

function createAlarmEditStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingPlaceholder: {
    flex: 1,
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
  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: alarmTheme.border,
    paddingTop: 14,
    marginTop: 4,
    gap: 8,
    width: '100%',
  },
  errorBanner: {
    color: alarmTheme.red,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: alarmTheme.surface2,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: alarmTheme.accentBright,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: alarmTheme.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: alarmTheme.border,
  },
  modalTitle: {
    color: alarmTheme.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalBody: {
    color: alarmTheme.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBodyEmphasis: {
    color: alarmTheme.text,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    minWidth: 96,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  modalBtnSecondary: {
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
  },
  modalBtnSecondaryText: {
    color: alarmTheme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnDanger: {
    backgroundColor: '#dc2626',
  },
  modalBtnDangerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: alarmTheme.accent,
  },
  modalBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
}
