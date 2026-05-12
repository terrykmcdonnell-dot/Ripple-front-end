import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type Category = { key: string; label: string };

type TemplateCategoryTabsProps = {
  categories: Category[];
  activeKey: string;
  onSelect: (key: string) => void;
};

/** Matches `HistoryFilterTabs` so category chips don’t stretch vertically (ScrollView needs flexGrow: 0). */
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

export function TemplateCategoryTabs({ categories, activeKey, onSelect }: TemplateCategoryTabsProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <ScrollView
      style={styles.scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {categories.map((cat) => {
        const active = cat.key === activeKey;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={[styles.tab, active ? styles.activeTab : null]}>
            <Text style={[styles.tabText, active ? styles.activeTabText : null]}>{cat.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.endSpace} />
    </ScrollView>
  );
}
