import { Linking, Platform } from 'react-native';

import { checkAppVersion } from '@/lib/app-version-check';

export type AppUpdateCheckOutcome =
  | { kind: 'up_to_date' }
  | { kind: 'update_available'; storeUrl: string; latestVersion: string; forced: boolean }
  | { kind: 'unavailable' };

/** Checks remote version.json and opens the store when an update is available. */
export async function checkForAppUpdateAndOpenStore(): Promise<AppUpdateCheckOutcome> {
  if (Platform.OS === 'web') {
    return { kind: 'unavailable' };
  }

  try {
    const result = await checkAppVersion();
    if (result.status === 'up_to_date') {
      return { kind: 'up_to_date' };
    }
    await Linking.openURL(result.storeUrl);
    return {
      kind: 'update_available',
      storeUrl: result.storeUrl,
      latestVersion: result.latestVersion,
      forced: result.status === 'force_update',
    };
  } catch {
    return { kind: 'unavailable' };
  }
}
