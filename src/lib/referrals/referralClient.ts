type SupabaseLike = {
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export type ReferralReward = {
  code: string;
  referralUrl: string;
};

export type RedeemReferralResult =
  | { ok: true; code: string; referrerDays: number; refereeDays: number }
  | { ok: false; error: "invalid_code" | "cannot_refer_self" | "already_redeemed" | "not_authenticated" | "redeem_failed" };

export const REFERRAL_FLAG = "referral_invite_loop_v1";
export const REFERRAL_STORAGE_KEY = "suppr.pending_referral_code";
export const REFERRAL_DAYS = 30;

export function normaliseReferralCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export function buildReferralUrl(code: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/g/${encodeURIComponent(normaliseReferralCode(code))}`;
}

export async function getOrCreateReferralReward(
  supabase: SupabaseLike,
  baseUrl: string,
): Promise<{ data: ReferralReward | null; error: string | null }> {
  if (!baseUrl) return { data: null, error: "missing_base_url" };
  const { data, error } = await supabase.rpc("get_or_create_referral_code");
  if (error) return { data: null, error: error.message ?? "load_failed" };
  const code = normaliseReferralCode(typeof data === "string" ? data : data?.code);
  if (!code) return { data: null, error: "load_failed" };
  return { data: { code, referralUrl: buildReferralUrl(code, baseUrl) }, error: null };
}

export async function redeemReferralCode(
  supabase: SupabaseLike,
  code: string,
): Promise<RedeemReferralResult> {
  const cleanCode = normaliseReferralCode(code);
  if (!cleanCode) return { ok: false, error: "invalid_code" };
  const { data, error } = await supabase.rpc("redeem_referral_code", {
    p_code: cleanCode,
  });
  if (error) return { ok: false, error: "redeem_failed" };
  const status = String(data?.status ?? "");
  if (status === "redeemed") {
    return {
      ok: true,
      code: cleanCode,
      referrerDays: Number(data?.referrer_days ?? REFERRAL_DAYS),
      refereeDays: Number(data?.referee_days ?? REFERRAL_DAYS),
    };
  }
  if (
    status === "invalid_code" ||
    status === "cannot_refer_self" ||
    status === "already_redeemed" ||
    status === "not_authenticated"
  ) {
    return { ok: false, error: status };
  }
  return { ok: false, error: "redeem_failed" };
}
