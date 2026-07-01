import { redeemReferralCode, REFERRAL_STORAGE_KEY, normaliseReferralCode } from "./referralClient";

type SupabaseLike = Parameters<typeof redeemReferralCode>[0];

export function storePendingReferralFromLocation(search: string): void {
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
