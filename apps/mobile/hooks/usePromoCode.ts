import { useCallback, useState } from "react";
import { Alert } from "react-native";

/**
 * Shared promo-code redemption hook for mobile surfaces.
 *
 * Extracted from `apps/mobile/app/(tabs)/settings.tsx` as part of D9
 * (promo-move backlog 2026-04-21). Now consumed by both Settings and
 * the paywall promo expander. When S1 lands, Settings drops its copy
 * and only the paywall + this hook remain.
 *
 * Contract:
 *   - `code` + `setCode`: controlled TextInput state
 *   - `submitting`: true while the RPC is in flight
 *   - `redeem()`: runs `supabase.rpc("redeem_promo_code")`, shows the
 *     appropriate Alert, returns `{ ok, tier? }` so callers can react
 *     (e.g. paywall closes on success, Settings updates its local
 *     tier badge).
 *
 * Callers own UI chrome (inputs, buttons, expand-collapse). This hook
 * only owns state + the RPC call + the Alert-based feedback loop.
 */

/**
 * PostgREST sometimes returns jsonb as object, string, or a
 * single-element array. Normalise to a typed payload shape.
 * Exported for direct unit-testing (T1 in the D9 backlog).
 */
export function normalizeRedeemPromoRpcData(data: unknown): {
  ok: boolean;
  tier?: string;
  error?: string;
} | null {
  let cur: unknown = data;
  if (Array.isArray(cur) && cur.length === 1) cur = cur[0];
  for (let i = 0; i < 3; i++) {
    if (typeof cur !== "string") break;
    try {
      cur = JSON.parse(cur) as unknown;
    } catch {
      return null;
    }
  }
  if (cur == null || typeof cur !== "object") return null;
  const o = cur as Record<string, unknown>;
  const okRaw = o.ok;
  const ok = okRaw === true || okRaw === "true";
  const tier = typeof o.tier === "string" ? o.tier : undefined;
  const error = typeof o.error === "string" ? o.error : undefined;
  return { ok, tier, error };
}

export function messageForPromoError(error: string | undefined): string {
  switch (error) {
    case "invalid_or_expired":
      return "That code is not valid, has expired, or has reached its use limit.";
    case "not_authenticated":
      return "Sign in again, then try the code.";
    case "invalid_code":
      return "Enter a promo code.";
    default:
      return "That code could not be applied. Check for typos and try again.";
  }
}

export function normalizeUserTier(raw: string | null | undefined): "free" | "base" | "pro" {
  const t = String(raw ?? "free")
    .toLowerCase()
    .trim();
  if (t === "pro" || t === "base" || t === "free") return t;
  return "free";
}

export type PromoRedeemResult =
  | { ok: true; tier: "free" | "base" | "pro" }
  | { ok: false };

// Minimal structural shape of the Supabase client methods we call.
// Kept loose to avoid dragging supabase types into this module (which
// would re-introduce a side-effectful import at module top-level).
type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
};

export type UsePromoCodeOptions = {
  userId: string | null | undefined;
  /** Optional Supabase client override — used by tests. */
  client?: SupabaseLike;
  /** Optional alert shim — used by tests. */
  alert?: (title: string, message?: string) => void;
};

export function usePromoCode({ userId, client, alert }: UsePromoCodeOptions) {
  // Lazy-load the real Supabase client only when no override is supplied.
  // Keeps the module importable in environments (e.g. vitest) that can't
  // eagerly construct the client at `@/lib/supabase` load time.
  const supabase: SupabaseLike =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    client ?? (require("@/lib/supabase").supabase as SupabaseLike);
  const showAlert = alert ?? ((t: string, m?: string) => Alert.alert(t, m));

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redeem = useCallback(async (): Promise<PromoRedeemResult> => {
    if (!userId || !code.trim()) return { ok: false };
    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("redeem_promo_code", {
        p_code: code.trim().toUpperCase(),
      });
      if (rpcErr) {
        showAlert("Could not redeem", rpcErr.message || "Check your connection and try again.");
        return { ok: false };
      }
      const payload = normalizeRedeemPromoRpcData(data);
      if (payload?.ok) {
        const { data: prof, error: refetchErr } = await supabase
          .from("profiles")
          .select("user_tier")
          .eq("id", userId)
          .maybeSingle();
        if (refetchErr) {
          showAlert(
            "Redeemed",
            "Your code was applied. Restart the app if your plan badge does not update.",
          );
          setCode("");
          // Without a refetch we don't know the verified tier; treat as
          // free-tier no-op for caller logic but still signal success so
          // paywall-style consumers close.
          return { ok: true, tier: "free" };
        }
        const verified = normalizeUserTier(
          (prof as { user_tier?: string } | null)?.user_tier,
        );
        const label = verified === "pro" ? "Pro" : verified === "base" ? "Base" : "Free";
        showAlert("Success", `Your plan is now ${label}.`);
        setCode("");
        return { ok: true, tier: verified };
      }
      showAlert("Could not apply code", messageForPromoError(payload?.error));
      return { ok: false };
    } catch {
      showAlert("Error", "Could not redeem code.");
      return { ok: false };
    } finally {
      setSubmitting(false);
    }
  }, [userId, code, supabase, showAlert]);

  return { code, setCode, submitting, redeem };
}
