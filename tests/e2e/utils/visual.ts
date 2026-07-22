import type { Page } from "@playwright/test";

export const VISUAL_GOLDEN_NOW_ISO =
  process.env.E2E_VISUAL_NOW?.trim() || "2026-06-16T17:00:00.000Z";

export const REDESIGN_VISUAL_FLAGS = [
  "redesign_motion",
  "redesign_search_results",
  "redesign_winmoment",
  "web-meal-nutrition-detail",
  // ENG-1629 — default-OFF gutter convergence (Targets.tsx + RecipeDetail.tsx
  // onto `.product-shell`). Force it ON here so the committed cohesion-gate
  // baselines (`deep-recipe-detail-*.png`, `deep-targets-*.png`) capture the
  // converged state Grace will see once she ramps the flag in PostHog —
  // without this, the deep-authenticated captures would render the
  // unchanged flag-OFF gutter and the "regenerate baselines" step would be
  // a no-op. See the flag's full rationale in `src/lib/analytics/track.ts`.
  "web_gutter_convergence_v1",
] as const;

export type RedesignVisualFlag = (typeof REDESIGN_VISUAL_FLAGS)[number];

/**
 * Authed visual goldens must not drift with wall-clock time. Freeze before
 * navigation so the Today date strip, greeting, targets, and profile-derived
 * labels all hydrate against the same instant.
 */
export async function freezeVisualClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date(VISUAL_GOLDEN_NOW_ISO));
}

/**
 * Seed cookie-consent BEFORE navigation so the CookieConsent banner never
 * mounts. The component checks `getConsentChoice()` (localStorage
 * `suppr_cookie_consent`) in its mount `useEffect`; pre-seeding "accepted"
 * keeps `visible` false. This is race-free, unlike clicking "Accept all"
 * after goto (which loses to the banner's useEffect and leaves the transient,
 * position-variable banner in the shot — the dominant visual-regression diff +
 * flake on the public shell). Call BEFORE `page.goto`. See ENG-1191.
 */
export async function seedConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("suppr_cookie_consent", "accepted");
    } catch {
      /* ignore — storage may be unavailable on some routes */
    }
  });
}

/** Dismiss cookie banner and one-shot checklist overlays before screenshots.
 *  Every match is scoped to its genuine overlay container, not page-wide —
 *  an unscoped, unanchored `/keep going|continue|got it|close/i` here also
 *  matched the /login screen's dismiss X (app/login/ui.tsx, aria-label
 *  "Close"), whose onClose hard-navigates to "/", self-dismissing every
 *  /login and /signin visual capture to the marketing landing (same defect
 *  class already fixed in scripts/web-drive.mjs#dismissOverlays, 2026-07-01).
 *  "continue" is dropped entirely — it collides with real nav/auth CTAs
 *  ("Continue with email", pricing "Continue to checkout").
 *
 *  Every callsite here invokes this right after `page.goto(..., {
 *  waitUntil: "domcontentloaded" })` with no settle in between. `isVisible({
 *  timeout })` does NOT wait — Playwright's own types mark that option
 *  deprecated/ignored ("returns immediately") — so the old `isVisible`-based
 *  guards raced hydration and silently no-op'd before these one-shot
 *  overlays had mounted, leaking them into the golden screenshot instead of
 *  dismissing them (2026-07-21, same failure class as the settings
 *  two-pane-nav guard fixed alongside this). `waitFor({ state: "visible" })`
 *  genuinely retries for the given timeout before concluding "absent".
 *
 *  Every click below is bounded + caught, not bare, as defensive belt-and-
 *  braces for any one-shot overlay dismissal (not just this one).
 *
 *  Correction (2026-07-21, this pass): a prior version of this comment
 *  attributed the landing-page click hang to the ENG-1386 "nav (z-50)
 *  always wins taps" rule and treated it as intentional. That rule is
 *  about the MOBILE PRODUCT bottom tab bar (App.tsx:817, liftAboveMobileChrome
 *  docking) — a different component from the marketing landing page's own
 *  sticky `.lp-nav` header (landing.css, also z-50 for unrelated reasons),
 *  which is what the topAnchored banner collides with on `/`. There was no
 *  actual design intent for the landing page's own nav to beat the consent
 *  banner — verified live (screenshot + click) that real visitors could not
 *  interact with the banner at all on the landing page. Fixed at the root:
 *  CookieConsent.tsx now measures its own height and relocates `.lp-nav`
 *  below it (`--cookie-consent-top-inset`, landing.css) instead of raising
 *  either element's z-index — both stay z-40 as ENG-1386 intended, since
 *  neither needs to win a stacking fight once they don't share pixels. The
 *  bounded+caught click here stays regardless, as general defensive
 *  practice for a best-effort dismiss. */
export async function dismissVisualOverlays(page: Page): Promise<void> {
  const acceptBtn = page
    .locator('[data-testid="cookie-consent-banner"]')
    .getByRole("button", { name: /accept all/i });
  const hasAcceptBtn = await acceptBtn
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (hasAcceptBtn) {
    await acceptBtn.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  const dismissBtn = page
    .locator('[data-testid="first-run-checklist"]')
    .getByRole("button", { name: /dismiss checklist/i });
  const hasDismissBtn = await dismissBtn
    .waitFor({ state: "visible", timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (hasDismissBtn) {
    await dismissBtn.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  // Radix Dialog/AlertDialog content renders role="dialog" / "alertdialog" —
  // the only DOM contexts where a bare "Keep going" / "Got it" / "Close" is
  // a genuine one-shot overlay dismissal rather than page content or nav.
  const keepGoing = page
    .locator('[role="dialog"], [role="alertdialog"]')
    .getByRole("button", { name: /^(keep going|got it|close)$/i })
    .first();
  const hasKeepGoing = await keepGoing
    .waitFor({ state: "visible", timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (hasKeepGoing) {
    await keepGoing.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

/**
 * Hide DEV-ONLY chrome that pollutes design captures but never ships to users:
 * the Next.js dev error/build overlay (the red "N Issue(s)" badge — rendered in
 * the `nextjs-portal` web component) and the build-activity watcher. Uses
 * addInitScript so it re-applies on every navigation. Capture-only — do NOT fold
 * into dismissVisualOverlays (other visual tests must still see real overlays).
 * Call once BEFORE the first page.goto, like forceFlagsOn.
 */
export async function hideDevChrome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const STYLE_ID = "__suppr_hide_dev_chrome__";
    const apply = () => {
      if (document.getElementById(STYLE_ID)) return;
      const s = document.createElement("style");
      s.id = STYLE_ID;
      s.textContent =
        "nextjs-portal,#__next-build-watcher,[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none !important}";
      document.head?.appendChild(s);
    };
    if (document.head) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  });
}

/** Let fonts, charts, and client hydration settle before snapshot assertions. */
export async function stabilizeForScreenshot(
  page: Page,
  ms = 2500,
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

/**
 * Force PostHog feature flags on/off for a page, CLIENT-side, before any app
 * code runs. Seeds `window.__SUPPR_FORCE_FLAGS__`, which
 * `src/lib/analytics/track.ts#flagForceOverride` honours in non-production
 * builds. This is the only reliable way to capture flag-ON web goldens:
 * Next.js can't inline the computed `process.env["NEXT_PUBLIC_FLAG_FORCE_"+k]`
 * read into the client bundle, and the committed auth fixture seeds an empty
 * PostHog flag set — so without this, the browser only ever renders the
 * flag-OFF path (P5 parity worklist gaps #12/#13/#14/#16).
 *
 * Pair with the server-side `NEXT_PUBLIC_FLAG_FORCE_*` env (see the
 * `capture:redesign:*` npm scripts) so SSR and client agree and there is no
 * hydration flash. Call BEFORE `page.goto` — addInitScript applies to every
 * subsequent navigation in the page.
 */
export async function forceFlagsOn(
  page: Page,
  flags: readonly string[],
  on = true,
): Promise<void> {
  await page.addInitScript(
    ([flagList, value]) => {
      const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
      w.__SUPPR_FORCE_FLAGS__ = w.__SUPPR_FORCE_FLAGS__ ?? {};
      for (const f of flagList as string[]) {
        w.__SUPPR_FORCE_FLAGS__[f] = value as boolean;
      }
    },
    [flags, on] as const,
  );
}

/**
 * Force the redesign flag bundle ON for committed visual-regression goldens.
 * This covers the default-on redesign flags plus the web-only visual surfaces
 * that still have independent kill switches (subscription card and meal detail).
 */
export async function forceRedesignVisualFlagsOn(page: Page): Promise<void> {
  await forceFlagsOn(page, REDESIGN_VISUAL_FLAGS, true);
}
