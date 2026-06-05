import {
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';

import { ALARM_FIRE_DATA_TYPE } from '@/lib/alarm-notification-constants';
import { handleAlarmFireNotificationResponse } from '@/lib/alarm-notification-response';

let initialAlarmLaunchHandled = false;
let consumeInFlight: Promise<boolean> | null = null;

function isAlarmFireResponseData(data: Record<string, unknown> | undefined): boolean {
  return data?.type === ALARM_FIRE_DATA_TYPE;
}

async function consumeInitialAlarmFireResponseInner(): Promise<boolean> {
  if (initialAlarmLaunchHandled) {
    return true;
  }

  try {
    const last = await getLastNotificationResponseAsync();
    if (!last) {
      return false;
    }
    const data = last.notification.request.content.data as Record<string, unknown> | undefined;
    if (!isAlarmFireResponseData(data)) {
      return false;
    }

    initialAlarmLaunchHandled = true;
    await handleAlarmFireNotificationResponse(last);
    await clearLastNotificationResponseAsync().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * A full-screen intent (Android) or lock-screen notification tap (iOS/Android) can cold-start
 * the app before `/alarm` mounts. Consume the pending response once and open the ring UI so
 * `app/index.tsx` does not replace it.
 */
export function consumeInitialAlarmFireResponse(): Promise<boolean> {
  if (initialAlarmLaunchHandled) {
    return Promise.resolve(true);
  }
  if (!consumeInFlight) {
    consumeInFlight = consumeInitialAlarmFireResponseInner().finally(() => {
      consumeInFlight = null;
    });
  }
  return consumeInFlight;
}
