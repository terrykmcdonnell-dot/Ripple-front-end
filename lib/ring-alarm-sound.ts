import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import { hasNativeAlarmSoundActive, stopNativeAlarmSound } from '@/lib/android-alarm-native-prefs';
import type { AlarmSoundId } from '@/lib/settings-preferences';
import { coerceAlarmSoundId, loadDefaultAlarmSoundId, loadDefaultVolumePercent } from '@/lib/settings-preferences';

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

/** Maximum ring duration before auto-stop even if user doesn't interact (5 minutes). */
const MAX_RING_DURATION_MS = 5 * 60 * 1_000;

let activeRingSound: Audio.Sound | null = null;
let activeRingSoundId: AlarmSoundId | null = null;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Monotonically-increasing generation counter.
 *
 * Why this exists — race condition:
 *   1. Alarm fires → AlarmRingScreen mounts → startRingAlarmSound() begins awaiting createAsync().
 *   2. User presses Snooze/Dismiss very fast → stopRingAlarmSound() is called.
 *   3. At step 2, activeRingSound is still null (createAsync hasn't resolved) → stop is a no-op.
 *   4. createAsync resolves → activeRingSound is set, sound starts playing forever.
 *
 * Fix: stopRingAlarmSound() increments _soundGen synchronously (before any await).
 * startRingAlarmSound() captures its own generation at the start and checks it after every
 * await. If the generation changed, a stop won the race — the freshly-loaded sound is
 * discarded immediately instead of being stored in activeRingSound.
 */
let _soundGen = 0;

function clearAutoStopTimer() {
  if (autoStopTimer != null) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

export async function stopRingAlarmSound(): Promise<void> {
  // Bump generation first — synchronous, so any concurrent startRingAlarmSound()
  // that checks after its next await will see the mismatch and abort.
  _soundGen++;

  clearAutoStopTimer();
  stopNativeAlarmSound();

  // Capture and clear the ref before awaiting so a concurrent start() cannot
  // accidentally see and re-use a sound we are in the middle of stopping.
  const s = activeRingSound;
  activeRingSound = null;
  activeRingSoundId = null;

  if (s) {
    try {
      await s.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await s.unloadAsync();
    } catch {
      /* ignore */
    }
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
 * or the 5-minute auto-stop fires.
 *
 * - `playsInSilentModeIOS: true` — iOS hardware mute switch is overridden.
 * - `staysActiveInBackground: true` — audio continues while app is backgrounded
 *   (needed for lock-screen ring). Auto-stop prevents infinite background play.
 */
export async function startRingAlarmSound(rawId?: string | null): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (hasNativeAlarmSoundActive()) {
    // Android native playback uses USAGE_ALARM, so it still rings when media
    // volume is muted. Keep it as the primary alarm audio until user action.
    return true;
  }

  // Capture our generation. Every await below re-checks it. If stopRingAlarmSound()
  // is called while we are loading, it increments _soundGen and we abort.
  const myGen = ++_soundGen;

  // Alarm playback must not wait on network/subscription checks; scheduled
  // payloads are resolved up front, and the priority here is immediate sound.
  const coerced = rawId ? coerceAlarmSoundId(rawId) : await loadDefaultAlarmSoundId();
  if (myGen !== _soundGen) {
    return false;
  }

  const volumePercent = await loadDefaultVolumePercent();
  if (myGen !== _soundGen) {
    return false;
  }
  const volume = Math.max(0, Math.min(1, volumePercent / 100));

  const source = ALARM_SOUND_SOURCES[coerced];
  if (source == null) {
    return false;
  }

  // Already playing the same sound — refresh auto-stop timer and apply latest volume.
  if (activeRingSound && activeRingSoundId === coerced) {
    try {
      const status = await activeRingSound.getStatusAsync();
      if (myGen !== _soundGen) {
        return false; // stop() called between the getStatus await and here → abort
      }
      if (status.isLoaded && status.isPlaying) {
        try {
          await activeRingSound.setVolumeAsync(volume);
        } catch {
          /* ignore */
        }
        clearAutoStopTimer();
        autoStopTimer = setTimeout(() => void stopRingAlarmSound(), MAX_RING_DURATION_MS);
        return true;
      }
    } catch {
      if (myGen !== _soundGen) return false;
      /* fall through to reload below */
    }
  }

  // Stop any previously-playing sound without bumping _soundGen (we don't want
  // to cancel ourselves — only stopRingAlarmSound() should do that).
  clearAutoStopTimer();
  const prev = activeRingSound;
  activeRingSound = null;
  activeRingSoundId = null;
  if (prev) {
    try {
      await prev.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await prev.unloadAsync();
    } catch {
      /* ignore */
    }
  }
  if (myGen !== _soundGen) {
    return false; // stop() was called while we were unloading the previous sound → abort
  }

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

  if (myGen !== _soundGen) {
    return false; // stop() called while we were configuring the audio session → abort
  }

  try {
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      volume,
      isLooping: true,
    });

    if (myGen !== _soundGen) {
      // stop() was called while createAsync was running — discard the freshly
      // loaded sound immediately instead of storing it in activeRingSound.
      try {
        await sound.stopAsync();
      } catch {
        /* ignore */
      }
      try {
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
      return false;
    }

    activeRingSound = sound;
    activeRingSoundId = coerced;

    // Hard stop after 5 minutes regardless of user interaction.
    autoStopTimer = setTimeout(() => void stopRingAlarmSound(), MAX_RING_DURATION_MS);
    return true;
  } catch {
    // createAsync failed — release audio session if we are still the active load.
    if (myGen === _soundGen) {
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
    return false;
  }
}
