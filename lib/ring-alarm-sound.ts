import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import type { AlarmSoundId } from '@/lib/settings-preferences';
import { coerceAlarmSoundId, loadDefaultAlarmSoundId } from '@/lib/settings-preferences';

/** Bundled WAVs (same files as `app.json` → expo-notifications `sounds`). */
const ALARM_SOUND_SOURCES: Record<AlarmSoundId, number> = {
  'gentle-rise': require('../assets/sounds/gentle_rise.wav'),
  'morning-glow': require('../assets/sounds/morning_glow.wav'),
  'classic-bell': require('../assets/sounds/classic_bell.wav'),
  'digital-beep': require('../assets/sounds/digital_beep.wav'),
  'soft-piano': require('../assets/sounds/soft_piano.wav'),
  'nature-birds': require('../assets/sounds/nature_birds.wav'),
};

let activeRingSound: Audio.Sound | null = null;
let activeRingSoundId: AlarmSoundId | null = null;

export async function stopRingAlarmSound(): Promise<void> {
  if (activeRingSound) {
    try {
      await activeRingSound.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await activeRingSound.unloadAsync();
    } catch {
      /* ignore */
    }
    activeRingSound = null;
    activeRingSoundId = null;
  }
}

/**
 * Loops the selected alarm sound until {@link stopRingAlarmSound} is called.
 * Uses `playsInSilentModeIOS` so iOS hardware mute does not silence the in-app ring.
 */
export async function startRingAlarmSound(rawId?: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const id = rawId ? coerceAlarmSoundId(rawId) : await loadDefaultAlarmSoundId();
  const source = ALARM_SOUND_SOURCES[id];
  if (source == null) {
    return;
  }

  if (activeRingSound && activeRingSoundId === id) {
    try {
      const status = await activeRingSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        return;
      }
    } catch {
      /* restart below */
    }
  }

  await stopRingAlarmSound();

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    /* still try to play */
  }

  try {
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      volume: 1,
      isLooping: true,
    });
    activeRingSound = sound;
    activeRingSoundId = id;
  } catch {
    await stopRingAlarmSound();
  }
}
