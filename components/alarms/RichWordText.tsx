import { StyleSheet, Text, TextStyle } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type WordChunk = {
  text: string;
  color?: string;
  style?: TextStyle;
};

type RichWordTextProps = {
  words: WordChunk[];
  style?: TextStyle;
};

export function RichWordText({ words, style }: RichWordTextProps) {
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

const styles = StyleSheet.create({
  base: {
    color: alarmTheme.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
