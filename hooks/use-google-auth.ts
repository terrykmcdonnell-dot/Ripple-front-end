import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import {
  isLikelyGoogleWebClientId,
  normalizeGoogleOAuthClientId,
} from '@/lib/google-oauth-client';
import { supabase } from '@/lib/supabase';
import { syncUserProfileToTable } from '@/lib/sync-user-profile';

type UseGoogleAuthOptions = {
  /** Upsert `public.users` after a successful Google session (OAuth users use an empty password). */
  syncUsersTable?: boolean;
};

export function useGoogleAuthWithSupabase(options: UseGoogleAuthOptions = {}) {
  const { syncUsersTable = true } = options;
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleConfig = useMemo(
    () => ({
      androidClientId: normalizeGoogleOAuthClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
      iosClientId: normalizeGoogleOAuthClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
      webClientId: normalizeGoogleOAuthClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    }),
    [],
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const { webClientId, iosClientId, androidClientId } = googleConfig;
    if (__DEV__ && webClientId && !isLikelyGoogleWebClientId(webClientId)) {
      console.warn(
        '[Google Sign-In] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID should look like 123456-xxx.apps.googleusercontent.com (Web application client in Google Cloud).',
      );
    }
    if (__DEV__ && webClientId && androidClientId && webClientId === androidClientId) {
      console.warn(
        '[Google Sign-In] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the **Web application** OAuth client, not the Android client ID. Create a separate Web client in Google Cloud.',
      );
    }
    if (!webClientId) {
      return;
    }
    GoogleSignin.configure({
      webClientId,
      ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
      offlineAccess: false,
    });
  }, [googleConfig]);

  const signInWithGoogleNative = useCallback(async () => {
    const { webClientId } = googleConfig;
    if (!webClientId) {
      notifyAuthMessage(
        'Google Sign-In',
        'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Supabase verifies the Google ID token against the Web OAuth client.',
      );
      return;
    }

    setGoogleLoading(true);
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') {
        return;
      }

      let idToken = response.data.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        notifyAuthMessage(
          'Google Sign-In',
          'Google did not return an ID token. Confirm Web Client ID and OAuth clients in Google Cloud Console.',
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        notifyAuthError('Google Sign-In', error);
        return;
      }

      if (syncUsersTable && data.user?.email) {
        const email = data.user.email.trim().toLowerCase();
        const meta = data.user.user_metadata as Record<string, unknown> | undefined;
        const nameFromMeta =
          (typeof meta?.full_name === 'string' && meta.full_name) ||
          (typeof meta?.name === 'string' && meta.name) ||
          email.split('@')[0] ||
          'User';

        const { error: profileError } = await syncUserProfileToTable({
          name: nameFromMeta,
          email,
          password: '',
        });

        if (profileError) {
          notifyAuthError('Google Sign-In', profileError);
          return;
        }
      }

      router.replace('/alarm');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      notifyAuthError('Google Sign-In', err);
    } finally {
      setGoogleLoading(false);
    }
  }, [googleConfig, router, syncUsersTable]);

  const onGooglePress = useCallback(() => {
    if (Platform.OS === 'web') {
      notifyAuthMessage(
        'Google Sign-In',
        'Google Sign-In runs in the iOS/Android app. Use email sign-in on web or install the Ripple app.',
      );
      return;
    }

    if (!googleConfig.webClientId) {
      notifyAuthMessage(
        'Google Sign-In',
        'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Add your Web OAuth client ID from Google Cloud Console.',
      );
      return;
    }

    void signInWithGoogleNative();
  }, [googleConfig.webClientId, signInWithGoogleNative]);

  return { googleLoading, onGooglePress };
}
