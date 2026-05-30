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

/** Maximum ring duration before auto-stop even if user doesn't interact (90 seconds). */
const MAX_RING_DURATION_MS = 90_000;

let activeRingSound: Audio.Sound | null = null;
let activeRingSoundId: AlarmSoundId | null = null;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoStopTimer() {
  if (autoStopTimer != null) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

export async function stopRingAlarmSound(): Promise<void> {
  clearAutoStopTimer();
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

  // Release the audio session so other apps can use audio normally again.
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Loops the selected alarm sound until {@link stopRingAlarmSound} is called
 * or the 90-second auto-stop fires.
 *
 * - `playsInSilentModeIOS: true` — iOS hardware mute switch is overridden.
 * - `staysActiveInBackground: true` — audio continues while app is backgrounded
 *   (needed for lock-screen ring). Auto-stop prevents infinite background play.
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

  // Already playing the same sound — restart auto-stop timer but don't reload.
  if (activeRingSound && activeRingSoundId === id) {
    try {
      const status = await activeRingSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        clearAutoStopTimer();
        autoStopTimer = setTimeout(() => void stopRingAlarmSound(), MAX_RING_DURATION_MS);
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

    // Hard stop after 90 seconds regardless of user interaction.
    autoStopTimer = setTimeout(() => void stopRingAlarmSound(), MAX_RING_DURATION_MS);
  } catch {
    await stopRingAlarmSound();
  }
}
