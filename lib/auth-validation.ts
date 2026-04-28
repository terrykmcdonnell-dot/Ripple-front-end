const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email.trim());
}

/** Allow only characters valid in typical email addresses; strip spaces. */
export function sanitizeEmailInput(text: string) {
  return text.replace(/\s/g, '').replace(/[^a-zA-Z0-9@._%+-]/g, '');
}

/** Supabase default minimum is 6; keep aligned. */
export function isValidPassword(password: string) {
  return password.length >= 6;
}

export type AuthErrorMeta = {
  code?: string;
  status?: number;
};

/**
 * Map Supabase Auth (and related) errors to short, user-friendly copy.
 * See: https://supabase.com/docs/reference/javascript/auth-error-codes
 */
export function formatAuthErrorMessage(message: string, meta?: AuthErrorMeta) {
  const lower = message.toLowerCase();
  const code = meta?.code?.toLowerCase() ?? '';

  if (code === 'invalid_credentials') {
    return 'That email or password is incorrect. Check your details and try again.';
  }
  if (code === 'user_not_found') {
    return 'No account found for this email. Sign up first or check the address.';
  }
  if (code === 'email_not_confirmed') {
    return 'Please verify your email first. Check your inbox for the code.';
  }
  if (code === 'user_already_exists') {
    return 'This email is already registered. Sign in or use a different email.';
  }
  if (code === 'weak_password' || code === 'same_password') {
    return 'Choose a stronger password that meets the requirements.';
  }
  if (code === 'signup_disabled') {
    return 'New sign-ups are not available right now. Try again later.';
  }
  if (code === 'otp_expired' || code === 'flow_state_expired') {
    return 'Invalid or expired code. Request a new code and try again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'That email or password is incorrect. Check your details and try again.';
  }
  if (lower.includes('user not found')) {
    return 'No account found for this email. Sign up first or check the address.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email first. Check your inbox for the code.';
  }
  if (
    lower.includes('already registered') ||
    lower.includes('user already exists') ||
    lower.includes('already been registered')
  ) {
    return 'This email is already registered. Sign in or use a different email.';
  }
  if (lower.includes('signup') && lower.includes('not allowed')) {
    return 'New sign-ups are not available right now. Try again later.';
  }
  if (lower.includes('password') && (lower.includes('at least') || lower.includes('too short') || lower.includes('minimum'))) {
    return 'Password is too short. Use at least 6 characters.';
  }
  if (lower.includes('weak_password') || lower.includes('password is known') || lower.includes('pwned')) {
    return 'Choose a stronger password that is not commonly used.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email') || lower.includes('invalid format')) {
    return 'That email address does not look valid.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('email rate limit')) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (lower.includes('for security purposes') && lower.includes('seconds')) {
    return 'Please wait before requesting another code.';
  }
  if (
    (lower.includes('token') && (lower.includes('invalid') || lower.includes('expired'))) ||
    code === 'otp_expired'
  ) {
    return 'Invalid or expired code. Request a new code and try again.';
  }
  if (lower.includes('otp') || code === 'otp_disabled') {
    return 'That code is not valid. Check the email and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to connect')) {
    return 'Network problem. Check your connection and try again.';
  }
  if (meta?.status === 500 || lower.includes('internal server error') || lower.includes('service unavailable')) {
    return 'Service is temporarily unavailable. Try again in a moment.';
  }
  if (lower.includes('session') && lower.includes('expired')) {
    return 'Your session expired. Please sign in again.';
  }
  if (lower.includes('invalid_grant') || lower.includes('invalid id token')) {
    return 'Sign-in could not be completed. Try again.';
  }

  if (message.trim()) {
    return message;
  }
  return 'Something went wrong. Please try again.';
}
