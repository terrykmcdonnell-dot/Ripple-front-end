import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { checkAppVersion, type VersionCheckResult } from '@/lib/app-version-check';
import { isMainTabPathname } from '@/lib/main-tab-navigation';
import { supabase } from '@/lib/supabase';

/** One version check per app session — first authenticated main-tab visit. */
let sessionVersionCheckStarted = false;
let sessionVersionCheckResult: VersionCheckResult | null = null;
let sessionVersionCheckDismissed = false;

/**
 * Prompts for app updates on authenticated main tabs (alarms first), not on
 * sign-in or other auth flows.
 *
 * - optional_update → dismissible modal; user can tap "Later" to skip.
 * - force_update    → non-dismissible modal; user must open the store to continue.
 *
 * Network failures are swallowed silently so a bad connection never blocks
 * the user from opening the app.
 */
export function AppVersionCheckBootstrap() {
  const pathname = usePathname();
  const onMainTab = isMainTabPathname(pathname);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [result, setResult] = useState<VersionCheckResult | null>(sessionVersionCheckResult);
  const [dismissed, setDismissed] = useState(sessionVersionCheckDismissed);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setHasSession(!!session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setHasSession(!!session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!onMainTab || !hasSession || sessionVersionCheckStarted) {
      return;
    }
    sessionVersionCheckStarted = true;

    void (async () => {
      try {
        const r = await checkAppVersion();
        if (r.status !== 'up_to_date') {
          sessionVersionCheckResult = r;
          setResult(r);
        }
      } catch {
        // Network or parse error — skip silently; never block app usage.
      }
    })();
  }, [onMainTab, hasSession]);

  if (!onMainTab || !hasSession || !result || result.status === 'up_to_date' || dismissed) {
    return null;
  }

  const isForced = result.status === 'force_update';
  const { storeUrl, latestVersion } = result;
  const platformLabel = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  const openStore = () => {
    void Linking.openURL(storeUrl);
  };

  const dismissOptional = () => {
    sessionVersionCheckDismissed = true;
    setDismissed(true);
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
      // Force-update modals cannot be dismissed by pressing outside or back.
      onRequestClose={isForced ? undefined : dismissOptional}
    />
  );
}
