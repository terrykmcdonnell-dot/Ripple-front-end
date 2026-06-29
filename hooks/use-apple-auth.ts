import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { supabase } from '@/lib/supabase';
import { deriveProfileNameFromAuthUser, syncUserProfileToTable } from '@/lib/sync-user-profile';

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string {
  if (!fullName) {
    return '';
  }
  const given = fullName.givenName?.trim() ?? '';
  const family = fullName.familyName?.trim() ?? '';
  return [given, family].filter(Boolean).join(' ') || '';
}

type UseAppleAuthOptions = {
  /** Upsert `public.users` after a successful Apple session (OAuth users use an empty password). */
  syncUsersTable?: boolean;
};

export function useAppleAuthWithSupabase(options: UseAppleAuthOptions = {}) {
  const { syncUsersTable = true } = options;
  const router = useRouter();
  const [appleLoading, setAppleLoading] = useState(false);

  const signInWithAppleNative = useCallback(async () => {
    setAppleLoading(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        notifyAuthMessage(
          'Sign in with Apple',
          'Sign in with Apple is not available on this device. Use email sign-in or try again later.',
        );
        return;
      }

      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
        if (code === 'ERR_REQUEST_CANCELED') {
          return;
        }
        throw err;
      }

      const idToken = credential.identityToken;
      if (!idToken) {
        notifyAuthMessage(
          'Sign in with Apple',
          'Apple did not return an identity token. Rebuild the app with the Apple Sign In capability enabled.',
        );
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
      });

      if (error) {
        notifyAuthError('Sign in with Apple', error);
        return;
      }

      const appleDisplayName = formatAppleFullName(credential.fullName);
      if (appleDisplayName) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { full_name: appleDisplayName, name: appleDisplayName },
        });
        if (metaError) {
          notifyAuthError('Sign in with Apple', metaError);
          return;
        }
      }

      if (syncUsersTable) {
        const { data: refreshed, error: refreshError } = await supabase.auth.getUser();
        if (refreshError) {
          notifyAuthError('Sign in with Apple', refreshError);
          await supabase.auth.signOut();
          return;
        }
        const userForProfile = refreshed.user;
        if (!userForProfile) {
          notifyAuthMessage('Sign in with Apple', 'Could not load your account after sign-in.');
          await supabase.auth.signOut();
          return;
        }
        const email = userForProfile.email?.trim().toLowerCase();
        if (!email) {
          notifyAuthMessage(
            'Sign in with Apple',
            'Sign-in did not return an email. Try Apple again or use email sign-in.',
          );
          await supabase.auth.signOut();
          return;
        }

        const { error: profileError } = await syncUserProfileToTable({
          name: deriveProfileNameFromAuthUser(userForProfile),
          email,
          password: '',
        });

        if (profileError) {
          notifyAuthError('Sign in with Apple', profileError);
          await supabase.auth.signOut();
          return;
        }
      }

      router.replace('/alarm');
    } catch (err: unknown) {
      notifyAuthError('Sign in with Apple', err);
    } finally {
      setAppleLoading(false);
    }
  }, [router, syncUsersTable]);

  const onApplePress = useCallback(() => {
    if (Platform.OS !== 'ios') {
      notifyAuthMessage(
        'Sign in with Apple',
        'Sign in with Apple runs on iOS. Use email or Google in this app on Android, or install on iPhone.',
      );
      return;
    }

    void signInWithAppleNative();
  }, [signInWithAppleNative]);

  return { appleLoading, onApplePress };
}
