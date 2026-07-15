import { Platform } from 'react-native';

import { fetchAlarmForEdit } from '@/lib/alarm-api';
import { withDeadline } from '@/lib/async-deadline';
import type { ParsedAlarmFireData } from '@/lib/alarm-fire-notification-data';
import { fetchCurrentUserRowId } from '@/lib/users-table';

/**
 * The backend GET path retries for up to a minute on flaky networks
 * (see RIPPLE_GET_TOTAL_TIMEOUT_MS). That is fine for background syncs but
 * unacceptable here: this check gates whether an alarm rings, so it must
 * resolve almost instantly. Bounded tightly and fails OPEN (allows delivery)
 * on timeout so a real, still-enabled alarm never fails to ring because the
 * network was slow or unreachable.
 */
const DELIVERY_CHECK_TIMEOUT_MS = 4_000;

/**
 * Returns false when the alarm was deleted or disabled so stale OS notifications
 * (scheduled before the user turned alarms off) do not ring.
 */
export async function isAlarmFireDeliveryAllowed(parsed: ParsedAlarmFireData): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    return await withDeadline(
      checkAlarmFireDeliveryAllowed(parsed),
      DELIVERY_CHECK_TIMEOUT_MS,
      'Alarm fire delivery check',
    );
  } catch {
    // Could not verify in time — allow delivery so a real enabled alarm still
    // rings promptly offline or on a slow network.
    return true;
  }
}

async function checkAlarmFireDeliveryAllowed(parsed: ParsedAlarmFireData): Promise<boolean> {
  let userId = parsed.userId;
  if (userId == null) {
    const { id, error } = await fetchCurrentUserRowId();
    if (error || id == null) {
      return true;
    }
    userId = id;
  }

  const row = await fetchAlarmForEdit(parsed.alarmId, userId);
  if (!row) {
    return false;
  }
  return row.isEnabled;
}
