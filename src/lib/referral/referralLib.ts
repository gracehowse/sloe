/**
 * ENG-5 — Referral mechanic: pure server-side logic.
 *
 * This module only runs in server contexts (API routes). Never import
 * from client components — it uses SUPABASE_SERVICE_ROLE_KEY directly.
 *
 * Reward crediting stubs at `reward_granted_at = null` until ENG-198
 * (RevenueCat provisioning) wires the actual 30-day Pro grant. The
 * `referral_credits` row is created immediately so referrals are never
 * lost if ENG-198 is delayed.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";

// ─── constants ────────────────────────────────────────────────────────────────

export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_DAYS_NEW = 30;
export const REFERRAL_DAYS_ALREADY_PAID = 60;
/** Lifetime cap: 12 months of free Pro per user (anti-farming). */
export const REFERRAL_MAX_REWARD_DAYS = 365;
/** Anti-abuse: flag if >20 redemptions/week without prior conversions. */
export const REFERRAL_WEEKLY_ABUSE_THRESHOLD = 20;
/** Referrer must have existed for 7 days before the link is active. */
export const REFERRAL_MINIMUM_ACCOUNT_AGE_DAYS = 7;

// ─── types ────────────────────────────────────────────────────────────────────

export type ReferralRow = {
  id: string;
  referrer_id: string;
  code: string;
  created_at: string;
  total_redeemed: number;
  total_reward_days_granted: number;
  flagged_at: string | null;
};

export type ReferralCreditRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  code: string;
  redeemed_at: string;
  reward_granted_at: string | null;
  referrer_days: number;
  referee_days: number;
};

export type GenerateResult =
  | { ok: true; code: string; created: boolean }
  | { ok: false; reason: "service_role_missing" | "account_too_new" | "db_error"; error?: string };

export type RedeemResult =
  | { ok: true; referrerId: string; referrerDays: number; refereeDays: number }
  | {
      ok: false;
      reason:
        | "service_role_missing"
        | "code_not_found"
        | "code_flagged"
        | "already_redeemed"
        | "self_referral"
        | "referrer_cap_reached"
        | "db_error";
      error?: string;
    };

export type StatusResult =
  | {
      ok: true;
      code: string;
      totalRedeemed: number;
      totalRewardDaysGranted: number;
      pendingCredits: number;
    }
  | { ok: false; reason: "service_role_missing" | "not_found" | "db_error"; error?: string };

// ─── code generation ──────────────────────────────────────────────────────────

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Generate a random 8-char code (no ambiguous chars: 0/O, 1/I/l). */
export function generateCode(): string {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}

// ─── createOrGetReferralCode ──────────────────────────────────────────────────

/**
 * Idempotent: returns the user's existing code if one exists, otherwise
 * generates and inserts one. The referrer must have an account ≥7 days
 * old to prevent throwaway accounts from farming referral credits.
 *
 * Retries once on code collision (astronomically unlikely for 8-char
 * from 55-char alphabet = 55^8 ≈ 1.7T possibilities, but safe to handle).
 */
export async function createOrGetReferralCode(userId: string): Promise<GenerateResult> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return { ok: false, reason: "service_role_missing" };

  // 1. Check existing
  const { data: existing, error: fetchErr } = await sb
    .from("referrals")
    .select("code")
    .eq("referrer_id", userId)
    .maybeSingle();

  if (fetchErr) return { ok: false, reason: "db_error", error: fetchErr.message };
  if (existing) return { ok: true, code: existing.code, created: false };

  // 2. Enforce 7-day account age
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) return { ok: false, reason: "db_error", error: profileErr.message };

  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  if (createdAt) {
    const ageDays = (Date.now() - createdAt.getTime()) / 86_400_000;
    if (ageDays < REFERRAL_MINIMUM_ACCOUNT_AGE_DAYS) {
      return { ok: false, reason: "account_too_new" };
    }
  }

  // 3. Insert new code (retry once on collision)
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateCode();
    const { error: insertErr } = await sb
      .from("referrals")
      .insert({ referrer_id: userId, code });

    if (!insertErr) return { ok: true, code, created: true };

    // 23505 = unique_violation — code collision, retry
    if ((insertErr as { code?: string }).code !== "23505") {
      return { ok: false, reason: "db_error", error: insertErr.message };
    }
  }

  return { ok: false, reason: "db_error", error: "code_collision_after_retry" };
}

// ─── redeemReferralCode ───────────────────────────────────────────────────────

/**
 * Redeem a referral code on behalf of a newly-registered user.
 *
 * Called from `POST /api/referral/redeem` after the referee completes
 * onboarding. Validates the code, checks anti-abuse rules, inserts a
 * `referral_credits` row, and increments the referrer's `total_redeemed`
 * counter. Does NOT grant Pro yet — that waits for ENG-198.
 */
export async function redeemReferralCode(code: string, refereeId: string): Promise<RedeemResult> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return { ok: false, reason: "service_role_missing" };

  // 1. Look up the referral row
  const { data: referral, error: lookupErr } = await sb
    .from("referrals")
    .select("id, referrer_id, flagged_at, total_redeemed, total_reward_days_granted")
    .eq("code", code.trim())
    .maybeSingle();

  if (lookupErr) return { ok: false, reason: "db_error", error: lookupErr.message };
  if (!referral) return { ok: false, reason: "code_not_found" };
  if (referral.flagged_at) return { ok: false, reason: "code_flagged" };

  // 2. No self-referral
  if (referral.referrer_id === refereeId) return { ok: false, reason: "self_referral" };

  // 3. Reward cap: referrer cannot exceed 365 days total
  if (referral.total_reward_days_granted >= REFERRAL_MAX_REWARD_DAYS) {
    return { ok: false, reason: "referrer_cap_reached" };
  }

  // 4. Check if referee already has a referral_credits row
  const { data: existing } = await sb
    .from("referral_credits")
    .select("id")
    .eq("referee_id", refereeId)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_redeemed" };

  // 5. Determine reward days: 60 if referee is already a paid user
  const { data: refProfile } = await sb
    .from("profiles")
    .select("user_tier")
    .eq("id", refereeId)
    .maybeSingle();
  const refereeDays =
    refProfile?.user_tier === "pro" || refProfile?.user_tier === "base"
      ? REFERRAL_DAYS_ALREADY_PAID
      : REFERRAL_DAYS_NEW;
  const referrerDays = REFERRAL_DAYS_NEW;

  // 6. Insert credit row
  const { error: insertErr } = await sb.from("referral_credits").insert({
    referrer_id: referral.referrer_id,
    referee_id: refereeId,
    code,
    referrer_days: referrerDays,
    referee_days: refereeDays,
  });

  if (insertErr) {
    // 23505 = unique_violation on referee_id → already redeemed (race)
    if ((insertErr as { code?: string }).code === "23505") {
      return { ok: false, reason: "already_redeemed" };
    }
    return { ok: false, reason: "db_error", error: insertErr.message };
  }

  // 7. Increment referrer counters (best-effort — non-fatal if it fails)
  await sb
    .from("referrals")
    .update({
      total_redeemed: referral.total_redeemed + 1,
      total_reward_days_granted: referral.total_reward_days_granted + referrerDays,
    })
    .eq("id", referral.id);

  return { ok: true, referrerId: referral.referrer_id, referrerDays, refereeDays };
}

// ─── getReferralStatus ────────────────────────────────────────────────────────

export async function getReferralStatus(userId: string): Promise<StatusResult> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return { ok: false, reason: "service_role_missing" };

  const { data, error } = await sb
    .from("referrals")
    .select("code, total_redeemed, total_reward_days_granted")
    .eq("referrer_id", userId)
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error", error: error.message };
  if (!data) return { ok: false, reason: "not_found" };

  const { count: pending } = await sb
    .from("referral_credits")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId)
    .is("reward_granted_at", null);

  return {
    ok: true,
    code: data.code,
    totalRedeemed: data.total_redeemed,
    totalRewardDaysGranted: data.total_reward_days_granted,
    pendingCredits: pending ?? 0,
  };
}
