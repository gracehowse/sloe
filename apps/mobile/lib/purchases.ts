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

/**
 * Poll RevenueCat until the target entitlement is active, or give up
 * after `maxAttempts` with `intervalMs` between each (ENG-684).
 *
 * Returns the entitled `CustomerInfo` on success, or `null` if the
 * entitlement never appeared within the polling window. The caller
 * decides what to show in the timeout case — it must be a clear
 * recovery message with a manual Restore CTA, not an infinite spinner.
 */
export async function pollUntilEntitled(
  tier: "pro" | "base",
  maxAttempts = 5,
  intervalMs = 2000,
): Promise<CustomerInfo | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      const info = await getCustomerInfo();
      const entitled = tier === "pro" ? isProEntitled(info) : isBaseEntitled(info);
      if (entitled) return info;
    } catch {
      // RC fetch failure — keep polling until attempts exhausted
    }
  }
  return null;
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
/**
 * Pure tier-merge with downgrade guard. Extracted so it can be
 * pinned by `tests/unit/resolveNextTier.test.ts` without pulling in
 * the RC native module (which breaks under vitest).
 *
 * F-58 (2026-04-22): return `null` when RC-derived tier would
 * downgrade the currently-stored tier. Real cancellations reach the
 * client via webhooks that write `profiles.user_tier` directly and
 * never go through this client-side reconcile path, so a stored Pro
 * always wins over an empty RC response.
 */
export type UserTier = "free" | "base" | "pro";

export function resolveNextTier(args: {
  rc: UserTier;
  promo: UserTier;
  current: UserTier;
}): { next: UserTier; write: boolean; reason: "upgrade" | "downgrade-blocked" | "no-change" } {
  const { rc, promo, current } = args;
  const mergedRank = Math.max(tierRank(rc), tierRank(promo));
  const computed: UserTier = mergedRank >= 2 ? "pro" : mergedRank >= 1 ? "base" : "free";

  if (tierRank(computed) < tierRank(current)) {
    return { next: current, write: false, reason: "downgrade-blocked" };
  }
  if (computed === current) {
    return { next: current, write: false, reason: "no-change" };
  }
  return { next: computed, write: true, reason: "upgrade" };
}

/**
 * Outcome of `syncTierToSupabase`. Designed so the caller (paywall)
 * can surface a sensible user-facing message even when the client
 * write is locked out by design.
 *
 * F-143 (2026-05-10): the previous void return + DEV-only console.warn
 * meant production users whose purchase succeeded at Apple but whose
 * tier never propagated saw zero feedback — Grace's TF brief reported
 * "trial / payments not hooked up at all" because the upgrade was
 * silent on every code path.
 */
export type TierSyncOutcome =
  /** No change needed — user is already at the resolved tier. */
  | { status: "no_change"; reason: string }
  /** Client write succeeded (legacy / non-lockdown environment). */
  | { status: "wrote"; from: UserTier; to: UserTier }
  /** Client write rejected by the lockdown — expected; the
   *  RevenueCat server webhook is the authoritative path and should
   *  catch up within seconds. The paywall surfaces this as
   *  "Processing your purchase…" with a follow-up grace period. */
  | { status: "lockdown_expected"; from: UserTier; to: UserTier }
  /** Client write failed for a non-lockdown reason — surface to user
   *  + capture telemetry so we can diagnose. */
  | { status: "unexpected_error"; from: UserTier; to: UserTier; error: { code?: string; message: string } };

export async function syncTierToSupabase(
  info: CustomerInfo,
  supabase: SupabaseClient,
  userId: string,
): Promise<TierSyncOutcome> {
  const rc = resolvedTier(info);
  const promo = await bestPromoTierFromRedemptions(supabase, userId);

  const { data: existing } = await supabase
    .from("profiles")
    .select("user_tier")
    .eq("id", userId)
    .maybeSingle();
  const current = (existing?.user_tier as UserTier | null) ?? "free";

  const { next, write, reason } = resolveNextTier({ rc, promo, current });
  if (!write) {
    if (__DEV__ && reason === "downgrade-blocked") {
      console.warn(
        `[syncTierToSupabase] refusing to downgrade ${current} → computed (RC=${rc}, promo=${promo})`,
      );
    }
    return { status: "no_change", reason };
  }

  const { error } = await supabase.from("profiles").update({ user_tier: next }).eq("id", userId);
  if (error) {
    // T2 (full-sweep 2026-04-24) lockdown: `profiles.user_tier` is no
    // longer client-writable. This UPDATE returns 42501 once migration
    // 20260503100000_profiles_tier_column_lockdown.sql has been applied.
    // The correct write path is the T6 RevenueCat server webhook
    // (service-role). Until T6's webhook is live, mobile tier sync
    // after purchase will fail here — surface that to the caller so the
    // paywall can choose whether to wait/poll/show grace copy.
    const locked =
      (error as { code?: string }).code === "42501" ||
      /T2: tier column lockdown/.test(error.message ?? "");
    if (__DEV__) {
      if (locked) {
        console.warn(
          `[syncTierToSupabase] T2 tier-column lockdown rejected client write (expected). Tier sync arrives via RevenueCat webhook (T6). Attempted: ${current} → ${next}`,
        );
      } else {
        console.warn("[syncTierToSupabase]", error.message);
      }
    }
    if (locked) {
      return { status: "lockdown_expected", from: current, to: next };
    }
    return {
      status: "unexpected_error",
      from: current,
      to: next,
      error: { code: (error as { code?: string }).code, message: error.message ?? "Unknown error" },
    };
  }
  return { status: "wrote", from: current, to: next };
}
