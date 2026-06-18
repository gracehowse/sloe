import type { Page } from "@playwright/test";

export const VISUAL_GOLDEN_NOW_ISO =
  process.env.E2E_VISUAL_NOW?.trim() || "2026-06-16T17:00:00.000Z";

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

/** Dismiss cookie banner and one-shot checklist overlays before screenshots. */
export async function dismissVisualOverlays(page: Page): Promise<void> {
  const acceptBtn = page.getByRole("button", { name: /accept all/i });
  if (await acceptBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(400);
  }

  const dismissBtn = page.getByRole("button", { name: /dismiss checklist/i });
  if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissBtn.click();
    await page.waitForTimeout(400);
  }

  const keepGoing = page.getByRole("button", { name: /keep going|continue|got it|close/i }).first();
  if (await keepGoing.isVisible({ timeout: 1000 }).catch(() => false)) {
    await keepGoing.click().catch(() => undefined);
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
export async function stabilizeForScreenshot(page: Page, ms = 2500): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.evaluate(() => document.fonts?.ready);
  } catch {
    // Client navigations (e.g. /account/billing → /pricing) can destroy the context mid-wait.
    await page.waitForLoadState("domcontentloaded");
  }
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
  flags: string[],
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
