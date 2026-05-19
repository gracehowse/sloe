"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useFeatureFlagEnabled } from "posthog-js/react";
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
  // T2.2 (premium-sweep-v2 P0): when ON, bolden the Pro CTA's
  // visual weight and demote the Free CTA further so the Pro card
  // unambiguously wins the eye-path. Audit claim of "Free CTA
  // dominates the page" was likely a viewport-clipping artifact
  // (Pro CTA went off-screen at the captured 1280/1920 desktop
  // heights), but bumping Pro and softening Free is cheap insurance.
  // When OFF: existing styling (gradient violet for Pro, slate-100
  // for Free) preserved.
  const boldenHierarchy = useFeatureFlagEnabled("premium-sweep-v2-p0-t22");

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

  // Tailwind v4 doesn't reliably generate v3 gradient syntax classes
  // (`bg-gradient-to-r from-violet-600 to-indigo-600`) on demand —
  // they appeared in the className but the computed bg was
  // transparent. Inline style guarantees the rendering, light + dark.
  const proStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(to right, #7c3aed, #4f46e5)",
    color: "#ffffff",
    boxShadow: boldenHierarchy
      ? "0 10px 24px rgba(124, 58, 237, 0.40), inset 0 0 0 1px rgba(255, 255, 255, 0.12)"
      : "0 6px 18px rgba(124, 58, 237, 0.25)",
  };
  const freeStyle: React.CSSProperties = boldenHierarchy
    ? {
        background: "transparent",
        color: "var(--muted-foreground)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }
    : {
        background: "var(--accent)",
        color: "var(--foreground)",
      };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="block w-full text-center px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60"
      style={highlighted ? proStyle : freeStyle}
    >
      {busy ? "Opening checkout..." : label}
    </button>
  );
}
