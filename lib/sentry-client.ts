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
    enabled: true,
    environment: __DEV__ ? 'development' : 'production',
    release: `${slug}@${version}`,
    dist: version,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
  });
}
