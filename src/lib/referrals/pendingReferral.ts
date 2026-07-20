import { isFeatureEnabled } from "@/lib/analytics/track";

import {
  redeemReferralCode,
  REFERRAL_FLAG,
  REFERRAL_STORAGE_KEY,
  normaliseReferralCode,
} from "./referralClient";

type SupabaseLike = Parameters<typeof redeemReferralCode>[0];

export function storePendingReferralFromLocation(search: string): void {
  // ENG-1541 — referral_invite_loop_v1 is DEFAULT-OFF (no entitlement-grant
  // path exists yet; see ENG-1487). Don't capture a referral attribution the
  // UI never promised — kill switch, not a broken half-state.
  if (!isFeatureEnabled(REFERRAL_FLAG)) return;
  const ref = normaliseReferralCode(new URLSearchParams(search).get("ref"));
  if (!ref) return;
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
  } catch {
    /* storage unavailable — redemption is best-effort after signup */
  }
}

export async function redeemPendingReferral(
  supabase: SupabaseLike,
): Promise<{ redeemed: boolean; error: string | null }> {
  // ENG-1541 — same kill switch: never call the redeem RPC (which records
  // the referral relationship but can't grant any entitlement yet) while the
  // flag is off, even if a code was captured before the flag flipped off.
  if (!isFeatureEnabled(REFERRAL_FLAG)) return { redeemed: false, error: null };
  try {
    const pendingReferral = normaliseReferralCode(
      window.localStorage.getItem(REFERRAL_STORAGE_KEY),
    );
    if (!pendingReferral) return { redeemed: false, error: null };

    const result = await redeemReferralCode(supabase, pendingReferral);
    if (
      result.ok ||
      result.error === "invalid_code" ||
      result.error === "cannot_refer_self" ||
      result.error === "already_redeemed"
    ) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    return { redeemed: result.ok, error: result.ok ? null : result.error };
  } catch {
    return { redeemed: false, error: "redeem_failed" };
  }
}
