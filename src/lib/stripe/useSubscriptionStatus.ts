"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase/browserClient";
import type {
  ManagedVia,
  SubscriptionSummary,
} from "./subscriptionCardView";

/**
 * `useSubscriptionStatus` (ENG-748 #11) — client hook that fetches the
 * provider-authoritative subscription status from
 * `/api/stripe/subscription-status` for the Settings subscription card.
 *
 * The route is read-only (the Stripe Customer Portal owns mutations);
 * this hook just surfaces the current state with explicit loading /
 * error handling so the card can render the right of the four legal
 * states without ever inventing a number.
 *
 * `canceling` is derived from `cancelAtPeriodEnd` and returned as its
 * own boolean so the consuming component can never confuse a
 * cancelled-but-still-active subscription with a Free user (legal P0
 * AR-7 — canceled-but-active must read "cancelled, access until [date]",
 * never "renews").
 */

export type SubscriptionStatusState = {
  loading: boolean;
  /** Non-null when the fetch failed or the route reported `ok: false`. */
  error: string | null;
  subscription: SubscriptionSummary | null;
  managedVia: ManagedVia;
  /** `STRIPE_TAX_ENABLED` surfaced from the route (legal P0 PX-2). */
  taxEnabled: boolean;
  /** Derived from `subscription.cancelAtPeriodEnd`. True only when a
   *  Stripe subscription exists AND is set to cancel at period end. */
  canceling: boolean;
  /** Re-run the fetch (e.g. after returning from the Stripe portal). */
  refetch: () => void;
};

type RouteResponse = {
  ok?: boolean;
  subscription?: SubscriptionSummary | null;
  managedVia?: ManagedVia;
  taxEnabled?: boolean;
  error?: string;
};

/**
 * @param enabled — gate the fetch. The Settings card passes
 *   `userTier !== "free"` so we never call the route for Free users.
 *   When false the hook reports a settled, non-loading "none" state.
 */
export function useSubscriptionStatus(enabled: boolean): SubscriptionStatusState {
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [managedVia, setManagedVia] = useState<ManagedVia>("none");
  const [taxEnabled, setTaxEnabled] = useState<boolean>(false);
  // Bumped to trigger a refetch; also lets us ignore stale responses.
  const [nonce, setNonce] = useState(0);
  const activeRef = useRef(true);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) {
      // Settled Free state — nothing to fetch.
      setLoading(false);
      setError(null);
      setSubscription(null);
      setManagedVia("none");
      return () => {
        activeRef.current = false;
      };
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          if (!activeRef.current) return;
          setError("not_authenticated");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/stripe/subscription-status", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = (await res.json()) as RouteResponse;
        if (!activeRef.current) return;

        // Always surface managedVia + taxEnabled even on a non-ok
        // response so the card can still pick the IAP / portal-fallback
        // branch rather than rendering a blank error.
        setManagedVia(data.managedVia ?? "none");
        setTaxEnabled(Boolean(data.taxEnabled));
        setSubscription(data.subscription ?? null);

        if (!res.ok || data.ok === false) {
          setError(data.error ?? "subscription_status_failed");
        } else {
          setError(null);
        }
      } catch {
        if (!activeRef.current) return;
        setError("network_error");
      } finally {
        if (activeRef.current) setLoading(false);
      }
    })();

    return () => {
      activeRef.current = false;
    };
  }, [enabled, nonce]);

  const canceling = Boolean(subscription?.cancelAtPeriodEnd);

  return {
    loading,
    error,
    subscription,
    managedVia,
    taxEnabled,
    canceling,
    refetch,
  };
}
