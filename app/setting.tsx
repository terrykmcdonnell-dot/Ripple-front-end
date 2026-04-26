import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { settingsIcons } from '@/assets/icons/settings-icons';
import { BottomNavbar } from '@/components/alarms/BottomNavbar';
import { AlarmToggle } from '@/components/alarms/AlarmToggle';
import { alarmTheme } from '@/components/alarms/theme';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { SettingsRow } from '@/components/settings/SettingsRow';

const themes = ['Light', 'Dark', 'Auto'] as const;

export default function SettingScreen() {
  const router = useRouter();
  const [vibrationOn, setVibrationOn] = useState(true);
  const [upcomingOn, setUpcomingOn] = useState(true);
  const [theme, setTheme] = useState<(typeof themes)[number]>('Dark');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(6,182,212,0.2)', 'rgba(6,182,212,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.proBanner}>
          <Text style={styles.proIcon}>{settingsIcons.pro}</Text>
          <View style={styles.proInfo}>
            <Text style={styles.proTitle}>Upgrade to Pro</Text>
            <Text style={styles.proSub}>Unlimited alarms · Widgets · Cloud sync</Text>
          </View>
          <Pressable style={styles.proBtn} onPress={() => router.push('/paywall')}>
            <Text style={styles.proBtnText}>$9.99/yr</Text>
          </Pressable>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Alarms</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.snooze}
            title="Default Snooze"
            value="10 minutes"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
          />
          <SettingsRow
            icon={settingsIcons.sound}
            title="Default Sound"
            value="Gentle Rise"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
          />
          <SettingsRow
            icon={settingsIcons.vibration}
            title="Vibration"
            value={vibrationOn ? 'On' : 'Off'}
            right={<AlarmToggle enabled={vibrationOn} onPress={() => setVibrationOn((v) => !v)} />}
          />
          <SettingsRow
            icon={settingsIcons.volume}
            title="Volume"
            value="80%"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
            noBorder
          />
        </SettingsGroup>

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
              {themes.map((item) => {
                const active = theme === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.themeOption, active ? styles.themeOptionActive : null]}
                    onPress={() => setTheme(item)}>
                    <Text style={[styles.themeOptionText, active ? styles.themeOptionTextActive : null]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsGroup>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.notifications}
            title="Notifications"
            value="Allowed"
            valueColor={alarmTheme.green}
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
          />
          <SettingsRow
            icon={settingsIcons.upcoming}
            title="Upcoming Reminder"
            value="1 hour before"
            right={<AlarmToggle enabled={upcomingOn} onPress={() => setUpcomingOn((v) => !v)} />}
            noBorder
          />
        </SettingsGroup>

        <Text style={styles.sectionLabel}>About</Text>
        <SettingsGroup>
          <SettingsRow
            icon={settingsIcons.privacy}
            title="Privacy Policy"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
          />
          <SettingsRow
            icon={settingsIcons.feedback}
            title="Send Feedback"
            right={<Text style={styles.chevron}>{settingsIcons.chevron}</Text>}
          />
          <SettingsRow icon={settingsIcons.info} title="Version" value="1.0.0" noBorder />
        </SettingsGroup>
      </ScrollView>

      <BottomNavbar
        items={[
          { icon: settingsIcons.alarms, label: 'Alarms', onPress: () => router.push('/alarm') },
          { icon: settingsIcons.history, label: 'History', onPress: () => router.push('/history') },
          { icon: settingsIcons.templates, label: 'Templates', onPress: () => router.push('/templates') },
          { icon: settingsIcons.settings, label: 'Settings', active: true, onPress: () => router.push('/setting') },
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
    paddingBottom: 16,
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
  themeOptionText: {
    color: alarmTheme.muted,
    fontSize: 12,
  },
  themeOptionTextActive: {
    color: alarmTheme.accentBright,
  },
});
