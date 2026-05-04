import { useMemo } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type WordChunk = {
  text: string;
  color?: string;
  style?: TextStyle;
};

type RichWordTextProps = {
  words: WordChunk[];
  style?: TextStyle;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    base: {
      color: alarmTheme.muted,
      fontSize: 11,
      fontFamily: 'monospace',
    },
  });
}

export function RichWordText({ words, style }: RichWordTextProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  return (
    <Text style={[styles.base, style]}>
      {words.map((word, index) => (
        <Text key={`${word.text}-${index}`} style={[word.style, word.color ? { color: word.color } : null]}>
          {word.text}
        </Text>
      ))}
    </Text>
  );
}
