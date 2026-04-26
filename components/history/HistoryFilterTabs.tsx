import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type TabItem = {
  key: string;
  label: string;
};

type HistoryFilterTabsProps = {
  tabs: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function HistoryFilterTabs({ tabs, activeKey, onSelect }: HistoryFilterTabsProps) {
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

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 'unset',
  },
  container: {
    paddingLeft: 16,
    paddingBottom: 14,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  activeTab: {
    backgroundColor: alarmTheme.accentDim,
    borderColor: alarmTheme.accent,
  },
  tabText: {
    fontSize: 12,
    color: alarmTheme.muted,
    lineHeight: 14,
  },
  activeTabText: {
    color: alarmTheme.accentBright,
  },
  endSpace: {
    width: 8,
  },
});
