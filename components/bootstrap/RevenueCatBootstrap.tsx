import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { CustomerInfoUpdateListener } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

import { configureRevenueCat } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';

/**
 * Initializes RevenueCat, aligns App User ID with Supabase Auth, and bumps subscription refresh when:
 * RevenueCat customer info updates, app returns to foreground (pick up webhook→Supabase `rc_*`), or auth changes.
 */
export function RevenueCatBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    configureRevenueCat();

    const rcListener: CustomerInfoUpdateListener = () => {
      invalidateSubscriptionCache();
    };
    Purchases.addCustomerInfoUpdateListener(rcListener);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        invalidateSubscriptionCache();
      }
    });

    const syncPurchasesUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await Purchases.logIn(session.user.id);
          invalidateSubscriptionCache();
        }
      } catch (e) {
        console.warn('[RevenueCat] initial logIn', e);
      }
    };

    void syncPurchasesUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          if (session?.user?.id) {
            await Purchases.logIn(session.user.id);
          } else {
            await Purchases.logOut();
          }
          invalidateSubscriptionCache();
        } catch (e) {
          console.warn('[RevenueCat] auth sync', e);
        }
      })();
    });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(rcListener);
      appStateSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
