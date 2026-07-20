import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import { ALARM_FIRE_DATA_TYPE } from '@/lib/alarm-notification-constants';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { bundledNotificationSoundFilename } from '@/lib/alarm-sound-files';
import { hasNativeAlarmSoundActive, startNativeAlarmSound, stopNativeAlarmSound } from '@/lib/android-alarm-native-prefs';
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

/**
 * (Re-)starts native STREAM_ALARM playback with full alarm metadata — bypasses the ringer/media
 * volume slider entirely (see `AlarmSoundService.kt`), unlike the expo-av path below it. Safe to
 * call even if native playback is already running: `AlarmSoundService.startPlayback()` stops its
 * own MediaPlayer before restarting, so this is idempotent.
 *
 * Always calling this (rather than trusting the `hasNativeAlarmSoundActive()` flag alone) matters
 * because that flag lives in JS memory: if the JS engine restarts (Fast Refresh in dev, or Android
 * reclaiming the process under memory pressure) while the native foreground service keeps ringing,
 * the flag resets to `false` even though STREAM_ALARM is still genuinely playing. Without a fresh
 * reassert, the caller would fall through to the expo-av path below and layer a second, media-volume
 * sound on top — which is exactly what makes the ring seem to "follow the phone's volume" and go
 * silent when that slider is turned down.
 */
function reassertNativeAlarmSound(parsed: ParsedAlarmFireData, soundId: AlarmSoundId): boolean {
  const fireAtMs = new Date(parsed.fireAt).getTime();
  const alarmIdentifier = `ripple_alarm_foreground_${parsed.alarmId}_${Number.isFinite(fireAtMs) ? fireAtMs : Date.now()}`;
  const alarmPayload = JSON.stringify({
    type: ALARM_FIRE_DATA_TYPE,
    alarmId: parsed.alarmId,
    fireAt: parsed.fireAt,
    label: parsed.label,
    category: parsed.category,
    soundId,
    ...(parsed.categoryId != null ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.categoryIcon ? { categoryIcon: parsed.categoryIcon } : {}),
    ...(parsed.userId != null ? { userId: parsed.userId } : {}),
  });
  return startNativeAlarmSound({
    soundName: bundledNotificationSoundFilename(soundId),
    alarmTitle: `Alarm · ${parsed.label}`,
    alarmBody: 'Ringing',
    alarmIdentifier,
    alarmPayload,
    presentationMode: 'background',
  });
}

/** Stops only the expo-av layer (not native) — used when native playback just took over. */
async function stopJsRingSoundOnly(): Promise<void> {
  clearAutoStopTimer();
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
}

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
 *
 * `alarmMeta` (when available) lets Android always (re-)assert native `STREAM_ALARM` playback —
 * see {@link reassertNativeAlarmSound} — instead of relying solely on an in-memory "is native
 * already active" flag that can go stale. This is the expo-av fallback used on iOS, on web
 * previews, and only on Android when the native module truly is not available.
 */
export async function startRingAlarmSound(
  rawId?: string | null,
  alarmMeta?: ParsedAlarmFireData | null,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
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

  if (Platform.OS === 'android') {
    if (alarmMeta && reassertNativeAlarmSound(alarmMeta, coerced)) {
      // Native STREAM_ALARM now owns playback — drop any expo-av layer we may have
      // started earlier (e.g. before metadata became available) so it never doubles up.
      void stopJsRingSoundOnly();
      return true;
    }
    if (!alarmMeta && hasNativeAlarmSoundActive()) {
      // No metadata to (re)assert with on this call, but native already reports active.
      return true;
    }
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
