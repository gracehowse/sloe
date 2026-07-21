"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  COOKIE_CONSENT_SCROLL_INSET_VAR,
  isMobileWebProductRoute,
  MOBILE_WEB_CONSENT_BANNER_INSET,
  MOBILE_WEB_CONSENT_DOCK_BOTTOM,
} from "../../lib/layout/mobileWebBottomChrome.ts";
import { SupprPlateMark } from "./ui/suppr-mark.tsx";

const CONSENT_KEY = "suppr_cookie_consent";

export type ConsentChoice = "accepted" | "declined" | null;

export function getConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * ENG-1318 — single write path for the consent choice, shared by the
 * banner and the Settings "Usage analytics & replay" toggle (mirror of
 * mobile's `setAnalyticsConsent`, which the prompt + row both use).
 * Persists the choice, notifies `AnalyticsProvider` via the
 * `suppr-consent` event (live opt-in/opt-out, no reload), and
 * belt-and-braces opts PostHog out immediately on decline in case the
 * provider hasn't mounted its listener yet.
 */
export function setConsentChoice(choice: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* storage denied — in-memory choice still governs this session */
  }
  window.dispatchEvent(new CustomEvent("suppr-consent", { detail: choice }));
  if (choice === "declined") {
    try {
      const posthog = (window as unknown as Record<string, unknown>).posthog as
        | { opt_out_capturing?: () => void }
        | undefined;
      posthog?.opt_out_capturing?.();
    } catch {
      /* ignore */
    }
  }
}

function shouldShowConsentBanner(): boolean {
  return getConsentChoice() === null;
}

/** Marketing / legal surfaces — top-anchored so hero CTAs stay tappable (ENG-802). */
function isMarketingRoute(pathname: string): boolean {
  return !isMobileWebProductRoute(pathname);
}

export function CookieConsent() {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const onProductRoute = isMobileWebProductRoute(pathname);
  const liftAboveMobileChrome = visible && onProductRoute;
  const topAnchored = visible && isMarketingRoute(pathname);

  useEffect(() => {
    setHydrated(true);
    setVisible(shouldShowConsentBanner());

    function onConsent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted" || detail === "declined") {
        setVisible(false);
      }
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== CONSENT_KEY) return;
      setVisible(shouldShowConsentBanner());
    }

    window.addEventListener("suppr-consent", onConsent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("suppr-consent", onConsent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const inset =
      visible && onProductRoute ? MOBILE_WEB_CONSENT_BANNER_INSET : "0px";
    root.style.setProperty(COOKIE_CONSENT_SCROLL_INSET_VAR, inset);
    return () => {
      root.style.removeProperty(COOKIE_CONSENT_SCROLL_INSET_VAR);
    };
  }, [hydrated, onProductRoute, visible]);

  function accept() {
    setConsentChoice("accepted");
    setVisible(false);
  }

  function decline() {
    setConsentChoice("declined");
    setVisible(false);
  }

  if (!hydrated || !visible) return null;

  // Audit 2026-05-04 #24 + #36 (centred floating card → slim full-width
  // bottom strip): the floating card overlapped Pro tier, roadmap, and
  // landing-hero proof.
  // Audit 2026-05-12 (premium-bar Phase 2): tighten further — copy
  // halved, padding py-3 → py-2, buttons px-3 → px-2.5, flex-row on all
  // breakpoints. Target height ~52px on phone (was ~136px = 16% of
  // viewport). Linear / Notion / Vercel are all single-line bars; the
  // two consent buttons stay inline to satisfy UK/EU equal-prominence
  // (Accept all vs Essential only, both with the same visual weight on
  // their respective contrasts). `line-clamp-1` keeps the body to one
  // line and lets it ellipsis on the tightest screens rather than
  // wrap.
  // P5 parity #31 (2026-05-31): retoken the chrome off raw slate onto the
  // redesign design tokens — bg-card / border-border / muted text + the
  // --elev-sheet depth token, plus the quiet SupprPlateMark. No flag gate:
  // the banner must paint on first paint pre-consent. SupprPlateMark is
  // imported directly (not SupprMark, which evaluates the
  // design_system_brandmark flag).
  // ENG-1386: dock above the mobile product tab bar (5rem + safe-area,
  // shared with App.tsx) at z-40 so that nav (z-50, App.tsx:817) always
  // wins taps — this only applies to the liftAboveMobileChrome (product
  // route) case below.
  //
  // Top-anchored marketing routes are a different stacking context: they
  // sit under each marketing page's own sticky header, which is not the
  // z-50 "nav" the ENG-1386 rule above was written for, and has no "wins
  // taps" rationale — the consent banner is the thing that must be
  // interactable there. z-40 there let the landing page's own sticky
  // `.lp-nav` (landing.css, z-50) render on top of and fully obscure the
  // banner's buttons, making cookie consent uninteractive on `/` for real
  // visitors — a compliance-relevant bug caught 2026-07-21 once
  // dismissVisualOverlays' broken isVisible-as-a-wait no-op (fixed
  // alongside PR #1010) stopped silently skipping the click in tests. Use
  // z-[60] (matching the "always on top" tier already used by
  // upgrade-paywall-dialog.tsx / NotificationsBell.tsx) for topAnchored
  // only, so the bottom-docked mobile-product case above is untouched.
  return (
    <div
      data-testid="cookie-consent-banner"
      className={`fixed inset-x-0 bg-card/95 backdrop-blur border-border shadow-[var(--elev-sheet)] ${
        topAnchored
          ? "z-[60] top-0 border-b pt-[env(safe-area-inset-top)]"
          : liftAboveMobileChrome
            ? `z-40 ${MOBILE_WEB_CONSENT_DOCK_BOTTOM} border-t`
            : "z-40 bottom-0 border-t pb-[env(safe-area-inset-bottom)]"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-row items-center gap-3">
        <SupprPlateMark size={16} aria-hidden className="shrink-0" />
        <p className="text-xs text-muted-foreground flex-1 line-clamp-1 min-w-0">
          Essential cookies on; analytics stay off until you accept.{" "}
          <Link href="/privacy" className="text-primary-solid dark:text-primary-solid underline">
            Privacy
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-2.5 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-md hover:bg-muted/80 transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={accept}
            className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
