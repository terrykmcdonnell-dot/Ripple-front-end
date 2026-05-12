import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type NavItem = {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
};

type BottomNavbarProps = {
  items: NavItem[];
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    nav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      backgroundColor: alarmTheme.navBarBg,
      borderTopWidth: 1,
      borderTopColor: alarmTheme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 10,
      paddingBottom: 15,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
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
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.nav}>
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
    </View>
  );
}
