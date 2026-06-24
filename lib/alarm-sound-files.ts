import type { AlarmSoundId } from '@/lib/settings-preferences';

/**
 * Bundled notification filenames registered via expo-notifications plugin (`app.json` → `sounds`).
 * Pass ONLY this basename to `scheduleNotificationAsync` / channel `sound` per Expo docs.
 */
const NOTIFICATION_SOUND_FILES: Record<AlarmSoundId, string> = {
  'gentle-rise': 'gentle_rise.wav',
  'morning-glow': 'morning_glow.wav',
  'classic-bell': 'classic_bell.wav',
  'digital-beep': 'digital_beep.wav',
  'soft-piano': 'soft_piano.wav',
  'nature-birds': 'nature_birds.wav',
  'sunrise-chime': 'sunrise_chime.wav',
  'crystal-ding': 'crystal_ding.wav',
  'ocean-waves': 'ocean_waves.wav',
  'warm-strings': 'warm_strings.wav',
  'alert-pulse': 'alert_pulse.wav',
  'zen-bowl': 'zen_bowl.wav',
};

export function bundledNotificationSoundFilename(id: AlarmSoundId): string {
  return NOTIFICATION_SOUND_FILES[id];
}
