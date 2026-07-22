/**
 * ENG-1642 — meal share links: thin Supabase RPC client + the signed-out
 * resume-rail localStorage helpers.
 *
 * Pure glue only — wire parsing lives in `./mealShareLink.ts`. `rpc` is
 * injected via `SupabaseRpcLike` (mirrors `src/lib/referrals/referralClient.ts`)
 * so this module stays testable without a live Supabase client, and works
 * identically whether `supabase` is signed-in or signed-out (the browser
 * client uses the anon key either way — `get_meal_share` is anon-callable).
 */

import {
  MEAL_SHARE_STORAGE_KEY,
  normaliseMealShareToken,
  parseMealShareLookup,
  type MealShareLookup,
  type MealShareListRow,
} from "./mealShareLink.ts";

export type SupabaseRpcLike = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function asRecord(data: unknown): Record<string, unknown> {
  return data != null && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

/**
 * Calls `create_meal_share`. Network/RPC failure collapses to
 * `{ status: "error" }` — distinct from the RPC's own validation statuses
 * (`invalid_title` / `invalid_slot` / `invalid_items` / `rate_limited` /
 * `not_authenticated`), which pass through unchanged for the caller to
 * branch on.
 */
export async function createMealShare(
  supabase: SupabaseRpcLike,
  input: { title: string; mealSlot: string; items: Record<string, unknown>[] },
): Promise<{ status: string; token?: string; shareId?: string }> {
  const { data, error } = await supabase.rpc("create_meal_share", {
    p_title: input.title,
    p_meal_slot: input.mealSlot,
    p_items: input.items,
  });
  if (error) return { status: "error" };

  const r = asRecord(data);
  const status = String(r.status ?? "error");
  const result: { status: string; token?: string; shareId?: string } = { status };
  if (typeof r.token === "string" && r.token) result.token = r.token;
  if (typeof r.share_id === "string" && r.share_id) result.shareId = r.share_id;
  return result;
}

/**
 * Calls `get_meal_share`. The token is normalised (32-hex) BEFORE any
 * network call — a malformed token never reaches the RPC and resolves to
 * `{ status: "invalid" }` synchronously (well, still async-shaped, but no
 * round trip). A network/RPC error also collapses to `"invalid"` — the
 * landing page can't distinguish "bad link" from "network hiccup" without a
 * retry affordance neither surface has, so treating both as the safe
 * default (never claim a share is valid when we can't confirm it) is
 * correct here.
 */
export async function getMealShare(
  supabase: SupabaseRpcLike,
  rawToken: string,
): Promise<MealShareLookup> {
  const token = normaliseMealShareToken(rawToken);
  if (!token) return { status: "invalid" };

  const { data, error } = await supabase.rpc("get_meal_share", { p_token: token });
  if (error) return { status: "invalid" };
  return parseMealShareLookup(data);
}

/** Calls `revoke_meal_share`. Network/RPC failure collapses to `"error"`. */
export async function revokeMealShare(
  supabase: SupabaseRpcLike,
  shareId: string,
): Promise<{ status: string }> {
  const cleanId = shareId.trim();
  if (!cleanId) return { status: "invalid" };

  const { data, error } = await supabase.rpc("revoke_meal_share", {
    p_share_id: cleanId,
  });
  if (error) return { status: "error" };
  return { status: String(asRecord(data).status ?? "error") };
}

/**
 * Supabase-js-compatible shape for a plain table `.select()` — mirrors
 * `SupabaseLike` in `src/lib/nutrition/savedMeals.ts`. Typed as `any` on
 * `.from()`'s return on purpose, same reason as that file: no import from
 * either workspace's generated types.
 */
export type SupabaseSelectLike = {
  from: (table: string) => any;
};

/**
 * ENG-1648 — "My shared links" list. Reads the caller's OWN `meal_shares`
 * rows straight off the table (RLS `meal_shares_select_own`: `created_by =
 * auth.uid()`) — a self-read needs no RPC. Never selects `items` (the list
 * surface's field set is title/slot/created/expires/state only) or `token`
 * (the link stays exposed only at share time, not in the management list).
 * Bounded to 200 rows, newest first — a defensive-read guard, not
 * pagination. Collapses any Supabase error to `{ status: "error" }`.
 */
export async function listMealShares(
  supabase: SupabaseSelectLike,
  userId: string,
): Promise<{ status: "ok"; rows: MealShareListRow[] } | { status: "error" }> {
  const cleanId = userId.trim();
  if (!cleanId) return { status: "error" };

  const { data, error } = await supabase
    .from("meal_shares")
    .select("id, title, meal_slot, created_at, expires_at, revoked_at")
    .eq("created_by", cleanId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !Array.isArray(data)) return { status: "error" };

  const rows: MealShareListRow[] = data.map((r: any) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    mealSlot: String(r.meal_slot ?? ""),
    createdAt: String(r.created_at ?? ""),
    expiresAt: String(r.expires_at ?? ""),
    revokedAt: r.revoked_at ? String(r.revoked_at) : null,
  }));
  return { status: "ok", rows };
}

/**
 * Signed-out resume rail: the landing page stashes the token before
 * bouncing to `/signup` or `/login` (neither password form supports
 * `?next=`), and the Today surface drains it via `takePendingMealShare()`
 * once any auth path lands on `/home`. SSR-safe (`window` guard) + never
 * throws (private-browsing storage can reject writes).
 */
export function storePendingMealShare(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEAL_SHARE_STORAGE_KEY, token);
  } catch {
    /* storage unavailable — resume rail degrades to no-op, not a crash */
  }
}

/** Reads + clears the pending token in one call so it's never replayed twice. */
export function takePendingMealShare(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(MEAL_SHARE_STORAGE_KEY);
    if (value) window.localStorage.removeItem(MEAL_SHARE_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
