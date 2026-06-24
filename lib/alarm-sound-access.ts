import type { AlarmSoundId } from '@/lib/settings-preferences';
import { limitsApply } from '@/lib/subscription-access';

/** Free-tier alarm sounds — always available. */
export const FREE_ALARM_SOUND_IDS = [
  'gentle-rise',
  'morning-glow',
  'classic-bell',
  'digital-beep',
  'soft-piano',
  'nature-birds',
] as const satisfies readonly AlarmSoundId[];

/** Premium alarm sounds — Ripple Pro on mobile builds with RevenueCat configured. */
export const PRO_ALARM_SOUND_IDS = [
  'sunrise-chime',
  'crystal-ding',
  'ocean-waves',
  'warm-strings',
  'alert-pulse',
  'zen-bowl',
] as const satisfies readonly AlarmSoundId[];

export const FREE_DEFAULT_ALARM_SOUND_ID: AlarmSoundId = 'gentle-rise';

const PRO_SOUND_SET = new Set<string>(PRO_ALARM_SOUND_IDS);

export function isProAlarmSound(id: string): boolean {
  return PRO_SOUND_SET.has(id);
}

/** Whether the user may select or hear this sound (preview, ring, schedule). */
export function canUseAlarmSound(id: AlarmSoundId, isSubscriber: boolean): boolean {
  if (!isProAlarmSound(id)) {
    return true;
  }
  return !limitsApply(isSubscriber);
}

/**
 * Returns the requested sound when allowed; otherwise the free default.
 * Used at playback/scheduling so expired Pro subscriptions fall back gracefully.
 */
export function resolveAlarmSoundForUser(id: AlarmSoundId, isSubscriber: boolean): AlarmSoundId {
  return canUseAlarmSound(id, isSubscriber) ? id : FREE_DEFAULT_ALARM_SOUND_ID;
}

export function isAlarmSoundLocked(id: AlarmSoundId, limitsApplyToUser: boolean): boolean {
  return limitsApplyToUser && isProAlarmSound(id);
}
