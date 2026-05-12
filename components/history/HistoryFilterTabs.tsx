import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type TabItem = {
  key: string;
  label: string;
};

type HistoryFilterTabsProps = {
  tabs: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 0,
    },
    container: {
      paddingLeft: 16,
      paddingBottom: 16,
      gap: 8,
      alignItems: 'center',
    },
    tab: {
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    activeTab: {
      backgroundColor: alarmTheme.accentDim,
      borderColor: alarmTheme.accent,
    },
    tabText: {
      fontSize: alarmTypography.caption,
      color: alarmTheme.muted,
      lineHeight: alarmTypography.caption + 2,
    },
    activeTabText: {
      color: alarmTheme.accentBright,
    },
    endSpace: {
      width: 8,
    },
  });
}

export function HistoryFilterTabs({ tabs, activeKey, onSelect }: HistoryFilterTabsProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <ScrollView
      style={styles.scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[styles.tab, active ? styles.activeTab : null]}>
            <Text style={[styles.tabText, active ? styles.activeTabText : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.endSpace} />
    </ScrollView>
  );
}
