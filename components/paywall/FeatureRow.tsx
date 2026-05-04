import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { paywallIcons } from '@/assets/icons/paywall-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type FeatureRowProps = {
  text: string;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    row: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    checkWrap: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: alarmTheme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    check: {
      color: alarmTheme.green,
      fontSize: 12,
      fontWeight: '700',
    },
    text: {
      color: alarmTheme.text,
      fontSize: 13,
      flex: 1,
    },
  });
}

export function FeatureRow({ text }: FeatureRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.row}>
      <View style={styles.checkWrap}>
        <Text style={styles.check}>{paywallIcons.check}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
