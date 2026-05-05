"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "suppr_cookie_consent";

export type ConsentChoice = "accepted" | "declined" | null;

export function getConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "accepted" || v === "declined") return v;
  return null;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsentChoice()) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    window.dispatchEvent(new CustomEvent("suppr-consent", { detail: "accepted" }));
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    window.dispatchEvent(new CustomEvent("suppr-consent", { detail: "declined" }));
    setVisible(false);
    // Disable PostHog if already loaded
    try {
      const posthog = (window as unknown as Record<string, unknown>).posthog as
        | { opt_out_capturing?: () => void }
        | undefined;
      posthog?.opt_out_capturing?.();
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  // Audit 2026-05-04 #24 + #36: previously a centred floating card
  // (`max-w-lg mx-auto rounded-2xl`) that overlapped the Pro tier card
  // on `/pricing`, masked roadmap items, and obscured landing-hero
  // proof-points. Now a slim full-width bottom strip — matches the
  // mobile-web pattern, doesn't z-index over content, and the buttons
  // sit inline at the right so the body copy gets the full width.
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1">
          Suppr uses essential cookies to keep you signed in. With your consent we also load optional analytics
          (PostHog) and error reporting (Sentry). These stay off until you accept.{" "}
          <Link href="/privacy" className="text-primary dark:text-primary underline">
            Privacy
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={accept}
            className="px-3 py-1.5 bg-primary text-white text-xs sm:text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
