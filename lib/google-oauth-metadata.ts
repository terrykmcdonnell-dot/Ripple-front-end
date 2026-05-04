import Constants from 'expo-constants';

/**
 * Paths referenced when configuring Google OAuth redirect URIs for Expo apps.
 * See GOOGLE_OAUTH_SETUP.md — register these under the correct OAuth client type in Google Cloud Console.
 */

export function getExpoExtraRouter(): { owner?: string; slug?: string } {
  const extra = Constants.expoConfig?.extra as { router?: unknown } | undefined;
  const router = extra?.router;
  return router && typeof router === 'object' ? (router as { owner?: string; slug?: string }) : {};
}

/** Resolved from app config (`app.json` / `app.config`) — defaults match repo metadata */
export function getExpoProjectLabels(): { owner: string; slug: string; scheme: string } {
  const schemeRaw = Constants.expoConfig?.scheme;
  const scheme = typeof schemeRaw === 'string' ? schemeRaw : 'alarmapp';
  const router = getExpoExtraRouter();
  const owner =
    (typeof Constants.expoConfig?.owner === 'string' && Constants.expoConfig.owner) ||
    (typeof router.owner === 'string' && router.owner) ||
    'terrykm';
  const slug =
    (typeof Constants.expoConfig?.slug === 'string' && Constants.expoConfig.slug) ||
    (typeof router.slug === 'string' && router.slug) ||
    'repple-alarm';
  return { owner, slug, scheme };
}   

/**
 * Typical redirect URIs for a **Web application** OAuth client (e.g. SPA or legacy browser OAuth flows).
 * Native sign-in uses `@react-native-google-signin/google-signin` — see GOOGLE_OAUTH_SETUP.md.
 */
export function getSuggestedGoogleCloudWebRedirectUriCandidates(): readonly string[] {
  const { owner, slug } = getExpoProjectLabels();
  const proxyBase = `https://auth.expo.io/@${owner}/${slug}`;
  return [
    proxyBase,
    `${proxyBase}/--/oauthredirect`,
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
  ];
}
