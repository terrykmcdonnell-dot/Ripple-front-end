import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import { resolveAlarmSoundForUser } from '@/lib/alarm-sound-access';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import { coerceAlarmSoundId, loadDefaultAlarmSoundId, loadDefaultVolumePercent } from '@/lib/settings-preferences';
import { fetchIsSubscriberFresh } from '@/lib/subscription-access';
import { applyAlarmVolumePreferenceToDevice } from '@/lib/alarm-system-volume';

/** Bundled WAVs (same files as `app.json` → expo-notifications `sounds`). */
const ALARM_SOUND_SOURCES: Record<AlarmSoundId, number> = {
  'gentle-rise': require('../assets/sounds/gentle_rise.wav'),
  'morning-glow': require('../assets/sounds/morning_glow.wav'),
  'classic-bell': require('../assets/sounds/classic_bell.wav'),
  'digital-beep': require('../assets/sounds/digital_beep.wav'),
  'soft-piano': require('../assets/sounds/soft_piano.wav'),
  'nature-birds': require('../assets/sounds/nature_birds.wav'),
  'sunrise-chime': require('../assets/sounds/sunrise_chime.wav'),
  'crystal-ding': require('../assets/sounds/crystal_ding.wav'),
  'ocean-waves': require('../assets/sounds/ocean_waves.wav'),
  'warm-strings': require('../assets/sounds/warm_strings.wav'),
  'alert-pulse': require('../assets/sounds/alert_pulse.wav'),
  'zen-bowl': require('../assets/sounds/zen_bowl.wav'),
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
export async function previewAlarmSoundId(
  rawId: string,
  volumePercent = 100,
  isSubscriber?: boolean,
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const coerced = coerceAlarmSoundId(rawId);
  const subscriber = isSubscriber ?? (await fetchIsSubscriberFresh());
  const id = resolveAlarmSoundForUser(coerced, subscriber);
  const source = ALARM_SOUND_SOURCES[id];
  if (source == null) {
    return;
  }

  const volume = Math.max(0, Math.min(1, Math.round(volumePercent) / 100));

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
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume });
    lastPreview = sound;

    lastPreviewTimeout = setTimeout(() => {
      lastPreviewTimeout = null;
      void stopAlarmSoundPreview();
    }, PREVIEW_MS);
  } catch {
    await stopAlarmSoundPreview();
  }
}

/** Preview the user's default alarm sound at a chosen volume (Settings volume picker). */
export async function previewDefaultAlarmSoundAtVolume(volumePercent: number): Promise<boolean> {
  let applied = true;
  if (Platform.OS !== 'web') {
    applied = await applyAlarmVolumePreferenceToDevice(volumePercent);
  }
  const id = await loadDefaultAlarmSoundId();
  await previewAlarmSoundId(id, volumePercent, await fetchIsSubscriberFresh());
  return applied;
}

/** Resolve the volume percent used for in-app alarm sound previews. */
export async function resolveAlarmPreviewVolumePercent(
  overridePercent?: number,
): Promise<number> {
  if (overridePercent != null) {
    return Math.max(0, Math.min(100, Math.round(overridePercent)));
  }
  return loadDefaultVolumePercent();
}
