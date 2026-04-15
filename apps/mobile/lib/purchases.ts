import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

const API_KEY_IOS =
  Constants.expoConfig?.extra?.revenuecatAppleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ??
  "";
const API_KEY_ANDROID =
  Constants.expoConfig?.extra?.revenuecatGoogleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ??
  "";

let configured = false;

export function isPurchasesApiKeyPresent(): boolean {
  const key = Platform.OS === "ios" ? API_KEY_IOS : API_KEY_ANDROID;
  return !!key;
}

/**
 * Configure RevenueCat on first call, then associate the Supabase user when available
 * (module-level `configurePurchases()` may have run without a user id).
 */
export async function ensurePurchasesUser(
  userId: string | undefined,
): Promise<void> {
  const key = Platform.OS === "ios" ? API_KEY_IOS : API_KEY_ANDROID;
  if (!key) return;

  if (!configured) {
    Purchases.configure({
      apiKey: key,
      appUserID: userId || undefined,
    });
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    configured = true;
    return;
  }

  if (userId) {
    try {
      await Purchases.logIn(userId);
    } catch {
      /* offerings may still work as anonymous */
    }
  }
}

export function configurePurchases(userId?: string): void {
  if (configured) return;
  const key = Platform.OS === "ios" ? API_KEY_IOS : API_KEY_ANDROID;
  if (!key) return;

  Purchases.configure({
    apiKey: key,
    appUserID: userId ?? undefined,
  });
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  configured = true;
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo }> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo: result.customerInfo };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean };
    if (err.userCancelled) return { success: false };
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function isProEntitled(info: CustomerInfo): boolean {
  return !!info.entitlements.active["pro"];
}

export function isBaseEntitled(info: CustomerInfo): boolean {
  return (
    !!info.entitlements.active["base"] || !!info.entitlements.active["pro"]
  );
}

export function resolvedTier(info: CustomerInfo): "free" | "base" | "pro" {
  if (info.entitlements.active["pro"]) return "pro";
  if (info.entitlements.active["base"]) return "base";
  return "free";
}

const tierRank = (t: string) => (t === "pro" ? 2 : t === "base" ? 1 : 0);

/** Best tier from promo codes the user has redeemed (requires RLS policy on promo_codes). */
async function bestPromoTierFromRedemptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<"free" | "base" | "pro"> {
  const { data, error } = await supabase
    .from("promo_redemptions")
    .select("promo_codes(tier)")
    .eq("user_id", userId);
  if (error || !data?.length) return "free";
  let best: "free" | "base" | "pro" = "free";
  for (const row of data as { promo_codes: { tier: string } | { tier: string }[] | null }[]) {
    const pc = row.promo_codes;
    const embedded = Array.isArray(pc) ? pc[0] : pc;
    const t = (embedded?.tier as string | undefined)?.toLowerCase();
    if (t === "pro" || t === "base" || t === "free") {
      if (tierRank(t) > tierRank(best)) best = t;
    }
  }
  return best;
}

/**
 * Sync effective plan tier to Supabase `profiles.user_tier`.
 * Merges RevenueCat entitlements with redeemed promo tiers so promos are not wiped by a later RC sync.
 */
export async function syncTierToSupabase(
  info: CustomerInfo,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const rc = resolvedTier(info);
  const promo = await bestPromoTierFromRedemptions(supabase, userId);
  const mergedRank = Math.max(tierRank(rc), tierRank(promo));
  const tier: "free" | "base" | "pro" = mergedRank >= 2 ? "pro" : mergedRank >= 1 ? "base" : "free";
  const { error } = await supabase.from("profiles").update({ user_tier: tier }).eq("id", userId);
  if (error && __DEV__) {
    console.warn("[syncTierToSupabase]", error.message);
  }
}
