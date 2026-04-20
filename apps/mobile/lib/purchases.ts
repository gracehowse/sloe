import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the RevenueCat SDK key.
 *
 * Priority (highest wins):
 *   1. Platform-specific key (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` /
 *      `…_GOOGLE_KEY`) — production split-key path. These are provisioned
 *      per-platform in RC ("Apple App Store" / "Google Play Store" apps)
 *      and remain the canonical route for prod builds.
 *   2. Unified v2 key (`EXPO_PUBLIC_REVENUECAT_API_KEY`) — RC's single-key
 *      format (prefix `test_…` for sandbox, `appl_…`/`goog_…`-agnostic
 *      v2 tokens for prod). Useful in dev so one env var works on both
 *      platforms without needing two separate RC app registrations.
 *
 * Prod should still prefer (1); (2) exists so a freshly-minted RC test
 * key works in a dev build without editing two variables.
 */
const API_KEY_V2_UNIFIED =
  Constants.expoConfig?.extra?.revenuecatApiKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
  "";
const API_KEY_IOS =
  Constants.expoConfig?.extra?.revenuecatAppleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ??
  API_KEY_V2_UNIFIED;
const API_KEY_ANDROID =
  Constants.expoConfig?.extra?.revenuecatGoogleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ??
  API_KEY_V2_UNIFIED;

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

/**
 * Present the RevenueCat-hosted Customer Center so users can manage
 * their subscription (cancel, change plan, request refund on iOS, etc.).
 *
 * The RC Customer Center is a native surface — it isn't available in
 * Expo Go, on web, or when `react-native-purchases-ui` fails to load
 * for any reason. All of those fail-safe to `{ presented: false }`
 * with a machine-readable `reason`, so callers can fall back to the
 * App Store / Play Store subscription management URL if they want.
 */
export async function presentCustomerCenter(): Promise<
  | { presented: true }
  | { presented: false; reason: "no_api_key" | "ui_unavailable" | "error" }
> {
  if (!isPurchasesApiKeyPresent()) {
    return { presented: false, reason: "no_api_key" };
  }
  try {
    // Dynamic import so the main JS bundle isn't forced to resolve the
    // UI module at launch — it pulls in a native view that isn't valid
    // on web / in test environments.
    const mod = await import("react-native-purchases-ui");
    const RevenueCatUI = mod.default ?? mod;
    if (!RevenueCatUI?.presentCustomerCenter) {
      return { presented: false, reason: "ui_unavailable" };
    }
    await RevenueCatUI.presentCustomerCenter();
    return { presented: true };
  } catch (e) {
    if (__DEV__) console.warn("[presentCustomerCenter]", e);
    return { presented: false, reason: "error" };
  }
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
