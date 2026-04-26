import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type NavItem = {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
};

type BottomNavbarProps = {
  items: NavItem[];
};

export function BottomNavbar({ items }: BottomNavbarProps) {
  return (
    <View style={styles.nav}>
      {items.map((item) => (
        <Pressable key={item.label} style={styles.item} onPress={item.onPress}>
          <Text style={[styles.icon, item.active ? styles.active : null]}>{item.icon}</Text>
          <Text style={[styles.label, item.active ? styles.active : null]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: 'rgba(8,8,16,0.96)',
    borderTopWidth: 1,
    borderTopColor: alarmTheme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 20,
    color: alarmTheme.muted,
  },
  label: {
    fontSize: 10,
    color: alarmTheme.muted,
    fontFamily: 'monospace',
  },
  active: {
    color: alarmTheme.accentBright,
  },
});
