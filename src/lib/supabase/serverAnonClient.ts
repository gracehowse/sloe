import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import * as Sentry from "@sentry/nextjs";

export function supabasePublicUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${projectId}.supabase.co`;
}

export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(supabasePublicUrl(), publicAnonKey);
}

/** Service role client for server-only reads after the caller has verified `userId` (e.g. from JWT). */
export function createSupabaseServiceRoleClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabasePublicUrl(), key, { auth: { persistSession: false } });
}

/** Validate a Supabase JWT from `Authorization: Bearer …` and return the user id. */
export async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

/**
 * Extract user ID from a Request — tries Authorization header first (mobile),
 * then Supabase session cookies (web). Returns null if unauthenticated.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1. Try Authorization: Bearer <token> (mobile app sends this)
  const fromHeader = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (fromHeader) return fromHeader;

  // 2. Try Supabase session cookies (web app — middleware refreshes these)
  const cookieHeader = req.headers.get("cookie") ?? "";
  const accessTokenMatch = cookieHeader.match(/sb-[^-]+-auth-token[^=]*=([^;]+)/);
  if (accessTokenMatch) {
    try {
      // The cookie value may be a JSON-encoded array where [0] is the access token
      const raw = decodeURIComponent(accessTokenMatch[1]);
      let token: string | null = null;
      try {
        const parsed = JSON.parse(raw);
        token = Array.isArray(parsed) ? parsed[0] : typeof parsed === "string" ? parsed : null;
      } catch {
        token = raw;
      }
      if (token) {
        return getUserIdFromAuthHeader(`Bearer ${token}`);
      }
    } catch {
      // Cookie parse failed — fall through
    }
  }

  return null;
}

export type UserTier = "free" | "base" | "pro";

/**
 * Tiers that resolve to full Pro entitlements. `lifetime_pro` is the durable
 * founding-cohort comp granted via `redeem_promo_code` (ENG-1043 / monetisation
 * sequencing §1) — it gates identically to `pro` everywhere and is never
 * downgraded by a webhook. Any feature gate that reads `getUserTier() === "pro"`
 * therefore covers lifetime founders without further branching.
 */
const PRO_EQUIVALENT_TIERS = new Set(["pro", "lifetime_pro"]);

/**
 * Look up user tier from profiles. Uses the service role key so RLS does not hide the row
 * (call only after `userId` is verified via `getUserIdFromRequest` / JWT).
 * Without `SUPABASE_SERVICE_ROLE_KEY`, returns `"free"` (log in development).
 *
 * Note: `lifetime_pro` is normalised to `"pro"` here so every Pro-gated call
 * site treats founding-cohort comps as Pro with zero new branching.
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getUserTier] SUPABASE_SERVICE_ROLE_KEY unset; defaulting tier to free");
    }
    return "free";
  }
  const { data, error } = await sb.from("profiles").select("user_tier").eq("id", userId).maybeSingle();
  if (error) {
    // ENG-688: emit to Sentry so a DB/RLS failure that silently downgrades
    // a paid user to free is visible in the error dashboard.
    Sentry.captureException(new Error(`[getUserTier] profiles read failed: ${error.message}`), {
      extra: { userId, supabaseCode: error.code },
      fingerprint: ["getUserTier-profiles-read-failed"],
    });
    return "free";
  }
  const tier = data?.user_tier as string | undefined;
  // `lifetime_pro` (founding-cohort comp, ENG-1043) gates as Pro everywhere.
  if (tier && PRO_EQUIVALENT_TIERS.has(tier)) return "pro";
  if (tier === "base") return "base";
  return "free";
}
