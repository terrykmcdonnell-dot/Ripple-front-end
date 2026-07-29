import type { AuthResponse } from '@supabase/supabase-js';

import { createAccountViaBackend } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';

export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'This email is already registered. Sign in or use a different email.';

/** Supabase returns an empty `identities` array when the email is already registered. */
export function isSignUpForExistingUser(data: AuthResponse['data'] | null | undefined): boolean {
  const user = data?.user;
  if (!user) {
    return false;
  }
  return !user.identities || user.identities.length === 0;
}

export type EmailSignUpResult =
  | { kind: 'existing_user' }
  | { kind: 'session'; session: NonNullable<AuthResponse['data']>['session'] }
  | { kind: 'verify_email' }
  | { kind: 'error'; error: unknown };

/**
 * Email/password sign-up via Supabase Auth.
 * Detects duplicate emails before sending the user to OTP verification.
 */
export async function startEmailSignUp(input: {
  email: string;
  password: string;
  name: string;
}): Promise<EmailSignUpResult> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { name: input.name.trim() },
    },
  });

  if (error) {
    return { kind: 'error', error };
  }

  if (isSignUpForExistingUser(data)) {
    return { kind: 'existing_user' };
  }

  if (data.session) {
    return { kind: 'session', session: data.session };
  }

  return { kind: 'verify_email' };
}
