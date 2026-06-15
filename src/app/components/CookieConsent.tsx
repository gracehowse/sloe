"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SupprPlateMark } from "./ui/suppr-mark.tsx";

const CONSENT_KEY = "suppr_cookie_consent";

export type ConsentChoice = "accepted" | "declined" | null;

export function getConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "accepted" || v === "declined") return v;
  return null;
}

/** ENG-633 — FAB + bottom nav sit above the consent strip on authed app routes. */
function isProductAppRoute(pathname: string): boolean {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return (
    seg === "today" ||
    seg === "plan" ||
    seg === "shopping" ||
    seg === "library" ||
    seg === "recipes" ||
    seg === "progress" ||
    seg === "settings" ||
    seg === "profile" ||
    seg === "recipe"
  );
}

/** Marketing / legal surfaces — top-anchored so hero CTAs stay tappable (ENG-802). */
function isMarketingRoute(pathname: string): boolean {
  return !isProductAppRoute(pathname);
}

export function CookieConsent() {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const liftAboveMobileChrome = visible && isProductAppRoute(pathname);
  const topAnchored = visible && isMarketingRoute(pathname);

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
  return (
    <div
      className={`fixed inset-x-0 z-50 bg-card/95 backdrop-blur border-border shadow-[var(--elev-sheet)] ${
        topAnchored
          ? "top-0 border-b pt-[env(safe-area-inset-top)]"
          : liftAboveMobileChrome
            ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] border-t pb-[env(safe-area-inset-bottom)]"
            : "bottom-0 border-t pb-[env(safe-area-inset-bottom)]"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-row items-center gap-3">
        <SupprPlateMark size={16} aria-hidden className="shrink-0" />
        <p className="text-xs text-muted-foreground flex-1 line-clamp-1 min-w-0">
          Essential cookies on; analytics stay off until you accept.{" "}
          <Link href="/privacy" className="text-primary dark:text-primary underline">
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
