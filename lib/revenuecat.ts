import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

let configured = false;

export function getRevenueCatApiKey(): string {
  const shared = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? '';
  // if (Platform.OS === 'ios') {
  //   return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() ?? shared;
  // }
  // if (Platform.OS === 'android') {
  //   return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() ?? shared;
  // }
  return shared;
}

/** Must match the entitlement identifier in the RevenueCat dashboard (default `pro`). */
export function getRevenueCatEntitlementId(): string {
  return process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || 'pro';
}

/** Idempotent native SDK setup (no-op on web / missing key). */
export function configureRevenueCat(): void {
  if (configured || Platform.OS === 'web') {
    return;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env');
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export function pickMonthlyAnnualPackages(
  offering: PurchasesOffering | null | undefined,
): { monthly?: PurchasesPackage; annual?: PurchasesPackage } {
  const packages = offering?.availablePackages ?? [];
  let monthly: PurchasesPackage | undefined;
  let annual: PurchasesPackage | undefined;
  for (const pkg of packages) {
    if (pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) {
      monthly ??= pkg;
    }
    if (pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) {
      annual ??= pkg;
    }
  }
  const idHint = (p: PurchasesPackage) => p.identifier.toLowerCase();
  for (const pkg of packages) {
    const id = idHint(pkg);
    if (!monthly && (id.includes('month') || id.includes('monthly'))) {
      monthly = pkg;
    }
    if (!annual && (id.includes('annual') || id.includes('year'))) {
      annual = pkg;
    }
  }
  return { monthly, annual };
}

export function hasPremiumEntitlement(info: CustomerInfo): boolean {
  const id = getRevenueCatEntitlementId();
  return info.entitlements.active[id] != null;
}

export function isPurchasesUserCancelled(error: unknown): boolean {
  const e = error as PurchasesError | undefined;
  if (!e || typeof e !== 'object') {
    return false;
  }
  if (e.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return true;
  }
  if (e.userCancelled === true) {
    return true;
  }
  return false;
}

export function purchasesErrorMessage(error: unknown): string {
  const e = error as PurchasesError | undefined;
  if (e && typeof e === 'object' && typeof e.message === 'string' && e.message.length > 0) {
    return e.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}
