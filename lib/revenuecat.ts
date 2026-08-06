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
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() || shared;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() || shared;
  }
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
    console.warn(
      '[RevenueCat] Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS / EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID (or EXPO_PUBLIC_REVENUECAT_API_KEY fallback) in .env',
    );
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
): { monthly?: PurchasesPackage; annual?: PurchasesPackage; lifetime?: PurchasesPackage } {
  const packages = offering?.availablePackages ?? [];
  let monthly: PurchasesPackage | undefined;
  let annual: PurchasesPackage | undefined;
  let lifetime: PurchasesPackage | undefined;
  for (const pkg of packages) {
    if (pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) {
      monthly ??= pkg;
    }
    if (pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) {
      annual ??= pkg;
    }
    if (pkg.packageType === Purchases.PACKAGE_TYPE.LIFETIME) {
      lifetime ??= pkg;
    }
  }
  const idHint = (p: PurchasesPackage) => p.identifier.toLowerCase();
  const productHint = (p: PurchasesPackage) => p.product.identifier.toLowerCase();
  for (const pkg of packages) {
    const id = idHint(pkg);
    const pid = productHint(pkg);
    if (!lifetime && (id.includes('lifetime') || id.includes('forever') || pid.includes('lifetime') || pid.includes('forever'))) {
      lifetime = pkg;
    }
    if (!monthly && (id.includes('month') || id.includes('monthly'))) {
      monthly = pkg;
    }
    if (!annual && (id.includes('annual') || id.includes('year'))) {
      annual = pkg;
    }
  }
  return { monthly, annual, lifetime };
}

export function hasPremiumEntitlement(info: CustomerInfo): boolean {
  const id = getRevenueCatEntitlementId();
  return info.entitlements.active[id] != null;
}

/** Product identifiers currently active on the store subscription (RevenueCat SDK). */
export function activeSubscriptionProductIds(info: CustomerInfo | null | undefined): string[] {
  if (!info || !info.activeSubscriptions) return [];
  const raw = info.activeSubscriptions as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id));
}

export function isLikelyLifetimeProductId(productId: string): boolean {
  const pid = productId.toLowerCase();
  return (
    pid.includes('lifetime') ||
    pid.includes('forever') ||
    pid.includes('one_time') ||
    pid.includes('onetime')
  );
}

/** Auto-renewing App Store / Play Store subscriptions still billing (excludes lifetime one-time products). */
export function hasActiveAutoRenewingStoreSubscription(
  info: CustomerInfo | null | undefined,
): boolean {
  return activeSubscriptionProductIds(info).some((id) => !isLikelyLifetimeProductId(id));
}

export function isPackageInActiveSubscription(
  pkg: PurchasesPackage | null | undefined,
  info: CustomerInfo | null | undefined,
): boolean {
  if (!pkg || !info) return false;
  const pid = pkg.product.identifier;
  const ent = info.entitlements.active[getRevenueCatEntitlementId()];
  if (ent?.productIdentifier === pid) {
    return true;
  }
  return activeSubscriptionProductIds(info).includes(pid);
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

/**
 * Pull latest subscription state from App Store / Play Store after a transaction so CustomerInfo
 * matches what RevenueCat + webhooks will see (fixes stale activeSubscriptions after plan changes).
 */
export async function syncPurchasesAfterTransaction(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  if (!getRevenueCatApiKey()) {
    return;
  }
  configureRevenueCat();
  try {
    await Purchases.syncPurchasesForResult();
  } catch {
    try {
      await Purchases.syncPurchases();
    } catch {
      /* ignore — purchase already returned CustomerInfo */
    }
  }
}
