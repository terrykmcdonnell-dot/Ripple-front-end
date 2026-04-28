import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ringIcons } from '@/assets/icons/alarm-ring-icons';
import { RingActionButton } from '@/components/alarm-ring/RingActionButton';
import { RingPulse } from '@/components/alarm-ring/RingPulse';
import { alarmTheme } from '@/components/alarms/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';

export default function AlarmRingScreen() {
  useRequireAuth();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <RingPulse icon={ringIcons.alarm} />

        <Text style={styles.alarmLabel}>Alarm</Text>
        <Text style={styles.time}>7:00</Text>
        <Text style={styles.date}>Friday, 25 April 2026</Text>

        <Text style={styles.name}>Take Medication</Text>
        <Text style={styles.repeat}>↻ Repeats every 3 days</Text>

        <View style={styles.actions}>
          <RingActionButton icon={ringIcons.snooze} label="Snooze 10m" variant="snooze" />
          <RingActionButton
            icon={ringIcons.dismiss}
            label="Dismiss"
            variant="dismiss"
            onPress={() => router.push('/alarm')}
          />
        </View>

        <Text style={styles.next}>Next ring: Monday 28 April at 7:00 AM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  alarmLabel: {
    color: alarmTheme.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  name: {
    color: alarmTheme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  repeat: {
    color: alarmTheme.accentBright,
    fontSize: 13,
    marginBottom: 10,
  },
  time: {
    color: alarmTheme.text,
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 48,
    letterSpacing: -1.4,
    marginBottom: 4,
  },
  date: {
    color: alarmTheme.muted,
    fontSize: 13,
    marginBottom: 40,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  next: {
    color: alarmTheme.muted,
    fontSize: 11,
    marginTop: 14,
    fontFamily: 'monospace',
  },
});
