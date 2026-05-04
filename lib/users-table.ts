import { supabase } from '@/lib/supabase';

function coerceNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

/** `public.users.id` for the signed-in user (matched by Auth email ↔ `users.email`). */
export async function fetchCurrentUserRowId(): Promise<{ id: number | null; error: Error | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { id: null, error: new Error('You must be signed in to save alarms.') };
  }

  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();

  if (error) {
    return { id: null, error };
  }

  const id = coerceNumericId(data?.id);
  if (id == null) {
    return {
      id: null,
      error: new Error('Could not find your profile in the users table. Try signing out and back in.'),
    };
  }

  return { id, error: null };
}
