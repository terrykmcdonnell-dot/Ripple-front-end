import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

const DEFAULT_SENTRY_DSN =
  'https://eeca775da6d8d240fc4a9562fd14e3ca@o4511740912336896.ingest.us.sentry.io/4511749136252928';

function getSentryDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || DEFAULT_SENTRY_DSN;
}

export function isSentryConfigured(): boolean {
  return Platform.OS !== 'web' && !!getSentryDsn();
}

export function initSentry(): void {
  const dsn = getSentryDsn();
  if (!dsn || Platform.OS === 'web') {
    return;
  }

  const slug = Constants.expoConfig?.slug ?? 'ripple-alarm';
  const version = Constants.expoConfig?.version ?? '0.0.0';

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    release: `${slug}@${version}`,
    dist: version,
    sendDefaultPii: true,
    // Mobile replay writes frames to disk (pread/pwrite) and caused Background ANRs on
    // low-memory Android devices — disable until we need it with strict sampling.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enableAutoSessionTracking: false,
    enableLogs: false,
    integrations: (integrations) =>
      integrations.filter(
        (integration) =>
          integration.name !== 'MobileReplay' &&
          integration.name !== 'Replay' &&
          integration.name !== 'Feedback',
      ),
  });
}

/** Dev-only: briefly enables the client so Settings can verify Sentry connectivity. */
export function sendSentryTestError(message: string): void {
  if (!__DEV__ || Platform.OS === 'web' || !getSentryDsn()) {
    return;
  }

  const client = Sentry.getClient();
  if (!client) {
    return;
  }

  const options = client.getOptions();
  const wasEnabled = options.enabled;
  options.enabled = true;
  Sentry.captureException(new Error(message));
  options.enabled = wasEnabled;
}
