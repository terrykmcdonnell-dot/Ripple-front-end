import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

/**
 * Sends a password-recovery email via Supabase (`resetPasswordForEmail`).
 * For a 6-digit code in the email, configure the **Recovery** template in the
 * Supabase dashboard to include `{{ .Token }}` (and avoid relying only on
 * `{{ .ConfirmationURL }}` if you want OTP-only). Resend uses the same call.
 *
 * `redirectTo` satisfies Supabase redirect allowlists when the recovery email
 * still includes a link; the in-app flow enters the code manually on `/reset-password`.
 */
export async function sendPasswordResetOtp(email: string) {
  const redirectTo = Linking.createURL('/reset-password');
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
}
