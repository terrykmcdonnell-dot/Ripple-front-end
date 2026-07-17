import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { IosScheduledNotificationLimitModal } from '@/components/alarms/IosScheduledNotificationLimitModal';
import {
  getIosScheduledNotificationLimitWarning,
  markIosScheduledNotificationLimitWarningShown,
  subscribeIosScheduledNotificationLimitCheck,
} from '@/lib/ios-scheduled-notification-limit';

/**
 * iOS: one-time warning when scheduled local notifications exceed ~55
 * (system limit is ~64).
 */
export function IosScheduledNotificationLimitBootstrap() {
  const [visible, setVisible] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);

  const runCheck = useCallback(async () => {
    const { shouldShow, count } = await getIosScheduledNotificationLimitWarning();
    if (shouldShow) {
      setScheduledCount(count);
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    void runCheck();

    const unsubscribe = subscribeIosScheduledNotificationLimitCheck(() => {
      void runCheck();
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runCheck();
      }
    });

    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [runCheck]);

  const dismiss = () => {
    void markIosScheduledNotificationLimitWarningShown();
    setVisible(false);
  };

  return (
    <IosScheduledNotificationLimitModal
      visible={visible}
      scheduledCount={scheduledCount}
      onDismiss={dismiss}
    />
  );
}
