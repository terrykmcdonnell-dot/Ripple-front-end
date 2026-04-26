import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type Category = { key: string; label: string };

type TemplateCategoryTabsProps = {
  categories: Category[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function TemplateCategoryTabs({ categories, activeKey, onSelect }: TemplateCategoryTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {categories.map((cat) => {
        const active = cat.key === activeKey;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={[styles.tab, active ? styles.activeTab : null]}>
            <Text style={[styles.tabText, active ? styles.activeText : null]}>{cat.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.end} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
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
    color: alarmTheme.muted,
    fontSize: 12,
  },
  activeText: {
    color: alarmTheme.accentBright,
  },
  end: {
    width: 8,
  },
});
