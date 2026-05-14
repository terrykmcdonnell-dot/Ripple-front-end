import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import type { AlarmSoundId } from '@/lib/settings-preferences';
import { coerceAlarmSoundId } from '@/lib/settings-preferences';

/** Bundled WAVs (same files as `app.json` → expo-notifications `sounds`). */
const ALARM_SOUND_SOURCES: Record<AlarmSoundId, number> = {
  'gentle-rise': require('../assets/sounds/gentle_rise.wav'),
  'morning-glow': require('../assets/sounds/morning_glow.wav'),
  'classic-bell': require('../assets/sounds/classic_bell.wav'),
  'digital-beep': require('../assets/sounds/digital_beep.wav'),
  'soft-piano': require('../assets/sounds/soft_piano.wav'),
  'nature-birds': require('../assets/sounds/nature_birds.wav'),
};

const PREVIEW_MS = 4500;

let lastPreview: Audio.Sound | null = null;
let lastPreviewTimeout: ReturnType<typeof setTimeout> | null = null;

export async function stopAlarmSoundPreview(): Promise<void> {
  if (lastPreviewTimeout != null) {
    clearTimeout(lastPreviewTimeout);
    lastPreviewTimeout = null;
  }
  if (lastPreview) {
    try {
      await lastPreview.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await lastPreview.unloadAsync();
    } catch {
      /* ignore */
    }
    lastPreview = null;
  }
}

/**
 * Plays a short preview of the bundled alarm sound (native only).
 * Safe to call repeatedly; stops any in-flight preview first.
 */
export async function previewAlarmSoundId(rawId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const id = coerceAlarmSoundId(rawId);
  const source = ALARM_SOUND_SOURCES[id];
  if (source == null) {
    return;
  }

  await stopAlarmSoundPreview();

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    /* still try to play */
  }

  try {
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 1 });
    lastPreview = sound;

    lastPreviewTimeout = setTimeout(() => {
      lastPreviewTimeout = null;
      void stopAlarmSoundPreview();
    }, PREVIEW_MS);
  } catch {
    await stopAlarmSoundPreview();
  }
}
