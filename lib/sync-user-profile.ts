import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type UserProfileRow = {
  name: string;
  email: string;
  password: string;
};

/** Postgres / PostgREST unique violation on public.users.email. */
export function isDuplicateUsersEmailError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const blob = [
    'message' in error ? String((error as { message?: unknown }).message ?? '') : '',
    'code' in error ? String((error as { code?: unknown }).code ?? '') : '',
    'details' in error ? String((error as { details?: unknown }).details ?? '') : '',
  ]
    .join(' ')
    .toLowerCase();
  return (
    blob.includes('23505') ||
    blob.includes('duplicate key') ||
    blob.includes('unique constraint') ||
    blob.includes('users_email_key')
  );
}

/** Display name from Auth metadata (OTP signup stores `name` in user_metadata). */
export function deriveProfileNameFromAuthUser(authUser: {
  email?: string | null;
  user_metadata?: User['user_metadata'];
}): string {
  const email = authUser.email?.trim().toLowerCase() ?? '';
  const meta = authUser.user_metadata as Record<string, unknown> | undefined;

  const fromMeta =
    (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    '';

  if (fromMeta) {
    return fromMeta;
  }
  const local = email.includes('@') ? email.split('@')[0] : email;
  return local || 'User';
}

/**
 * Inserts `public.users` only when absent (does not overwrite name/password).
 * Use when Auth exists but profile sync was skipped (e.g. RLS flake, older app build).
 */
export async function ensureUsersRowFromAuthUser(authUser: User) {
  const email = authUser.email?.trim().toLowerCase();
  if (!email) {
    return { error: null };
  }

  const { data: existing, error: readError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (readError) {
    return { error: readError };
  }
  if (existing != null) {
    return { error: null };
  }

  const name = deriveProfileNameFromAuthUser(authUser);
  const { error } = await supabase.from('users').insert({
    name,
    email,
    password: '',
  });
  if (error && isDuplicateUsersEmailError(error)) {
    // Profile row already exists (e.g. prior signup or social sign-in) — treat as success.
    return { error: null };
  }
  return { error };
}

/**
 * Upserts public.users after Supabase Auth signup/verification succeeds.
 */
export async function syncUserProfileToTable(profile: UserProfileRow) {
  const email = profile.email.trim().toLowerCase();

  const { data: existing, error: readError } = await supabase.from('users').select('email').eq('email', email).maybeSingle();

  if (readError) {
    return { error: readError };
  }

  if (existing) {
    const { error } = await supabase.from('users').update({ name: profile.name, password: profile.password }).eq('email', email);
    return { error, isNewUser: false };
  }

  const { error } = await supabase.from('users').insert({
    name: profile.name,
    email,
    password: profile.password,
  });
  if (error && isDuplicateUsersEmailError(error)) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ name: profile.name, password: profile.password })
      .eq('email', email);
    return { error: updateError, isNewUser: false };
  }
  return { error, isNewUser: true };
}

/** Updates `public.users.password` after Auth password change (best-effort). */
export async function syncPasswordToUsersTable(email: string, password: string) {
  const e = email.trim().toLowerCase();
  const { error } = await supabase.from('users').update({ password }).eq('email', e);
  return { error };
}
