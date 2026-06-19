"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../utils/supabase/publicConfig.ts";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";

const supabase = createClient(supabasePublicUrl(), supabasePublicAnonKey());

export function CheckoutButton({
  tier,
  period = "monthly",
  currency = "GBP",
  label,
  highlighted,
}: {
  tier: "base" | "pro" | null;
  period?: "monthly" | "annual";
  /** ENG-667 — pass detected region currency so EU visitors hit EUR SKUs. */
  currency?: "GBP" | "EUR" | "USD";
  label: string;
  highlighted: boolean;
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
  // set with semantic Sloe tokens.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="block w-full text-center px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60 hover:opacity-95"
      style={
        highlighted
          ? {
              background: "var(--accent-primary)",
              color: "var(--accent-primary-foreground)",
            }
          : {
              background: "var(--background-secondary)",
              color: "var(--foreground)",
            }
      }
    >
      {busy ? "Opening checkout..." : label}
    </button>
  );
}
