import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../utils/supabase/publicConfig.ts";
import * as Sentry from "@sentry/nextjs";

/** Re-exported from the shared resolver; kept here for existing import sites. */
export { supabasePublicUrl };

export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(supabasePublicUrl(), supabasePublicAnonKey());
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
 * Reassemble the Supabase session cookie value from a raw Cookie header.
 *
 * ENG-1308: Supabase's cookie storage (`@supabase/ssr`) chunks large
 * sessions (e.g. Google OAuth with a provider token) into
 * `sb-<ref>-auth-token.0`, `.1`, … once the serialized value exceeds the
 * per-cookie size cap. The previous single-regex match grabbed one
 * fragment, JSON.parse failed on the partial JSON, the fragment was then
 * treated as a bare JWT, and validation 401'd every request for those
 * users. This parses the header into name/value pairs, collects ALL
 * auth-token cookies, orders chunks numerically, and concatenates their
 * URL-decoded values (matching `combineChunks` in `@supabase/ssr`).
 *
 * Deliberately excludes `sb-<ref>-auth-token-code-verifier` (PKCE
 * verifier, not a session) via the end-anchored name pattern.
 */
function combineSupabaseAuthCookies(cookieHeader: string): string | null {
  const chunks: Array<{ index: number; value: string }> = [];
  let unchunked: string | null = null;

  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const rawValue = pair.slice(eq + 1).trim();
    // Ref segment allows hyphens (custom-domain storage keys derive the
    // ref from the first hostname label); the end anchor is what keeps
    // `…-auth-token-code-verifier` out, not the ref charset.
    const m = name.match(/^sb-[A-Za-z0-9-]+-auth-token(?:\.(\d+))?$/);
    if (!m) continue;

    let value: string;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      continue; // malformed percent-encoding — skip this cookie
    }

    if (m[1] === undefined) {
      unchunked = value;
    } else {
      chunks.push({ index: Number(m[1]), value });
    }
  }

  // A complete unchunked cookie wins; otherwise stitch the chunks in
  // numeric order (string sort would put .10 before .2).
  if (unchunked !== null) return unchunked;
  if (chunks.length === 0) return null;
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map((c) => c.value).join("");
}

/**
 * Extract the access token from a reassembled Supabase session cookie
 * value. Handles the three shapes Supabase has shipped:
 *   - `base64-<base64url(JSON session object)>` (current `@supabase/ssr`)
 *   - plain JSON session object `{ access_token: … }`
 *   - legacy JSON array `[access_token, refresh_token, …]`
 * Falls back to treating the value as a bare JWT only when it is
 * JWT-shaped (three dot-separated segments).
 */
function accessTokenFromSessionCookie(value: string): string | null {
  let raw = value;
  if (raw.startsWith("base64-")) {
    try {
      const b64 = raw.slice("base64-".length).replace(/-/g, "+").replace(/_/g, "/");
      raw = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    if (parsed !== null && typeof parsed === "object") {
      const token = (parsed as { access_token?: unknown }).access_token;
      return typeof token === "string" ? token : null;
    }
    if (typeof parsed === "string") return parsed;
    return null;
  } catch {
    // Not JSON — only accept a bare JWT-shaped value.
    return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw) ? raw : null;
  }
}

/**
 * Extract user ID from a Request — tries Authorization header first (mobile),
 * then Supabase session cookies (web). Returns null if unauthenticated.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1. Try Authorization: Bearer <token> (mobile app sends this)
  const fromHeader = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (fromHeader) return fromHeader;

  // 2. Try Supabase session cookies (web app — middleware refreshes these).
  //    Chunk-aware per ENG-1308: see combineSupabaseAuthCookies.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionValue = combineSupabaseAuthCookies(cookieHeader);
  if (!sessionValue) return null;

  const token = accessTokenFromSessionCookie(sessionValue);
  if (!token) return null;

  return getUserIdFromAuthHeader(`Bearer ${token}`);
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
