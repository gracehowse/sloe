"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState, type ReactNode } from "react";
import { getConsentChoice } from "./CookieConsent";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!key) {
      setReady(true);
      return;
    }
    const consent = getConsentChoice();
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      // Start opted out if no consent yet or explicitly declined
      opt_out_capturing_by_default: consent !== "accepted",
    });
    // If user already accepted, opt back in (handles returning visitors)
    if (consent === "accepted") {
      posthog.opt_in_capturing();
    }
    setReady(true);
  }, []);

  // Re-check consent when it changes (user interacts with banner in the same tab)
  useEffect(() => {
    if (!ready) return;
    function onConsent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted" && posthog.has_opted_out_capturing?.()) {
        posthog.opt_in_capturing();
      } else if (detail === "declined" && !posthog.has_opted_out_capturing?.()) {
        posthog.opt_out_capturing();
      }
    }
    window.addEventListener("suppr-consent", onConsent);
    return () => window.removeEventListener("suppr-consent", onConsent);
  }, [ready]);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) {
    return children;
  }
  if (!ready) {
    return children;
  }
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
