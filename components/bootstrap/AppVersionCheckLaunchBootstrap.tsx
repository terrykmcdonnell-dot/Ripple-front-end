import { useEffect } from 'react';

import { subscribeAppLaunchVersionChecks } from '@/lib/app-version-check-session';

/** Starts version checks on cold launch and whenever the app returns to foreground. */
export function AppVersionCheckLaunchBootstrap() {
  useEffect(() => subscribeAppLaunchVersionChecks(), []);
  return null;
}
