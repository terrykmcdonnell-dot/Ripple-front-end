import type { AlarmListItem } from '@/lib/alarm-format';

/** Row tapped on the list — primary stash for edit hydration without another GET. */
let stashPrimary: AlarmListItem | undefined;
/**
 * Matches `stashPrimary` (React Strict Mode runs layout twice; consume once per copy).
 */
let stashTwin: AlarmListItem | undefined;

/** Call immediately before navigating to `/alarm-edit` with `?id=`. */
export function stashAlarmForEdit(alarm: AlarmListItem): void {
  stashPrimary = alarm;
  stashTwin = alarm;
}

/**
 * If stash matches `id`, returns one copy for this hydration pass (`primary` then `twin`).
 * Opening a row from the list resets both slots via {@link stashAlarmForEdit}.
 */
export function takeStashedAlarmForEditMatch(id: number): AlarmListItem | undefined {
  if (stashPrimary?.id === id) {
    const alarm = stashPrimary;
    stashPrimary = undefined;
    return alarm;
  }
  if (stashTwin?.id === id) {
    const alarm = stashTwin;
    stashTwin = undefined;
    return alarm;
  }
  return undefined;
}
