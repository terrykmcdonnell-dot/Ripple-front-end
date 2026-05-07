import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { isAlarmPaletteDark, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { SegmentButton } from '@/components/alarms-create/SegmentButton';
import { clockPartsFromDate } from '@/lib/alarm-time';

type AlarmTimePickRowProps = {
  value: Date;
  onChange: (next: Date) => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      borderBottomWidth: 1,
      borderBottomColor: alarmTheme.border,
      marginHorizontal: 20,
      marginBottom: 16,
      paddingBottom: 8,
    },
    timePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingTop: 16,
      paddingBottom: 6,
    },
    nativeTap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    webTimeBlock: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    webCol: {
      alignItems: 'center',
      gap: 2,
    },
    nudgeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    nudgeText: {
      color: alarmTheme.accentBright,
      fontSize: 14,
      fontWeight: '700',
    },
    timeVal: {
      color: alarmTheme.text,
      fontSize: 52,
      fontWeight: '800',
      lineHeight: 52,
      letterSpacing: -1.5,
      paddingHorizontal: 6,
    },
    timeSep: {
      color: alarmTheme.muted,
      fontSize: 40,
      fontWeight: '300',
      lineHeight: 40,
      paddingBottom: 4,
    },
    ampmWrap: {
      gap: 4,
      paddingBottom: 4,
      marginLeft: 4,
    },
    hint: {
      textAlign: 'center',
      color: alarmTheme.muted,
      fontSize: 11,
      paddingBottom: 8,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalDismiss: {
      flex: 1,
      width: '100%',
    },
    iosSheet: {
      backgroundColor: alarmTheme.surface,
      paddingBottom: 28,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    iosHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    iosDone: {
      color: alarmTheme.accentBright,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}

export function AlarmTimePickRow({ value, onChange }: AlarmTimePickRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const pickerTheme = isAlarmPaletteDark(alarmTheme) ? 'dark' : 'light';

  const { h12, minute, meridiem } = useMemo(() => clockPartsFromDate(value), [value]);
  const [iosOpen, setIosOpen] = useState(false);

  const applyMeridiem = useCallback(
    (nextMeridiem: 'AM' | 'PM') => {
      if (nextMeridiem === meridiem) {
        return;
      }
      const d = new Date(value);
      const h = d.getHours();
      if (nextMeridiem === 'PM' && h < 12) {
        d.setHours(h + 12);
      } else if (nextMeridiem === 'AM' && h >= 12) {
        d.setHours(h - 12);
      }
      onChange(d);
      void Haptics.selectionAsync();
    },
    [meridiem, onChange, value],
  );

  const bumpHour = (delta: number) => {
    const d = new Date(value);
    d.setHours(d.getHours() + delta, d.getMinutes(), 0, 0);
    onChange(d);
    void Haptics.selectionAsync();
  };

  const bumpMinute = (delta: number) => {
    const d = new Date(value);
    d.setMinutes(d.getMinutes() + delta, 0, 0);
    onChange(d);
    void Haptics.selectionAsync();
  };

  const openPicker = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        display: 'clock',
        onChange: (event, selected) => {
          if (event.type !== 'set' || !selected) {
            return;
          }
          const merged = new Date(value);
          merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          onChange(merged);
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setIosOpen(true);
    }
  };

  const onIosPick = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      const merged = new Date(value);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(merged);
    }
  };

  const pad2 = (n: number) => n.toString().padStart(2, '0');

  return (
    <View style={styles.wrap}>
      <View style={styles.timePicker}>
        {Platform.OS === 'web' ? (
          <View style={styles.webTimeBlock}>
            <View style={styles.webCol}>
              <Pressable onPress={() => bumpHour(1)} style={styles.nudgeBtn}>
                <Text style={styles.nudgeText}>▲</Text>
              </Pressable>
              <Text style={styles.timeVal}>{h12}</Text>
              <Pressable onPress={() => bumpHour(-1)} style={styles.nudgeBtn}>
                <Text style={styles.nudgeText}>▼</Text>
              </Pressable>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.webCol}>
              <Pressable onPress={() => bumpMinute(1)} style={styles.nudgeBtn}>
                <Text style={styles.nudgeText}>▲</Text>
              </Pressable>
              <Text style={styles.timeVal}>{pad2(minute)}</Text>
              <Pressable onPress={() => bumpMinute(-1)} style={styles.nudgeBtn}>
                <Text style={styles.nudgeText}>▼</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={openPicker} style={styles.nativeTap} accessibilityRole="button" accessibilityLabel="Choose time">
            <Text style={styles.timeVal}>{h12}</Text>
            <Text style={styles.timeSep}>:</Text>
            <Text style={styles.timeVal}>{pad2(minute)}</Text>
          </Pressable>
        )}

        <View style={styles.ampmWrap}>
          {(['AM', 'PM'] as const).map((item) => (
            <SegmentButton
              key={item}
              label={item}
              compact
              active={meridiem === item}
              onPress={() => applyMeridiem(item)}
            />
          ))}
        </View>
      </View>

      <Text style={styles.hint}>{Platform.OS === 'web' ? 'Use arrows to adjust · tap AM/PM' : 'Tap time to open picker'}</Text>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} animationType="slide" transparent presentationStyle="overFullScreen">
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalDismiss} onPress={() => setIosOpen(false)} />
            <View style={styles.iosSheet}>
              <View style={styles.iosHeader}>
                <Pressable onPress={() => setIosOpen(false)} hitSlop={12}>
                  <Text style={styles.iosDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={value}
                mode="time"
                display="spinner"
                minuteInterval={5}
                onChange={onIosPick}
                themeVariant={pickerTheme}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
