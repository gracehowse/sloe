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

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 pointer-events-auto">
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
          Suppr uses essential cookies to keep you signed in. With your consent we also load optional analytics
          (PostHog) and error reporting (Sentry) to improve reliability. These stay off until you accept. See our{" "}
          <Link href="/privacy" className="text-primary dark:text-primary underline">
            privacy policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={accept}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Accept all
          </button>
          <button
            onClick={decline}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
