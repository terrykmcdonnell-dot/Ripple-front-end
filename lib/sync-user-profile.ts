import { supabase } from '@/lib/supabase';

export type UserProfileRow = {
  name: string;
  email: string;
  password: string;
};

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
    return { error };
  }

  const { error } = await supabase.from('users').insert({
    name: profile.name,
    email,
    password: profile.password,
  });
  return { error };
}
