import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelAllRippleScheduledNotifications } from '@/lib/cancel-all-app-notifications';
import { clearPendingSignUp } from '@/lib/pending-signup';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';

const TEMPLATE_PACK_IDS_KEY = 'ripple_template_pack_alarm_ids_v1';

/** Best-effort local cleanup after account closure (notifications, caches, device prefs stay). */
export async function clearLocalAccountData(): Promise<void> {
  await Promise.all([
    cancelAllRippleScheduledNotifications(),
    clearPendingSignUp(),
    AsyncStorage.removeItem(TEMPLATE_PACK_IDS_KEY),
  ]);
  invalidateSubscriptionCache();
}
