import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import {
  dismissAppVersionCheckPrompt,
  getAppVersionCheckSnapshot,
  subscribeAppVersionCheck,
} from '@/lib/app-version-check-session';

type AppVersionCheckPromptProps = {
  /** When false, defer showing the modal (e.g. while alarms list is loading). */
  enabled: boolean;
};

/** Update modal — mount on the alarms screen after content is ready. */
export function AppVersionCheckPrompt({ enabled }: AppVersionCheckPromptProps) {
  const snapshot = useSyncExternalStore(
    subscribeAppVersionCheck,
    getAppVersionCheckSnapshot,
    getAppVersionCheckSnapshot,
  );

  const result = snapshot.result;
  if (!enabled || snapshot.dismissed || !result || result.status === 'up_to_date') {
    return null;
  }

  const isForced = result.status === 'force_update';
  const { storeUrl, latestVersion } = result;
  const platformLabel = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  const openStore = () => {
    void Linking.openURL(storeUrl);
  };

  const dismissOptional = () => {
    dismissAppVersionCheckPrompt();
  };

  return (
    <AppConfirmModal
      visible
      title={isForced ? 'Update Required' : 'Update Available'}
      body={
        isForced
          ? `This version of Ripple is no longer supported. Please update to version ${latestVersion} from the ${platformLabel} to continue.`
          : `Ripple ${latestVersion} is now available on the ${platformLabel} with new features and improvements.`
      }
      actions={
        isForced
          ? [
              {
                label: `Open ${platformLabel}`,
                variant: 'primary',
                onPress: openStore,
              },
            ]
          : [
              {
                label: 'Later',
                variant: 'secondary',
                onPress: dismissOptional,
              },
              {
                label: 'Update',
                variant: 'primary',
                onPress: () => {
                  dismissOptional();
                  openStore();
                },
              },
            ]
      }
      onRequestClose={isForced ? undefined : dismissOptional}
    />
  );
}
