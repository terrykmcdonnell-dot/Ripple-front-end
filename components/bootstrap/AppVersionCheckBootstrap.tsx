import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { checkAppVersion, type VersionCheckResult } from '@/lib/app-version-check';

/**
 * Runs a version check on every cold launch (inside the root layout, so it
 * fires before the user reaches any screen).
 *
 * - optional_update → dismissible modal; user can tap "Later" to skip.
 * - force_update    → non-dismissible modal; user must open the store to continue.
 *
 * Network failures are swallowed silently so a bad connection never blocks
 * the user from opening the app.
 */
export function AppVersionCheckBootstrap() {
  const [result, setResult] = useState<VersionCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await checkAppVersion();
        if (r.status !== 'up_to_date') {
          setResult(r);
        }
      } catch {
        // Network or parse error — skip silently; never block app usage.
      }
    })();
  }, []);

  if (!result || result.status === 'up_to_date' || dismissed) {
    return null;
  }

  const isForced = result.status === 'force_update';
  const { storeUrl, latestVersion } = result;
  const platformLabel = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  const openStore = () => {
    void Linking.openURL(storeUrl);
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
                onPress: () => setDismissed(true),
              },
              {
                label: 'Update',
                variant: 'primary',
                onPress: () => {
                  setDismissed(true);
                  openStore();
                },
              },
            ]
      }
      // Force-update modals cannot be dismissed by pressing outside or back.
      onRequestClose={isForced ? undefined : () => setDismissed(true)}
    />
  );
}
