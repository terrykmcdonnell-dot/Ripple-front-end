import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type TemplateAlarm = {
  emoji: string;
  name: string;
  interval: string;
};

type TemplateCardProps = {
  icon: string;
  iconTone: 'green' | 'purple' | 'amber' | 'blue';
  title: string;
  desc: string;
  alarms: TemplateAlarm[];
  installed: boolean;
  /** Disables install button while API work runs */
  installBusy?: boolean;
  /** When true and not installed, install action is for Pro upgrade (parent handles navigation). */
  premiumLocked?: boolean;
  onToggleInstall: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    icon: { fontSize: alarmTypography.titleSm },
    headerInfo: { flex: 1 },
    title: { color: alarmTheme.text, fontSize: alarmTypography.body, fontWeight: '700', marginBottom: 4 },
    desc: { color: alarmTheme.muted, fontSize: alarmTypography.micro, lineHeight: alarmTypography.micro * 1.45 },
    alarmList: { gap: 5, marginBottom: 12 },
    alarmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: alarmTheme.surface2,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    alarmEmoji: { fontSize: alarmTypography.caption },
    alarmName: { flex: 1, color: alarmTheme.text, fontSize: alarmTypography.micro },
    alarmInterval: { color: alarmTheme.accentBright, fontSize: 10, fontFamily: 'monospace' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { color: alarmTheme.muted, fontSize: alarmTypography.micro, fontFamily: 'monospace' },
    installBtn: {
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 18,
    },
    defaultBtn: {
      backgroundColor: alarmTheme.accentDim,
      borderColor: alarmTheme.accentBannerBorder,
    },
    greenBtn: {
      backgroundColor: alarmTheme.greenDim,
      borderColor: 'rgba(52,211,153,0.3)',
    },
    installedBtn: {
      backgroundColor: alarmTheme.surface3,
      borderColor: alarmTheme.border,
    },
    installText: { fontSize: alarmTypography.caption, fontWeight: '600' },
    defaultText: { color: alarmTheme.accentBright },
    greenText: { color: alarmTheme.green },
    installedText: { color: alarmTheme.muted },
    lockedBtn: {
      backgroundColor: alarmTheme.amberDim,
      borderColor: 'rgba(251,191,36,0.35)',
    },
    lockedText: { color: alarmTheme.amber },
  });
}

export function TemplateCard({
  icon,
  iconTone,
  title,
  desc,
  alarms,
  installed,
  installBusy,
  premiumLocked,
  onToggleInstall,
}: TemplateCardProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const toneBg = useMemo(
    () => ({
      green: alarmTheme.greenDim,
      purple: alarmTheme.accentDim,
      amber: alarmTheme.amberDim,
      blue: alarmTheme.blueDim,
    }),
    [alarmTheme]
  );

  const showProInstall = premiumLocked === true && !installed;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: toneBg[iconTone] }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
      </View>

      <View style={styles.alarmList}>
        {alarms.map((alarm) => (
          <View key={`${title}-${alarm.name}`} style={styles.alarmRow}>
            <Text style={styles.alarmEmoji}>{alarm.emoji}</Text>
            <Text style={styles.alarmName}>{alarm.name}</Text>
            <Text style={styles.alarmInterval}>{alarm.interval}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.count}>{alarms.length} alarms</Text>
        <Pressable
          onPress={onToggleInstall}
          disabled={installBusy === true}
          style={[
            styles.installBtn,
            installed
              ? styles.installedBtn
              : showProInstall
                ? styles.lockedBtn
                : iconTone === 'green'
                  ? styles.greenBtn
                  : styles.defaultBtn,
            installBusy ? { opacity: 0.55 } : null,
          ]}>
          <Text
            style={[
              styles.installText,
              installed
                ? styles.installedText
                : showProInstall
                  ? styles.lockedText
                  : iconTone === 'green'
                    ? styles.greenText
                    : styles.defaultText,
            ]}>
            {installBusy ? 'Working…' : installed ? '✓ Installed' : showProInstall ? 'Ripple Pro' : '+ Install Pack'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
