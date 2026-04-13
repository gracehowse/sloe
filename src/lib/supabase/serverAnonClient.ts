import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";

export function supabasePublicUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${projectId}.supabase.co`;
}

export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(supabasePublicUrl(), publicAnonKey);
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

/** Look up user tier from profiles table. Returns "free" if not found. */
export async function getUserTier(userId: string): Promise<UserTier> {
  const supabase = createSupabaseAnonClient();
  const { data } = await supabase.from("profiles").select("user_tier").eq("id", userId).maybeSingle();
  const tier = data?.user_tier as string | undefined;
  if (tier === "pro" || tier === "base") return tier;
  return "free";
}
