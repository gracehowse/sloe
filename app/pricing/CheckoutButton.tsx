"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info.tsx";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);

export function CheckoutButton({
  tier,
  period = "monthly",
  label,
  highlighted,
}: {
  tier: "base" | "pro" | null;
  period?: "monthly" | "annual";
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
        body: JSON.stringify({ tier, period }),
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`block w-full text-center px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60 ${
        highlighted
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/25"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {busy ? "Opening checkout..." : label}
    </button>
  );
}
