"use client";

import * as React from "react";
import { Switch } from "../ui/switch";
import {
  getConsentChoice,
  setConsentChoice,
  type ConsentChoice,
} from "../CookieConsent.tsx";

/**
 * ENG-1318 — web Settings "Usage analytics & replay" toggle. Mirror of
 * mobile's `AnalyticsConsentRow` (apps/mobile/components/settings/
 * AnalyticsConsentRow.tsx): reflects the stored consent choice live and
 * writes flips through the same `setConsentChoice` path the cookie banner
 * uses, so `AnalyticsProvider`'s `suppr-consent` listener opts PostHog
 * in/out immediately — no reload required.
 *
 * Session replay rides the SAME consent (deliberately no separate replay
 * toggle — parity with mobile and with the AnalyticsProvider gate, where
 * `opt_out_capturing_by_default` covers events + replay together).
 *
 * Intentionally NO analytics event on toggle: capturing "user revoked
 * consent" would itself violate the revocation (same rule as mobile).
 */
export function AnalyticsConsentToggle() {
  const [consent, setConsent] = React.useState<ConsentChoice>(null);

  React.useEffect(() => {
    // Read after mount (SSR-safe) and stay in sync with the banner or any
    // other surface writing through `setConsentChoice`.
    setConsent(getConsentChoice());
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "accepted" || detail === "declined") setConsent(detail);
    };
    window.addEventListener("suppr-consent", onConsent);
    return () => window.removeEventListener("suppr-consent", onConsent);
  }, []);

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 mr-4">
        <label
          htmlFor="analytics-consent-toggle"
          className="block text-sm font-medium text-foreground cursor-pointer"
        >
          Usage analytics &amp; replay
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Anonymous usage analytics and masked session replay help improve
          Sloe. Off means nothing is collected.
        </p>
      </div>
      <Switch
        id="analytics-consent-toggle"
        aria-label="Usage analytics and replay"
        data-testid="settings-analytics-consent-toggle"
        checked={consent === "accepted"}
        onCheckedChange={(next) => {
          const choice = next ? "accepted" : "declined";
          setConsentChoice(choice);
          setConsent(choice);
        }}
      />
    </div>
  );
}
