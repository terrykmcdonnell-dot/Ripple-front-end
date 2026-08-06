import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { CustomerInfoUpdateListener } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

import { configureRevenueCat } from '@/lib/revenuecat';
import { runDeferredAppWork, runOnAppForeground } from '@/lib/defer-app-work';
import { supabase } from '@/lib/supabase';
import { invalidateSubscriptionCache } from '@/lib/subscription-sync-hub';
import { resetSubscriptionStatusCache } from '@/hooks/use-subscription-status';

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
        runOnAppForeground(() => {
          invalidateSubscriptionCache();
        });
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

    runDeferredAppWork(() => {
      void syncPurchasesUser();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          if (session?.user?.id) {
            await Purchases.logIn(session.user.id);
          } else {
            await Purchases.logOut();
            resetSubscriptionStatusCache();
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
