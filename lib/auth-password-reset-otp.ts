import { supabase } from '@/lib/supabase';

/**
 * Sends a password-recovery OTP email via Supabase (`resetPasswordForEmail`).
 *
 * `redirectTo` is intentionally omitted. When a redirect link is included in
 * the recovery email, many email clients (Gmail, iOS Mail, Outlook) automatically
 * pre-fetch that link for phishing/security scanning. This causes Supabase to
 * mark the underlying OTP token as consumed server-side before the user ever
 * sees the 6-digit code — resulting in "invalid or expired code" errors even
 * though the UI timer still shows time remaining.
 *
 * Without `redirectTo`, Supabase sends only the OTP code (`{{ .Token }}` in the
 * Recovery email template) with no pre-fetchable link. The user enters the code
 * manually on `/reset-password` and it is verified with `verifyOtp({ type: 'recovery' })`.
 */
export async function sendPasswordResetOtp(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
}
