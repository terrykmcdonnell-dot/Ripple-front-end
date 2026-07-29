import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';

import { settingsIcons } from '@/assets/icons/settings-icons';
import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { BottomNavbar, useTabBarReservedHeight } from '@/components/alarms/BottomNavbar';
import { type AlarmThemePalette, alarmTypography, useAlarmTheme } from '@/components/alarms/theme';
import { NotificationsHubSheet } from '@/components/settings/NotificationsHubSheet';
import { CategoryManagerSheet } from '@/components/settings/CategoryManagerSheet';
import { NotificationsMasterRow } from '@/components/settings/NotificationsMasterRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SnoozePickerSheet } from '@/components/settings/SnoozePickerSheet';
import { SoundPickerSheet } from '@/components/settings/SoundPickerSheet';
import { VolumePickerSheet } from '@/components/settings/VolumePickerSheet';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useSubscriptionStatus } from '@/hooks/use-subscription-status';
import { notifyAuthError } from '@/lib/auth-notify';
import { cancelAllRippleScheduledNotifications } from '@/lib/cancel-all-app-notifications';
import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { clearPendingSignUp } from '@/lib/pending-signup';
import {
  AlarmSoundId,
  APP_THEME_OPTIONS,
  type AppThemePreference,
  DEFAULT_ALARM_SOUND_OPTIONS,
  DEFAULT_SNOOZE_OPTIONS_MINUTES,
  DEFAULT_UPCOMING_LEAD_OPTIONS_MINUTES,
  DEFAULT_VOLUME_PERCENT_OPTIONS,
  formatSnoozeMinutesLabel,
  formatUpcomingReminderLeadLabel,
  formatVolumePercentLabel,
  loadAppThemePreference,
  loadDefaultAlarmSoundId,
  loadDefaultSnoozeMinutes,
  loadDefaultVibrationEnabled,
  loadDefaultVolumePercent,
  loadNotificationsMasterEnabled,
  loadUpcomingReminderEnabled,
  loadUpcomingReminderLeadMinutes,
  saveAppThemePreference,
  saveDefaultAlarmSoundId,
  saveDefaultSnoozeMinutes,
  saveDefaultVibrationEnabled,
  saveDefaultVolumePercent,
  saveNotificationsMasterEnabled,
  saveUpcomingReminderEnabled,
  saveUpcomingReminderLeadMinutes,
} from '@/lib/settings-preferences';
import {
  SETTINGS_ABOUT_ICON_BLUE,
  getPrivacyPolicyUrl,
  getTermsOfServiceUrl,
  openConfiguredUrl,
} from '@/lib/settings-about-links';
import { supabase } from '@/lib/supabase';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { AppModal } from '@/components/ui/AppModal';
import { notificationPrefsEligibleForDbSync, patchSignedInUserSettings, type UserSettingsDbRow } from '@/lib/sync-user-settings-db';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { navigateToMainTab } from '@/lib/main-tab-navigation';
import { resyncAllAlarmSchedules } from '@/lib/app-upgrade-migration';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { previewDefaultAlarmSoundAtVolume } from '@/lib/preview-alarm-sound';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';
import { openAndroidNotificationPolicyAccessSettings } from '@/lib/open-android-notification-policy-access-settings';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';
import { invalidateAlarmCategoryCache } from '@/lib/alarm-categories';
import { invalidateCurrentUserRowIdCache } from '@/lib/users-table';
import { invalidateAlarmHistoryCache } from '@/lib/alarm-history-cache';
import { closeAccount } from '@/lib/close-account-api';
import { clearLocalAccountData } from '@/lib/clear-local-account-data';
import { checkForAppUpdateAndOpenStore } from '@/lib/open-app-store-update';
import {
  canUseAlarmSound,
  FREE_DEFAULT_ALARM_SOUND_ID,
  isAlarmSoundLocked,
  isProAlarmSound,
} from '@/lib/alarm-sound-access';

export default function SettingScreen() {
  useRequireAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const {
    isSubscriber,
    loading: subLoading,
    titleLine,
    limitsApply,
    renewalHint,
    managementURL,
  } = useSubscriptionStatus();

  const openSubscriptionManagement = useCallback(() => {
    if (managementURL) {
      void Linking.openURL(managementURL);
    } else {
      void Linking.openSettings();
    }
  }, [managementURL]);

  const palette = useAlarmTheme();
  const tabBarPad = useTabBarReservedHeight();
  const styles = useMemo(() => createSettingStyles(palette), [palette]);

  const reportPatch = useCallback(
    async (partial: UserSettingsDbRow) => {
      const { error } = await patchSignedInUserSettings(partial);
      if (error) {
        showToast('Could not sync to your account. Your changes are saved on this device.');
      }
    },
    [showToast],
  );
  const [vibrationOn, setVibrationOn] = useState(true);
  const [upcomingOn, setUpcomingOn] = useState(true);
  const [upcomingLeadMinutes, setUpcomingLeadMinutes] = useState(60);
  const [theme, setTheme] = useState<AppThemePreference>('Dark');
  const [signingOut, setSigningOut] = useState(false);
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [repairingAlarms, setRepairingAlarms] = useState(false);
  const onRepairAlarms = useCallback(async () => {
    if (repairingAlarms || Platform.OS === 'web') {
      return;
    }
    setRepairingAlarms(true);
    try {
      await resyncAllAlarmSchedules();
      showToast('Alarms & notifications resynced.');
    } catch (e) {
      notifyAuthError('Repair alarms', e);
    } finally {
      setRepairingAlarms(false);
    }
  }, [repairingAlarms, showToast]);
  const onCheckForUpdates = useCallback(async () => {
    if (checkingForUpdate || Platform.OS === 'web') {
      return;
    }
    setCheckingForUpdate(true);
    try {
      const outcome = await checkForAppUpdateAndOpenStore();
      if (outcome.kind === 'up_to_date') {
        showToast('You have the latest version of Ripple.');
      } else if (outcome.kind === 'unavailable') {
        showToast('Could not check for updates. Try again later.');
      }
    } finally {
      setCheckingForUpdate(false);
    }
  }, [checkingForUpdate, showToast]);

  const [defaultSnoozeMinutes, setDefaultSnoozeMinutes] = useState(10);
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false);
  const [defaultSoundId, setDefaultSoundId] = useState<AlarmSoundId>('gentle-rise');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [defaultVolumePercent, setDefaultVolumePercent] = useState(80);
  const [volumePickerOpen, setVolumePickerOpen] = useState(false);
  const [upcomingLeadPickerOpen, setUpcomingLeadPickerOpen] = useState(false);
  const [notificationHubOpen, setNotificationHubOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [notifOsAllowed, setNotifOsAllowed] = useState(false);
  const [notifCanAskAgain, setNotifCanAskAgain] = useState(true);
  const notificationsMasterEnabled = true;

  const themeIcon = useMemo(() => {
    if (theme === 'Light') {
      return '☀️';
    }
    if (theme === 'Dark') {
      return '🌙';
    }
    return '🌓';
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [
        loadedSnooze,
        loadedSound,
        loadedVolume,
        loadedVibration,
        loadedUpcoming,
        loadedLead,
        loadedTheme,
      ] = await Promise.all([
        loadDefaultSnoozeMinutes(),
        loadDefaultAlarmSoundId(),
        loadDefaultVolumePercent(),
        loadDefaultVibrationEnabled(),
        loadUpcomingReminderEnabled(),
        loadUpcomingReminderLeadMinutes(),
        loadAppThemePreference(),
      ]);
      if (!cancelled) {
        setDefaultSnoozeMinutes(loadedSnooze);
        setDefaultSoundId(loadedSound);
        setDefaultVolumePercent(loadedVolume);
        setVibrationOn(loadedVibration);
        setUpcomingOn(loadedUpcoming);
        setUpcomingLeadMinutes(loadedLead);
        setTheme(loadedTheme);
      }
      if (!cancelled && Platform.OS !== 'web') {
        try {
          const p = await getPermissionsAsync();
          if (!cancelled) {
            setNotifOsAllowed(isOsNotificationAllowed(p));
            setNotifCanAskAgain(p.canAskAgain !== false);
          }
        } catch {
          /* expo-notifications unavailable */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshNotificationPermissionUi = useCallback(async () => {
    if (Platform.OS === 'web') {
      return;
    }
    const p = await getPermissionsAsync();
    setNotifOsAllowed(isOsNotificationAllowed(p));
    setNotifCanAskAgain(p.canAskAgain !== false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!active) {
          return;
        }
        invalidateSubscriptionCache();
        if (Platform.OS !== 'web') {
          await refreshNotificationPermissionUi();
        }
      })();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && active && Platform.OS !== 'web') {
          void refreshNotificationPermissionUi();
        }
      });
      return () => {
        active = false;
        sub.remove();
      };
    }, [refreshNotificationPermissionUi]),
  );

  const applyDefaultSnooze = useCallback(
    async (minutes: number) => {
      setDefaultSnoozeMinutes(minutes);
      await saveDefaultSnoozeMinutes(minutes);
      await reportPatch({ defaultSnoozeDuration: minutes });
      showToast('Default snooze saved');
    },
    [reportPatch, showToast],
  );

  const applyDefaultSound = useCallback(
    async (id: AlarmSoundId) => {
      if (!canUseAlarmSound(id, isSubscriber)) {
        showToast('Premium alarm sounds are included with Ripple Pro.');
        router.push('/paywall');
        return;
      }
      setDefaultSoundId(id);
      await saveDefaultAlarmSoundId(id);
      await syncUpcomingReminderNotifications();
      await syncAlarmFireNotifications();
      if (await notificationPrefsEligibleForDbSync()) {
        await reportPatch({ defaultAlarmSound: id });
      }
      showToast('Default sound updated');
    },
    [isSubscriber, reportPatch, router, showToast],
  );

  useEffect(() => {
    if (subLoading || !limitsApply || !isProAlarmSound(defaultSoundId)) {
      return;
    }
    void (async () => {
      setDefaultSoundId(FREE_DEFAULT_ALARM_SOUND_ID);
      await saveDefaultAlarmSoundId(FREE_DEFAULT_ALARM_SOUND_ID);
      await syncUpcomingReminderNotifications();
      await syncAlarmFireNotifications();
      if (await notificationPrefsEligibleForDbSync()) {
        await reportPatch({ defaultAlarmSound: FREE_DEFAULT_ALARM_SOUND_ID });
      }
    })();
  }, [subLoading, limitsApply, defaultSoundId, reportPatch]);

  const onLockedAlarmSoundPress = useCallback(() => {
    showToast('Premium alarm sounds are included with Ripple Pro.');
    router.push('/paywall');
  }, [router, showToast]);

  const isSoundLocked = useCallback(
    (id: string) => isAlarmSoundLocked(id as AlarmSoundId, limitsApply),
    [limitsApply],
  );

  const applyDefaultVolume = useCallback(
    async (percent: number) => {
      setDefaultVolumePercent(percent);
      await saveDefaultVolumePercent(percent);
      const applied = await previewDefaultAlarmSoundAtVolume(percent);
      if (!applied && Platform.OS !== 'web') {
        showToast('Could not change system volume. Use device controls or system Settings. Level saved in Ripple.');
      } else {
        showToast('Volume preference saved');
      }
      if (await notificationPrefsEligibleForDbSync()) {
        await reportPatch({ alarmVolume: String(percent) });
      }
    },
    [reportPatch, showToast],
  );

  const applyVibration = useCallback(
    async (enabled: boolean) => {
      setVibrationOn(enabled);
      await saveDefaultVibrationEnabled(enabled);
      await syncUpcomingReminderNotifications();
      await syncAlarmFireNotifications();
      if (await notificationPrefsEligibleForDbSync()) {
        await reportPatch({ isVibrationEnabled: enabled });
      }
      showToast(enabled ? 'Vibration on' : 'Vibration off');
    },
    [reportPatch, showToast],
  );

  const applyUpcomingReminder = useCallback(
    async (enabled: boolean) => {
      setUpcomingOn(enabled);
      await saveUpcomingReminderEnabled(enabled);
      await syncUpcomingReminderNotifications();
      await syncAlarmFireNotifications();
      if (!enabled || (await notificationPrefsEligibleForDbSync())) {
        await reportPatch({ isUpcomingReminderEnabled: enabled });
      }
      showToast(enabled ? 'Upcoming reminders on' : 'Upcoming reminders off');
    },
    [reportPatch, showToast],
  );

  const applyUpcomingLeadMinutes = useCallback(
    async (minutes: number) => {
      setUpcomingLeadMinutes(minutes);
      await saveUpcomingReminderLeadMinutes(minutes);
      await syncUpcomingReminderNotifications();
      await syncAlarmFireNotifications();
      if (await notificationPrefsEligibleForDbSync()) {
        await reportPatch({ upcomingReminderLeadMinutes: minutes });
      }
      showToast('Reminder timing updated');
    },
    [reportPatch, showToast],
  );

  const openSnoozeFromHub = useCallback(() => {
    setNotificationHubOpen(false);
    setTimeout(() => setSnoozePickerOpen(true), 280);
  }, []);

  const openSoundFromHub = useCallback(() => {
    setNotificationHubOpen(false);
    setTimeout(() => setSoundPickerOpen(true), 280);
  }, []);

  const openVolumeFromHub = useCallback(() => {
    setNotificationHubOpen(false);
    setTimeout(() => setVolumePickerOpen(true), 280);
  }, []);

  const notificationsEffectiveOn =
    Platform.OS !== 'web' && notifOsAllowed;

  const onPressNotificationsHub = useCallback(async () => {
    if (Platform.OS === 'web') {
      showToast('Notification settings are available in the Ripple mobile app.');
      return;
    }

    if (!notifOsAllowed) {
      try {
        const p = await getPermissionsAsync();
        if (!isOsNotificationAllowed(p) && p.canAskAgain !== false) {
          await requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
        }
      } catch {
        /* expo-notifications unavailable */
      } finally {
        await refreshNotificationPermissionUi();
      }

      const after = await getPermissionsAsync();
      if (!isOsNotificationAllowed(after)) {
        await Linking.openSettings();
        showToast('Allow notifications in Settings to enable Ripple alerts.');
        return;
      }
    }

    setNotificationHubOpen(true);
  }, [notifOsAllowed, refreshNotificationPermissionUi, showToast]);

  let notificationsStatusLabel = 'Paused';
  let notificationsStatusColor = palette.muted;
  if (Platform.OS === 'web') {
    notificationsStatusLabel = 'Mobile app only';
    notificationsStatusColor = palette.muted;
  } else if (!notifOsAllowed) {
    notificationsStatusLabel = notifCanAskAgain ? 'Tap to enable' : 'Off — open Settings';
    notificationsStatusColor = palette.red;
  } else {
    notificationsStatusLabel = 'Allowed';
    notificationsStatusColor = palette.green;
  }

  const onSignOut = async () => {
    if (signingOut || closingAccount) {
      return;
    }
    setSigningOut(true);
    await clearPendingSignUp();
    invalidateCurrentUserRowIdCache();
    invalidateAlarmCategoryCache();
    invalidateAlarmHistoryCache();
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      notifyAuthError('Sign out', error);
      return;
    }
    /** Navigation: `useRequireAuth` + `replaceWithSignInIfNeeded` (deduped). */
  };

  const onCloseAccount = async () => {
    if (closingAccount || signingOut) {
      return;
    }
    setClosingAccount(true);
    try {
      await closeAccount();
      await clearLocalAccountData();
      if (Platform.OS !== 'web') {
        await Purchases.logOut().catch(() => undefined);
      }
      await supabase.auth.signOut({ scope: 'local' });
      setCloseConfirmVisible(false);
    } catch (e) {
      notifyAuthError('Close account', e);
    } finally {
      setClosingAccount(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={
            isSubscriber && !subLoading
              ? ['rgba(52,211,153,0.15)', 'rgba(52,211,153,0.05)']
              : ['rgba(6,182,212,0.2)', 'rgba(6,182,212,0.06)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.proBanner,
            isSubscriber && !subLoading ? styles.proBannerSubscribed : null,
          ]}>
          <Text style={styles.proIcon}>{settingsIcons.pro}</Text>
          <View style={styles.proInfo}>
            {Platform.OS === 'web' ? (
              <>
                <Text style={styles.proTitle}>Ripple Pro</Text>
                <Text style={styles.proSub}>Subscribe on the iOS or Android app</Text>
              </>
            ) : subLoading ? (
              <>
                <Text style={styles.proTitle}>Ripple Pro</Text>
                <Text style={styles.proSub}>Checking subscription…</Text>
              </>
            ) : isSubscriber ? (
              <>
                <Text style={styles.proTitle}>{titleLine}</Text>
                <Text style={styles.proSub}>
                  {renewalHint ?? 'Tap Manage to switch billing (monthly / annual)'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.proTitle}>Upgrade to Pro</Text>
                <Text style={styles.proSub}>Unlimited alarms · Unlimited rings · Templates · Themes</Text>
              </>
            )}
          </View>
          {Platform.OS !== 'web' && !subLoading && isSubscriber ? (
            <Pressable style={styles.proBtn} onPress={() => router.push('/paywall?changePlan=1')}>
              <Text style={styles.proBtnText}>Manage</Text>
            </Pressable>
          ) : Platform.OS !== 'web' && !subLoading && !isSubscriber ? (
            <Pressable style={styles.proBtn} onPress={() => router.push('/paywall')}>
              <Text style={styles.proBtnText}>See plans</Text>
            </Pressable>
          ) : null}
        </LinearGradient>

        {Platform.OS !== 'web' && !subLoading && isSubscriber ? (
          <SettingsGroup>
            <SettingsRow
              icon={settingsIcons.cancelSubscription}
              title="Cancel subscription"
              value={`Opens ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'} subscription management`}
              titleColor={palette.red}
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => openSubscriptionManagement()}
              noBorder
            />
          </SettingsGroup>
        ) : null}

        <Text style={styles.sectionLabel}>Appearance</Text>
        <SettingsGroup>
          <View style={styles.themeRow}>
            <View style={styles.themeHeading}>
              <View style={styles.themeIconWrap}>
                  <Text style={styles.themeIcon}>{themeIcon}</Text>
              </View>
              <Text style={styles.themeLabel}>Theme</Text>
            </View>
            <View style={styles.themeOptions}>
              {APP_THEME_OPTIONS.map((item) => {
                const active = theme === item;
                const locked = limitsApply && item === 'Auto';
                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.themeOption,
                      active ? styles.themeOptionActive : null,
                      locked ? styles.themeOptionLocked : null,
                    ]}
                    onPress={() => {
                      if (locked) {
                        showToast('Auto theme is included with Ripple Pro.');
                        router.push('/paywall');
                        return;
                      }
                      void (async () => {
                        setTheme(item);
                        await saveAppThemePreference(item);
                        await reportPatch({ appTheme: item });
                      })();
                    }}>
                    <Text
                      style={[
                        styles.themeOptionText,
                        active ? styles.themeOptionTextActive : null,
                        locked ? styles.themeOptionTextLocked : null,
                      ]}>
                      {locked ? `${item} · Pro` : item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsGroup>

        <Text style={styles.sectionLabel}>Personalization</Text>
        <SettingsGroup>
          <SettingsRow
            icon="🏷️"
            title="Categories"
            value="Add, edit, or delete custom alarm categories"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() => setCategoryManagerOpen(true)}
            noBorder
          />
        </SettingsGroup>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingsGroup>
          <NotificationsMasterRow
            icon={settingsIcons.notifications}
            title="Notifications"
            statusLabel={notificationsStatusLabel}
            statusColor={notificationsStatusColor}
            summaryLine={`${formatSnoozeMinutesLabel(defaultSnoozeMinutes)} · ${formatVolumePercentLabel(defaultVolumePercent)}`}
            toggleEnabled={notificationsMasterEnabled}
            showToggle={false}
            onPressHub={() => void onPressNotificationsHub()}
            onToggle={() => {}}
          />
          <SettingsRow
            icon={settingsIcons.upcoming}
            title="Upcoming Reminder"
            value="Heads-up notification before an alarm rings"
            right={<AlarmToggle enabled={upcomingOn} onPress={() => void applyUpcomingReminder(!upcomingOn)} />}
          />
          <SettingsRow
            icon={settingsIcons.snooze}
            title="How early to remind"
            value={formatUpcomingReminderLeadLabel(upcomingLeadMinutes)}
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() => setUpcomingLeadPickerOpen(true)}
          />
          <SettingsRow
            icon={settingsIcons.notifications}
            title="Alert appearance"
            value="Banner style, sounds & previews — system Settings"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() => void Linking.openSettings()}
          />
          {Platform.OS === 'android' && Number(Platform.Version) >= 34 ? (
            <SettingsRow
              icon={settingsIcons.snooze}
              title="Lock screen alarm takeover"
              value="Android 14+ — allow full-screen alarms for Ripple"
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => void openAndroidFullScreenAlarmPermissionSettings()}
            />
          ) : null}
          {Platform.OS === 'android' ? (
            <SettingsRow
              icon={settingsIcons.notifications}
              title="Alarms & Do Not Disturb"
              value="Modes access — turn Ripple ON (requires latest app install)"
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => void openAndroidNotificationPolicyAccessSettings()}
            />
          ) : null}
          {Platform.OS === 'ios' ? (
            <SettingsRow
              icon={settingsIcons.snooze}
              title="Interrupt when ringing"
              value="Focus / Scheduled Summary can delay banners — adjust in iOS Settings"
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {Platform.OS !== 'web' ? (
            <SettingsRow
              icon={settingsIcons.snooze}
              title={repairingAlarms ? 'Repairing…' : 'Repair alarms & notifications'}
              value="Fixes stuck/missing alarms without reinstalling the app"
              right={
                repairingAlarms ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <Text style={styles.chevron}>{settingsIcons.chevron}</Text>
                )
              }
              onPress={() => void onRepairAlarms()}
              noBorder
            />
          ) : null}
        </SettingsGroup>

        <Text style={styles.sectionLabel}>About</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.website}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_BLUE}
            title="Privacy Policy"
            value="How Ripple collects and uses data"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() =>
              void openConfiguredUrl(getPrivacyPolicyUrl(), () =>
                showToast(
                  Platform.OS === 'ios'
                    ? 'Privacy policy URL is not configured. Set EXPO_PUBLIC_RIPPLE_APP_STORE_PRIVACY_POLICY_URL in .env.'
                    : 'Privacy policy URL is not configured. Set EXPO_PUBLIC_RIPPLE_PRIVACY_POLICY_URL in .env.',
                ),
              )
            }
          />
          <SettingsRow
            icon={settingsIcons.rating}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_BLUE}
            title="Terms of Service"
            value="Rules and conditions for using Ripple"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() =>
              void openConfiguredUrl(getTermsOfServiceUrl(), () =>
                showToast(
                  Platform.OS === 'ios'
                    ? 'Terms URL is not configured. Set EXPO_PUBLIC_RIPPLE_APP_STORE_TERMS_OF_SERVICE_URL in .env.'
                    : 'Terms URL is not configured. Set EXPO_PUBLIC_RIPPLE_TERMS_OF_SERVICE_URL in .env.',
                ),
              )
            }
          />
          {Platform.OS !== 'web' ? (
            <SettingsRow
              icon={settingsIcons.rating}
              iconBackgroundColor={SETTINGS_ABOUT_ICON_BLUE}
              title={checkingForUpdate ? 'Checking for updates…' : 'Check for updates'}
              value="See if a newer version is on the store"
              right={
                checkingForUpdate ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <Text style={styles.chevron}>{settingsIcons.chevron}</Text>
                )
              }
              onPress={() => void onCheckForUpdates()}
            />
          ) : null}
          <SettingsRow icon={settingsIcons.info} title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} noBorder />
        </SettingsGroup>

        <Text style={styles.sectionLabel}>Account</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.signOut}
            title={signingOut ? 'Signing out...' : 'Sign out'}
            titleColor={palette.red}
            onPress={() => void onSignOut()}
          />
          <SettingsRow
            icon={settingsIcons.closeAccount}
            title={closingAccount ? 'Closing account...' : 'Close account'}
            value="Permanently delete your alarms, history, and sign-in"
            titleColor={palette.red}
            onPress={() => !closingAccount && !signingOut && setCloseConfirmVisible(true)}
            noBorder
          />
        </SettingsGroup>
      </ScrollView>

      <NotificationsHubSheet
        visible={notificationHubOpen}
        onClose={() => setNotificationHubOpen(false)}
        snoozeMinutes={defaultSnoozeMinutes}
        soundId={defaultSoundId}
        vibrationEnabled={vibrationOn}
        volumePercent={defaultVolumePercent}
        onPressSnooze={openSnoozeFromHub}
        onPressSound={openSoundFromHub}
        onPressVolume={openVolumeFromHub}
        onToggleVibration={(enabled) => void applyVibration(enabled)}
      />

      <CategoryManagerSheet visible={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />

      <SnoozePickerSheet
        visible={snoozePickerOpen}
        onClose={() => setSnoozePickerOpen(false)}
        options={DEFAULT_SNOOZE_OPTIONS_MINUTES}
        selectedMinutes={defaultSnoozeMinutes}
        onSelectMinutes={(m) => void applyDefaultSnooze(m)}
      />

      <SoundPickerSheet
        visible={soundPickerOpen}
        onClose={() => setSoundPickerOpen(false)}
        options={DEFAULT_ALARM_SOUND_OPTIONS}
        selectedId={defaultSoundId}
        previewVolumePercent={defaultVolumePercent}
        sheetHint="Preview plays when this opens and when you tap a sound. Tap OK to save as your default."
        isSubscriber={isSubscriber}
        isSoundLocked={isSoundLocked}
        onLockedSoundPress={onLockedAlarmSoundPress}
        onSelectSoundId={(id) => void applyDefaultSound(id as AlarmSoundId)}
      />

      <VolumePickerSheet
        visible={volumePickerOpen}
        onClose={() => setVolumePickerOpen(false)}
        options={DEFAULT_VOLUME_PERCENT_OPTIONS}
        selectedPercent={defaultVolumePercent}
        onSelectPercent={(p) => void applyDefaultVolume(p)}
      />

      <SnoozePickerSheet
        visible={upcomingLeadPickerOpen}
        onClose={() => setUpcomingLeadPickerOpen(false)}
        options={DEFAULT_UPCOMING_LEAD_OPTIONS_MINUTES}
        selectedMinutes={upcomingLeadMinutes}
        onSelectMinutes={(m) => void applyUpcomingLeadMinutes(m)}
        sheetTitle="Upcoming reminder timing"
        sheetHint="How long before each alarm should Ripple notify you"
        formatOptionLabel={formatUpcomingReminderLeadLabel}
      />

      <AppModal
        transparent
        animationType="fade"
        visible={closeConfirmVisible}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => !closingAccount && setCloseConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes your Ripple account, alarms, and history from our servers. This cannot be
              undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                disabled={closingAccount}
                onPress={() => !closingAccount && setCloseConfirmVisible(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDanger]}
                disabled={closingAccount}
                onPress={() => void onCloseAccount()}>
                {closingAccount ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Close account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>

      <BottomNavbar
        items={[
          { icon: settingsIcons.alarms, label: 'Alarms', onPress: () => navigateToMainTab(router, '/alarm') },
          { icon: settingsIcons.history, label: 'History', onPress: () => navigateToMainTab(router, '/history') },
          { icon: settingsIcons.templates, label: 'Templates', onPress: () => navigateToMainTab(router, '/templates') },
          { icon: settingsIcons.settings, label: 'Settings', active: true, onPress: () => navigateToMainTab(router, '/setting') },
        ]}
      />
      <FullScreenLoadingOverlay visible={signingOut || closingAccount} />
    </View>
  );
}

function createSettingStyles(alarmTheme: AlarmThemePalette) {
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  pageTitle: {
    color: alarmTheme.text,
    fontSize: alarmTypography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {},
  proBanner: {
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proBannerSubscribed: {
    borderColor: 'rgba(52,211,153,0.45)',
  },
  proIcon: {
    fontSize: alarmTypography.titleSm,
  },
  proInfo: {
    flex: 1,
  },
  proTitle: {
    color: alarmTheme.text,
    fontSize: alarmTypography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  proSub: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.micro,
  },
  proBtn: {
    backgroundColor: alarmTheme.accent,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  proBtnText: {
    color: '#ffffff',
    fontSize: alarmTypography.caption,
    fontWeight: '600',
  },
  sectionLabel: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
    marginTop: 16,
    marginHorizontal: 4,
    marginBottom: 10,
  },
  chevron: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.caption,
  },
  themeRow: {
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 8,
  },
  themeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: alarmTheme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: {
    fontSize: alarmTypography.titleSm,
  },
  themeLabel: {
    color: alarmTheme.text,
    fontSize: alarmTypography.body,
    fontWeight: '500',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    backgroundColor: alarmTheme.surface2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  themeOptionActive: {
    borderColor: alarmTheme.accent,
    backgroundColor: alarmTheme.accentDim,
  },
  themeOptionLocked: {
    opacity: 0.55,
  },
  themeOptionText: {
    color: alarmTheme.muted,
    fontSize: alarmTypography.caption,
  },
  themeOptionTextActive: {
    color: alarmTheme.accentBright,
  },
  themeOptionTextLocked: {
    color: alarmTheme.muted,
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
});
}
