import { Alert, type AlertButton } from 'react-native';

import { formatAuthErrorMessage } from '@/lib/auth-validation';

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

/** User-visible alert for failed auth / account actions (maps Supabase messages to friendly copy). */
export function notifyAuthError(title: string, error: unknown) {
  const { message, code, status } = normalizeError(error);
  const text = formatAuthErrorMessage(message, { code, status });
  Alert.alert(title, text);
}

export function notifyAuthMessage(title: string, message: string, buttons?: AlertButton[]) {
  if (buttons?.length) {
    Alert.alert(title, message, buttons);
    return;
  }
  Alert.alert(title, message);
}
