import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { LinearGradient } from 'expo-linear-gradient';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { settingsIcons } from '@/assets/icons/settings-icons';
import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { alarmTheme } from '@/components/alarms/theme';
import { NotificationsHubSheet } from '@/components/settings/NotificationsHubSheet';
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
} from '@/lib/settings-preferences';
import {
  SETTINGS_ABOUT_ICON_AMBER,
  SETTINGS_ABOUT_ICON_BLUE,
  SETTINGS_ABOUT_ICON_GREEN,
  openConfiguredUrl,
  openStoreReviewFlow,
} from '@/lib/settings-about-links';
import { supabase } from '@/lib/supabase';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { notificationPrefsEligibleForDbSync, patchSignedInUserSettings } from '@/lib/sync-user-settings-db';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { syncAlarmFireNotifications } from '@/lib/alarm-fire-scheduler';
import { applyAlarmVolumePreferenceToDevice } from '@/lib/alarm-system-volume';
import { syncUpcomingReminderNotifications } from '@/lib/upcoming-reminder-scheduler';

async function openAndroidPreciseAlarmSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package;
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
      ...(pkg ? { extra: { 'android.provider.extra.APP_PACKAGE': pkg } } : {}),
    });
  } catch {
    await Linking.openSettings();
  }
}

export default function SettingScreen() {
  useRequireAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const {
    isSubscriber,
    loading: subLoading,
    titleLine,
    managementURL,
    limitsApply,
    renewalHint,
  } = useSubscriptionStatus();
  const [vibrationOn, setVibrationOn] = useState(true);
  const [upcomingOn, setUpcomingOn] = useState(true);
  const [upcomingLeadMinutes, setUpcomingLeadMinutes] = useState(60);
  const [theme, setTheme] = useState<AppThemePreference>('Dark');
  const [signingOut, setSigningOut] = useState(false);
  const [defaultSnoozeMinutes, setDefaultSnoozeMinutes] = useState(10);
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false);
  const [defaultSoundId, setDefaultSoundId] = useState<AlarmSoundId>('gentle-rise');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [defaultVolumePercent, setDefaultVolumePercent] = useState(80);
  const [volumePickerOpen, setVolumePickerOpen] = useState(false);
  const [notificationHubOpen, setNotificationHubOpen] = useState(false);
  const [notifOsAllowed, setNotifOsAllowed] = useState(false);
  const [notifCanAskAgain, setNotifCanAskAgain] = useState(true);
  const [notificationsMasterEnabled, setNotificationsMasterEnabled] = useState(true);

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
        loadedMaster,
        loadedTheme,
      ] = await Promise.all([
        loadDefaultSnoozeMinutes(),
        loadDefaultAlarmSoundId(),
        loadDefaultVolumePercent(),
        loadDefaultVibrationEnabled(),
        loadUpcomingReminderEnabled(),
        loadUpcomingReminderLeadMinutes(),
        loadNotificationsMasterEnabled(),
        loadAppThemePreference(),
      ]);
      if (!cancelled) {
        setDefaultSnoozeMinutes(loadedSnooze);
        setDefaultSoundId(loadedSound);
        setDefaultVolumePercent(loadedVolume);
        setVibrationOn(loadedVibration);
        setUpcomingOn(loadedUpcoming);
        setUpcomingLeadMinutes(loadedLead);
        setNotificationsMasterEnabled(loadedMaster);
        setTheme(loadedTheme);
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
        const master = await loadNotificationsMasterEnabled();
        if (!active) {
          return;
        }
        setNotificationsMasterEnabled(master);
        invalidateSubscriptionCache();
        if (Platform.OS !== 'web') {
          await refreshNotificationPermissionUi();
        }
      })();
      return () => {
        active = false;
      };
    }, [refreshNotificationPermissionUi]),
  );

  const applyDefaultSnooze = useCallback(async (minutes: number) => {
    setDefaultSnoozeMinutes(minutes);
    await saveDefaultSnoozeMinutes(minutes);
    await patchSignedInUserSettings({ defaultSnoozeDuration: minutes });
  }, []);

  const applyDefaultSound = useCallback(async (id: AlarmSoundId) => {
    setDefaultSoundId(id);
    await saveDefaultAlarmSoundId(id);
    await syncUpcomingReminderNotifications();
    await syncAlarmFireNotifications();
    if (await notificationPrefsEligibleForDbSync()) {
      await patchSignedInUserSettings({ defaultAlarmSound: id });
    }
  }, []);

  const applyDefaultVolume = useCallback(async (percent: number) => {
    setDefaultVolumePercent(percent);
    await saveDefaultVolumePercent(percent);
    await applyAlarmVolumePreferenceToDevice(percent);
    if (await notificationPrefsEligibleForDbSync()) {
      await patchSignedInUserSettings({ alarmVolume: String(percent) });
    }
  }, []);

  const applyVibration = useCallback(async (enabled: boolean) => {
    setVibrationOn(enabled);
    await saveDefaultVibrationEnabled(enabled);
    await syncUpcomingReminderNotifications();
    await syncAlarmFireNotifications();
    if (await notificationPrefsEligibleForDbSync()) {
      await patchSignedInUserSettings({ isVibrationEnabled: enabled });
    }
  }, []);

  const applyUpcomingReminder = useCallback(async (enabled: boolean) => {
    setUpcomingOn(enabled);
    await saveUpcomingReminderEnabled(enabled);
    await syncUpcomingReminderNotifications();
    await syncAlarmFireNotifications();
    if (!enabled || (await notificationPrefsEligibleForDbSync())) {
      await patchSignedInUserSettings({ isUpcomingReminderEnabled: enabled });
    }
    showToast(enabled ? 'Upcoming reminders on' : 'Upcoming reminders off');
  }, []);

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
    Platform.OS !== 'web' && notifOsAllowed && notificationsMasterEnabled;

  const onNotificationsMasterToggle = useCallback(async () => {
    if (Platform.OS === 'web') {
      showToast('Notification toggles are available in the Ripple mobile app.');
      return;
    }
    await Haptics.selectionAsync();

    if (notificationsEffectiveOn) {
      await saveNotificationsMasterEnabled(false);
      setNotificationsMasterEnabled(false);
      await cancelAllRippleScheduledNotifications();
      await patchSignedInUserSettings({ areNotificationsAllowed: false });
      showToast('Notifications turned off');
      return;
    }

    let p = await getPermissionsAsync();
    let allowed = isOsNotificationAllowed(p);
    if (!allowed && p.canAskAgain !== false) {
      const req = await requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      allowed = isOsNotificationAllowed(req);
      await refreshNotificationPermissionUi();
    }
    if (!allowed) {
      await Linking.openSettings();
      showToast('Allow notifications in Settings to turn Ripple alerts on.');
      return;
    }

    await saveNotificationsMasterEnabled(true);
    setNotificationsMasterEnabled(true);
    await syncUpcomingReminderNotifications();
    await syncAlarmFireNotifications();
    await patchSignedInUserSettings({ areNotificationsAllowed: true });
    showToast('Notifications turned on');
  }, [notificationsEffectiveOn, refreshNotificationPermissionUi]);

  let notificationsStatusLabel = 'Paused';
  let notificationsStatusColor = alarmTheme.muted;
  if (Platform.OS === 'web') {
    notificationsStatusLabel = 'Mobile app only';
    notificationsStatusColor = alarmTheme.muted;
  } else if (!notifOsAllowed) {
    notificationsStatusLabel = notifCanAskAgain ? 'Tap toggle to enable' : 'Off — open Settings';
    notificationsStatusColor = alarmTheme.red;
  } else if (!notificationsMasterEnabled) {
    notificationsStatusLabel = 'Paused';
    notificationsStatusColor = alarmTheme.muted;
  } else {
    notificationsStatusLabel = 'Allowed';
    notificationsStatusColor = alarmTheme.green;
  }

  const onSignOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    await clearPendingSignUp();
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      notifyAuthError('Sign out', error);
      return;
    }
    router.replace('/signin');
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                  {renewalHint ?? 'Manage or change plan in the store'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.proTitle}>Upgrade to Pro</Text>
                <Text style={styles.proSub}>Unlimited alarms · Widgets · Templates · Themes</Text>
              </>
            )}
          </View>
          {Platform.OS !== 'web' && !subLoading && isSubscriber ? (
            <Pressable
              style={styles.proBtn}
              onPress={() => {
                const url = managementURL;
                if (url) {
                  void Linking.openURL(url);
                } else {
                  void Linking.openSettings();
                }
              }}>
              <Text style={styles.proBtnText}>Manage</Text>
            </Pressable>
          ) : Platform.OS !== 'web' && !subLoading && !isSubscriber ? (
            <Pressable style={styles.proBtn} onPress={() => router.push('/paywall')}>
              <Text style={styles.proBtnText}>See plans</Text>
            </Pressable>
          ) : null}
        </LinearGradient>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <SettingsGroup>
          <View style={styles.themeRow}>
            <View style={styles.themeHeading}>
              <View style={styles.themeIconWrap}>
                <Text style={styles.themeIcon}>{settingsIcons.theme}</Text>
              </View>
              <Text style={styles.themeLabel}>Theme</Text>
            </View>
            <View style={styles.themeOptions}>
              {APP_THEME_OPTIONS.map((item) => {
                const active = theme === item;
                const locked = limitsApply && item !== 'Dark';
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
                        showToast('Light and Auto themes are included with Ripple Pro.');
                        router.push('/paywall');
                        return;
                      }
                      void (async () => {
                        setTheme(item);
                        await saveAppThemePreference(item);
                        await patchSignedInUserSettings({ appTheme: item });
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

        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingsGroup>
          <NotificationsMasterRow
            icon={settingsIcons.notifications}
            title="Notifications"
            statusLabel={notificationsStatusLabel}
            statusColor={notificationsStatusColor}
            summaryLine={`${formatSnoozeMinutesLabel(defaultSnoozeMinutes)} · ${formatVolumePercentLabel(defaultVolumePercent)}`}
            toggleEnabled={notificationsEffectiveOn}
            showToggle={Platform.OS !== 'web'}
            onPressHub={() => setNotificationHubOpen(true)}
            onToggle={() => void onNotificationsMasterToggle()}
          />
          <SettingsRow
            icon={settingsIcons.upcoming}
            title="Upcoming Reminder"
            value={formatUpcomingReminderLeadLabel(upcomingLeadMinutes)}
            right={<AlarmToggle enabled={upcomingOn} onPress={() => void applyUpcomingReminder(!upcomingOn)} />}
          />
          <SettingsRow
            icon={settingsIcons.notifications}
            title="Alert appearance"
            value="Banner style, sounds & previews — system Settings"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() => void Linking.openSettings()}
          />
          {Platform.OS === 'android' ? (
            <SettingsRow
              icon={settingsIcons.snooze}
              title="Precise alarms (Android)"
              value="Opens Ripple's Alarms & reminders permission — fires on time"
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => void openAndroidPreciseAlarmSettings()}
              noBorder
            />
          ) : (
            <SettingsRow
              icon={settingsIcons.snooze}
              title="Interrupt when ringing"
              value="Focus / Scheduled Summary can delay banners — adjust in iOS Settings"
              right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
              onPress={() => void Linking.openSettings()}
              noBorder
            />
          )}
        </SettingsGroup>

        <Text style={styles.sectionLabel}>About</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.privacy}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_BLUE}
            title="Privacy Policy"
            value="How we handle your data"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() =>
              void openConfiguredUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL, () =>
                showToast('Add EXPO_PUBLIC_PRIVACY_POLICY_URL in .env with your policy URL.'),
              )
            }
          />
          <SettingsRow
            icon={settingsIcons.terms}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_BLUE}
            title="Terms of Service"
            value="Rules for using Ripple"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() =>
              void openConfiguredUrl(process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL, () =>
                showToast('Add EXPO_PUBLIC_TERMS_OF_SERVICE_URL in .env with your terms URL.'),
              )
            }
          />
          <SettingsRow
            icon={settingsIcons.feedback}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_GREEN}
            title="Send Feedback"
            value="Share ideas or report a problem"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() =>
              void openConfiguredUrl(process.env.EXPO_PUBLIC_FEEDBACK_URL, () =>
                showToast(
                  'Add EXPO_PUBLIC_FEEDBACK_URL in .env (https form or mailto:support@yourdomain.com).',
                ),
              )
            }
          />
          <SettingsRow
            icon={settingsIcons.rating}
            iconBackgroundColor={SETTINGS_ABOUT_ICON_AMBER}
            title="Rate Ripple"
            value="Leave a review on the App Store or Play Store"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            onPress={() => openStoreReviewFlow(showToast)}
          />
          <SettingsRow icon={settingsIcons.info} title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} noBorder />
        </SettingsGroup>

        <Text style={styles.sectionLabel}>Account</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.signOut}
            title={signingOut ? 'Signing out...' : 'Sign out'}
            titleColor={alarmTheme.red}
            onPress={() => void onSignOut()}
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
        onSelectSoundId={(id) => void applyDefaultSound(id as AlarmSoundId)}
      />

      <VolumePickerSheet
        visible={volumePickerOpen}
        onClose={() => setVolumePickerOpen(false)}
        options={DEFAULT_VOLUME_PERCENT_OPTIONS}
        selectedPercent={defaultVolumePercent}
        onSelectPercent={(p) => void applyDefaultVolume(p)}
      />

      <BottomNavbar
        items={[
          { icon: settingsIcons.alarms, label: 'Alarms', onPress: () => router.push('/alarm') },
          { icon: settingsIcons.history, label: 'History', onPress: () => router.push('/history') },
          { icon: settingsIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: settingsIcons.settings, label: 'Settings', active: true, onPress: () => router.push('/setting') },
        ]}
      />
      <FullScreenLoadingOverlay visible={signingOut} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 10,
    paddingBottom: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  pageTitle: {
    color: alarmTheme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 88,
  },
  proBanner: {
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proBannerSubscribed: {
    borderColor: 'rgba(52,211,153,0.45)',
  },
  proIcon: {
    fontSize: 24,
  },
  proInfo: {
    flex: 1,
  },
  proTitle: {
    color: alarmTheme.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  proSub: {
    color: alarmTheme.muted,
    fontSize: 11,
  },
  proBtn: {
    backgroundColor: alarmTheme.accent,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  proBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    color: alarmTheme.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
    marginTop: 14,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  chevron: {
    color: alarmTheme.muted,
    fontSize: 13,
  },
  themeRow: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  themeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: alarmTheme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: {
    fontSize: 18,
  },
  themeLabel: {
    color: alarmTheme.text,
    fontSize: 13,
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
    paddingVertical: 8,
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
    fontSize: 12,
  },
  themeOptionTextActive: {
    color: alarmTheme.accentBright,
  },
  themeOptionTextLocked: {
    color: alarmTheme.muted,
  },
});
