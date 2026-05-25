import type { AlarmListItem } from '@/lib/alarm-format';

/** Row tapped on the list — hydrates edit without blocking on GET until unmount. */
let stashForEdit: AlarmListItem | undefined;

/** Call immediately before navigating to `/alarm-edit` with `?id=`. */
export function stashAlarmForEdit(alarm: AlarmListItem): void {
  stashForEdit = alarm;
}

/** Returns the stashed row when `id` matches (does not clear; safe for Strict Mode double effects). */
export function peekStashedAlarmForEditMatch(id: number): AlarmListItem | undefined {
  return stashForEdit?.id === id ? stashForEdit : undefined;
}

/** @deprecated Use {@link peekStashedAlarmForEditMatch}. */
export const takeStashedAlarmForEditMatch = peekStashedAlarmForEditMatch;

/** Clears stash when leaving the edit screen so a later open always re-stashes from the list. */
export function clearStashedAlarmForEdit(): void {
  stashForEdit = undefined;
}
