"use client";

import { useState } from "react";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";

// ENG-1470: was `createClient(...)` from `@supabase/supabase-js` (default
// localStorage session storage) — invisible to the real app's cookie-backed
// session, so an already-logged-in user clicking a paid-tier CTA here was
// silently bounced to /login instead of proceeding straight to Stripe
// checkout. Now imports the shared cookie-backed client instead.

export function CheckoutButton({
  tier,
  period = "monthly",
  currency = "GBP",
  label,
  highlighted,
  emphasis = "auto",
}: {
  tier: "base" | "pro" | null;
  period?: "monthly" | "annual";
  /** ENG-667 — pass detected region currency so EU visitors hit EUR SKUs. */
  currency?: "GBP" | "EUR" | "USD";
  label: string;
  highlighted: boolean;
  /**
   * ENG-1460 — "one filled CTA per screen": when the `/pricing` hero
   * already renders the ONE filled CTA (`PricingHeroCta`), the tier-card
   * CTAs below must not compete with a second filled pill. `"auto"`
   * (default) keeps the pre-ENG-1460 behaviour (`highlighted` → filled);
   * `"outline"` forces the calmer bordered treatment regardless of
   * `highlighted`, for exactly this "a filled CTA already exists above"
   * case. `"filled"` forces filled — reserved for a future single-CTA
   * surface with no hero (unused today, kept for symmetry).
   */
  emphasis?: "auto" | "filled" | "outline";
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!tier) {
      // Free tier — just go to signup
      window.location.href = "/login";
      return;
    }

    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        // Not logged in — send to login with return URL
        window.location.href = `/login?redirect=/pricing`;
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier,
          period,
          ...(currency === "EUR" ? { currency: "EUR" } : {}),
        }),
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

      track(AnalyticsEvents.checkout_started, { tier, period });
      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // SLOE DS: primary tier CTA is the solid clay action pill; the secondary
  // (Free) CTA is a cream slab. Replaces the violet→indigo gradient + slate
  // set with semantic Sloe tokens. ENG-1460: `emphasis="outline"` forces a
  // bordered, unfilled treatment — the tier-card CTA when the hero above
  // already owns the one filled CTA on the page.
  const resolvedFilled = emphasis === "auto" ? highlighted : emphasis === "filled";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`block w-full text-center px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60 ${
        resolvedFilled
          ? "hover:opacity-95"
          : "border hover:bg-[var(--background-secondary)]"
      }`}
      style={
        resolvedFilled
          ? {
              background: "var(--accent-primary)",
              color: "var(--accent-primary-foreground)",
            }
          : {
              background: "transparent",
              color: "var(--foreground)",
              borderColor: "var(--border)",
            }
      }
    >
      {busy ? "Opening checkout..." : label}
    </button>
  );
}
