import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { syncUserProfileToTable } from '@/lib/sync-user-profile';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

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
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    }),
    [],
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: googleConfig.androidClientId,
    iosClientId: googleConfig.iosClientId,
    webClientId: googleConfig.webClientId,
  });

  useEffect(() => {
    const completeGoogleSignIn = async () => {
      if (response?.type !== 'success') {
        return;
      }

      const idToken =
        response.authentication?.idToken ??
        (typeof response.params?.id_token === 'string' ? response.params.id_token : undefined);
      const accessToken = response.authentication?.accessToken;

      if (!idToken) {
        notifyAuthMessage('Google Sign-In', 'Google did not return a sign-in token. Try again.');
        return;
      }

      setGoogleLoading(true);
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        ...(accessToken ? { access_token: accessToken } : {}),
      });
      setGoogleLoading(false);

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
    };

    void completeGoogleSignIn();
  }, [response, router, syncUsersTable]);

  useEffect(() => {
    if (response?.type === 'dismiss' || response?.type === 'cancel' || response?.type === 'error') {
      setGoogleLoading(false);
    }
  }, [response]);

  const onGooglePress = useCallback(() => {
    const activeClientId =
      Platform.OS === 'web'
        ? googleConfig.webClientId
        : Platform.OS === 'ios'
          ? googleConfig.iosClientId
          : googleConfig.androidClientId;

    if (!activeClientId) {
      notifyAuthMessage('Google Sign-In', `Google sign-in is not configured for ${Platform.OS}. Check EXPO_PUBLIC_GOOGLE_* in .env.`);
      return;
    }
    if (!request) {
      notifyAuthMessage('Google Sign-In', 'Google sign-in is still loading. Try again in a moment.');
      return;
    }

    setGoogleLoading(true);
    void promptAsync();
  }, [googleConfig.androidClientId, googleConfig.iosClientId, googleConfig.webClientId, promptAsync, request]);

  return { googleLoading, onGooglePress };
}
