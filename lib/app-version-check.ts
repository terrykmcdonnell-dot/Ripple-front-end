import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Remote config shape
// ---------------------------------------------------------------------------

export type VersionPlatformConfig = {
  /** Latest published version string, e.g. "1.2.0". */
  latestVersion: string;
  /**
   * Minimum version that is still supported. Any build older than this gets a
   * non-dismissible "Update Required" modal so the user cannot skip it.
   */
  minVersion: string;
  /** Deep link to the platform store listing. */
  storeUrl: string;
};

export type VersionCheckRemoteConfig = {
  ios: VersionPlatformConfig;
  android: VersionPlatformConfig;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type VersionCheckResult =
  | { status: 'up_to_date' }
  | { status: 'optional_update'; storeUrl: string; latestVersion: string }
  | { status: 'force_update'; storeUrl: string; latestVersion: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compare two semver strings.
 * Returns < 0 if a is older than b, 0 if equal, > 0 if a is newer than b.
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/[^0-9.]/g, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const [aMaj = 0, aMin = 0, aPatch = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPatch = 0] = parse(b);

  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetches the remote version config and compares it against the build version
 * embedded at compile time via `app.json → version`.
 *
 * The remote config is a small JSON file you host at
 * `EXPO_PUBLIC_VERSION_CHECK_URL`.  See `version.json.example` at the project
 * root for the expected shape.
 *
 * Returns:
 *  - `up_to_date`       — nothing to do
 *  - `optional_update`  — a newer version exists; the user can dismiss
 *  - `force_update`     — current build is below `minVersion`; cannot dismiss
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  const url = process.env.EXPO_PUBLIC_VERSION_CHECK_URL;
  if (!url) {
    return { status: 'up_to_date' };
  }

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const platform = Platform.OS as 'ios' | 'android';

  // Only supported on native platforms.
  if (platform !== 'ios' && platform !== 'android') {
    return { status: 'up_to_date' };
  }

  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) {
    return { status: 'up_to_date' };
  }

  const config = (await response.json()) as Partial<VersionCheckRemoteConfig>;
  const platformConfig = config[platform];

  if (!platformConfig?.latestVersion || !platformConfig.minVersion || !platformConfig.storeUrl) {
    return { status: 'up_to_date' };
  }

  const { minVersion, latestVersion, storeUrl } = platformConfig;

  if (compareSemver(currentVersion, minVersion) < 0) {
    return { status: 'force_update', storeUrl, latestVersion };
  }

  if (compareSemver(currentVersion, latestVersion) < 0) {
    return { status: 'optional_update', storeUrl, latestVersion };
  }

  return { status: 'up_to_date' };
}
