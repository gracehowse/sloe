/**
 * Settings — Manage subscription opens the cancel-flow export prompt
 * dialog, then routes to the Stripe portal.
 *
 * History:
 *   - 2026-04-30 P0-1: Pro users got an in-app cancel path on web. The
 *     "Your plan" card surfaced a `Link` straight to `/account/billing`.
 *   - 2026-05-02 (PR replaces #43): the Link became a button that opens
 *     the Suppr-owned `<CancelExportPromptDialog>` first (two
 *     equal-weight cards; "Continue to manage" navigates to
 *     `/account/billing`). Closed journey-architect P1.
 *   - 2026-05-27 (ENG-748 #11): the manage/cancel control moved out of
 *     the "Your plan" card and into the dedicated
 *     `<SubscriptionCard>` (`settings/SubscriptionCard.tsx`), which
 *     renders the full billing state. Settings wires the card's
 *     `onManageSubscription` prop to fire `setCancelPromptOpen(true)`
 *     — the SAME cancel-flow export prompt → portal path. The "Your
 *     plan" card keeps only the at-a-glance tier pill + the Free "View
 *     plans" link; there is exactly ONE manage path so two cancel
 *     controls can't compete.
 *
 * The tests below confirm:
 *   1. The SubscriptionCard is mounted in Settings, gated on
 *      `userTier !== "free"`.
 *   2. Its `onManageSubscription` is wired to `setCancelPromptOpen(true)`
 *      (no direct nav; the dialog owns the route).
 *   3. The legacy in-card `settings-manage-subscription-button` is
 *      gone — the manage control lives in one place now.
 *   4. View plans Link is still gated on `userTier === "free"`.
 *   5. The CancelExportPromptDialog is mounted exactly once.
 *   6. The dialog's onContinueToManage routes to `/account/billing`
 *      via `window.location.href` (hard nav — destination is outside
 *      the SPA shell).
 *
 * Source-level structural test — keeps fast and avoids the deep
 * AppDataContext stack the full Settings tree depends on. The
 * SubscriptionCard's own render behaviour is pinned by
 * `tests/unit/subscriptionCard.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings — Manage subscription via SubscriptionCard → cancel-flow export prompt (ENG-748 #11)", () => {
  it("mounts <SubscriptionCard> gated on userTier !== 'free'", () => {
    expect(SRC).toMatch(
      /\{userTier !== "free" \? \(\s*<SubscriptionCard/,
    );
  });

  it("wires SubscriptionCard.onManageSubscription to setCancelPromptOpen(true) (dialog-first, not direct nav)", () => {
    // The card's manage CTA must NOT navigate directly to
    // /account/billing — the cancel-flow export prompt dialog owns the
    // route. This pin catches the regression where someone re-points
    // onManageSubscription straight at the portal and short-circuits
    // the export prompt.
    expect(SRC).toMatch(
      /onManageSubscription=\{[\s\S]{0,400}?setCancelPromptOpen\(true\)/,
    );
  });

  it("does not re-introduce a second manage control in the 'Your plan' card", () => {
    // The legacy in-card button moved into SubscriptionCard. Two
    // competing cancel controls is a legal-UX regression (one clear
    // path). Guard that the old testID does not come back.
    expect(SRC).not.toContain('data-testid="settings-manage-subscription-button"');
  });

  it("the View plans link is gated on userTier === 'free'", () => {
    expect(SRC).toMatch(/\{userTier === "free" && \(\s*<Link\s+href="\/pricing"/);
  });

  it("the CancelExportPromptDialog is mounted once in the component", () => {
    // Exactly one mount — guards against double-mount drift if a
    // refactor copies the JSX and forgets to delete the original.
    const matches = SRC.match(/<CancelExportPromptDialog\s/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it("the dialog's onContinueToManage routes to /account/billing via window.location.href", () => {
    // Hard nav (not Link) because /account/billing is the
    // server-component Stripe Customer Portal shell — leaving the
    // SPA shell is intentional.
    expect(SRC).toMatch(
      /onContinueToManage[\s\S]{0,800}?window\.location\.href\s*=\s*"\/account\/billing"/,
    );
  });
});
