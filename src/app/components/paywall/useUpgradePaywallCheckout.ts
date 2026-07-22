"use client";

/**
 * ENG-1459 — Stripe checkout for the Free→Pro upsell. Mirrors
 * `handleStartCheckout` in `upgrade-paywall-dialog.tsx` exactly (same
 * endpoint, payload, analytics, error handling) so the onboarding
 * terminal step's inline paywall content (`UpgradePaywallContent`, flag
 * `onboarding_upgrade_inline_paywall_v1`) hits the identical checkout
 * path the dialog already ships. See `UpgradePaywallContent.tsx`'s
 * doc comment for why the dialog itself isn't refactored onto this hook
 * in this change — the hook is written so a future, separately-reviewed
 * PR could do that migration.
 */
import { useCallback, useState, type RefObject } from "react";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../lib/analytics/events.ts";
import { track } from "../../../lib/analytics/track.ts";
import type { TrialEndReminderUpgradeBlockHandle } from "./TrialEndReminderUpgradeBlock.tsx";

/** Single canonical variant after PR-01 — see `upgrade-paywall-dialog.tsx`. */
export type UpgradePaywallVariant = "free_to_pro";
export type UpsellUserTier = "free" | "base";

export interface UseUpgradePaywallCheckoutArgs {
  from: PaywallViewedFrom;
  userTier: "free" | "base" | "pro";
  period: "monthly" | "annual";
  variant: UpgradePaywallVariant | null;
  /** `surface` tag on `checkout_started`/`upsell_variant_converted` — lets
   *  callers (modal vs. onboarding-inline) keep analytics honest about
   *  which surface actually converted (legal C10). */
  surface: string;
  trialReminderRef: RefObject<TrialEndReminderUpgradeBlockHandle | null>;
}

export function useUpgradePaywallCheckout({
  from,
  userTier,
  period,
  variant,
  surface,
  trialReminderRef,
}: UseUpgradePaywallCheckoutArgs) {
  const [busy, setBusy] = useState(false);

  const handleStartCheckout = useCallback(async () => {
    if (busy || !variant) return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        // Not logged in — send to login with return URL preserving the
        // pricing origin so the user resumes at /pricing post-auth.
        window.location.href = `/login?redirect=/pricing?from=${from}`;
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: "pro", period }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        alert(data.message ?? data.error ?? "Checkout is unavailable right now. Please try again.");
        return;
      }
      await trialReminderRef.current?.persistBeforeCheckout(
        supabase,
        sessionData.session?.user?.id,
      );
      // Legacy `checkout_started` — unchanged shape.
      track(AnalyticsEvents.checkout_started, { tier: "pro", period, from });
      // `upsell_variant_converted` — always `free_to_pro` post-PR-01.
      track(AnalyticsEvents.upsell_variant_converted, {
        variant,
        from,
        target_tier: "pro",
        period,
        surface,
        platform: "web",
        user_tier: userTier as UpsellUserTier,
      });
      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, from, variant, userTier, period, surface, trialReminderRef]);

  return { busy, handleStartCheckout };
}
