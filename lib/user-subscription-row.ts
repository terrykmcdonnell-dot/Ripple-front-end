import { supabase } from '@/lib/supabase';
import { isExpiredJwtOrSessionError, refreshOrSignOutOnExpiredSession } from '@/lib/auth-session-errors';

export type UserRcSubscriptionRow = {
  rc_customer_id: string | null;
  rc_subscription_status: string | null;
  rc_subscription_plan: string | null;
};

function normalizeStatus(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Supabase `users` row updated by RevenueCat webhooks (`rc_subscription_*`).
 * Align with Ripple-backend `revenuecat_webhook` handler.
 */
export function dbIndicatesActivePro(row: UserRcSubscriptionRow | null | undefined): boolean {
  if (!row?.rc_subscription_status) {
    return false;
  }
  const s = normalizeStatus(row.rc_subscription_status);
  return s === 'active' || s === 'billing_issue';
}

export function displayPlanFromDb(row: UserRcSubscriptionRow | null | undefined): string {
  const p = normalizeStatus(row?.rc_subscription_plan);
  switch (p) {
    case 'annual':
      return 'Annual';
    case 'monthly':
      return 'Monthly';
    case 'trial':
      return 'Free trial';
    case 'intro':
      return 'Intro offer';
    default:
      return 'Ripple Pro';
  }
}

async function selectRcColumnsByEmail(email: string) {
  return supabase
    .from('users')
    .select('rc_customer_id, rc_subscription_status, rc_subscription_plan')
    .eq('email', email)
    .maybeSingle();
}

/** Loads webhook-synced RevenueCat columns for the signed-in user (by email ↔ users.email). */
export async function fetchUserRcSubscriptionFromDb(): Promise<UserRcSubscriptionRow | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  let { data, error } = await selectRcColumnsByEmail(email);

  if (error && isExpiredJwtOrSessionError(error)) {
    await refreshOrSignOutOnExpiredSession();
    const {
      data: { session: after },
    } = await supabase.auth.getSession();
    if (!after?.user?.email) {
      return null;
    }
    ({ data, error } = await selectRcColumnsByEmail(email));
  }

  if (error || !data) {
    return null;
  }

  return data as UserRcSubscriptionRow;
}
