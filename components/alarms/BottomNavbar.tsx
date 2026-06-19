import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { resolveBottomSafeInset } from '@/lib/screen-safe-area';

type NavItem = {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
};

type BottomNavbarProps = {
  items: NavItem[];
};

/** Icon + label block inside the tab bar (excludes safe-area padding). */
export const TAB_BAR_INNER_HEIGHT = 56;

/** Scroll/toast offset so content clears the tab bar on any device. */
export function useTabBarReservedHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_INNER_HEIGHT + 10 + resolveBottomSafeInset(insets) + 6;
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    nav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: alarmTheme.navBarBg,
      borderTopWidth: 1,
      borderTopColor: alarmTheme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 10,
      paddingTop: 10,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: TAB_BAR_INNER_HEIGHT,
    },
    icon: {
      fontSize: alarmTypography.titleSm,
      color: alarmTheme.muted,
    },
    label: {
      fontSize: alarmTypography.micro,
      color: alarmTheme.muted,
      fontFamily: 'monospace',
    },
    active: {
      color: alarmTheme.accentBright,
    },
  });
}

export function BottomNavbar({ items }: BottomNavbarProps) {
  const alarmTheme = useAlarmTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const navPadBottom = resolveBottomSafeInset(insets) + 6;
  const safeAreaExtra = Math.max(0, navPadBottom - insets.bottom);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.nav, safeAreaExtra > 0 ? { paddingBottom: safeAreaExtra } : null]}>
      {items.map((item) => {
        const isCurrent = item.active === true;
        return (
          <Pressable
            key={item.label}
            style={styles.item}
            disabled={isCurrent}
            accessibilityState={{ disabled: isCurrent }}
            onPress={item.onPress}>
            <Text style={[styles.icon, item.active ? styles.active : null]}>{item.icon}</Text>
            <Text style={[styles.label, item.active ? styles.active : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}
