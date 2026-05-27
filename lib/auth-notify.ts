import { Alert, type AlertButton } from 'react-native';

import { formatAuthErrorMessage } from '@/lib/auth-validation';
import { isExpiredJwtOrSessionError, refreshOrSignOutOnExpiredSession } from '@/lib/auth-session-errors';

/** Set by `AppToastProvider` so auth UX uses in-app toasts instead of system `Alert`. */
export type AuthToastVariant = 'info' | 'warning' | 'error';

let authToastShow: ((message: string, variant?: AuthToastVariant) => void) | null = null;

export function setAuthToastHandler(handler: ((message: string, variant?: AuthToastVariant) => void) | null) {
  authToastShow = handler;
}

function formatAuthToast(title: string, message: string, variant: AuthToastVariant = 'info'): string {
  const m = message.trim();
  if (!m) {
    return title;
  }
  if (variant === 'warning') {
    return m;
  }
  return `${title} — ${m}`;
}

type ErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function normalizeError(error: unknown): { message: string; code?: string; status?: number } {
  if (error == null) {
    return { message: '' };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (error instanceof Error) {
    const e = error as Error & ErrorLike;
    return { message: e.message ?? '', code: e.code, status: e.status };
  }
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const message = typeof e.message === 'string' ? e.message : '';
    const code = typeof e.code === 'string' ? e.code : undefined;
    const status = typeof e.status === 'number' ? e.status : undefined;
    return { message, code, status };
  }
  return { message: '' };
}

/** Plain text for inline UI / toasts (same mapping as {@link notifyAuthError}). */
export function getAuthErrorDisplayText(error: unknown): string {
  const { message, code, status } = normalizeError(error);
  return formatAuthErrorMessage(message, { code, status });
}

/** User-visible alert for failed auth / account actions (maps Supabase messages to friendly copy). */
export function notifyAuthError(title: string, error: unknown) {
  if (isExpiredJwtOrSessionError(error)) {
    void refreshOrSignOutOnExpiredSession();
    return;
  }
  const text = getAuthErrorDisplayText(error);
  if (authToastShow) {
    authToastShow(formatAuthToast(title, text), 'error');
    return;
  }
  Alert.alert(title, text);
}

export function notifyAuthMessage(
  title: string,
  message: string,
  buttons?: AlertButton[],
  variant: AuthToastVariant = 'info',
) {
  if (buttons?.length) {
    Alert.alert(title, message, buttons);
    return;
  }
  if (authToastShow) {
    authToastShow(formatAuthToast(title, message, variant), variant);
    return;
  }
  Alert.alert(title, message);
}

/** Validation / missing-field prompts (amber warning toast, not info). */
export function notifyAuthWarning(title: string, message: string) {
  notifyAuthMessage(title, message, undefined, 'warning');
}
