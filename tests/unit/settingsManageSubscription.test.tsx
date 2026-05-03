/**
 * Settings — Manage subscription opens cancel-flow export prompt
 * dialog (PR replaces #43, 2026-05-02).
 *
 * History:
 *   - 2026-04-30 P0-1: Pro users finally got an in-app cancel path on
 *     web. The "Your plan" card surfaced a `Link` straight to
 *     `/account/billing` (Stripe Customer Portal shell).
 *   - 2026-05-02 (this PR, replaces stale PR #43): the Link is
 *     replaced with a button that opens the Suppr-owned
 *     `<CancelExportPromptDialog>` first. Two equal-weight cards;
 *     the dialog's "Continue to manage" CTA is what now navigates to
 *     `/account/billing`. Closes journey-architect P1 — surfaces the
 *     data-export prompt AT the cancel touchpoint instead of leaving
 *     it buried in Settings → Privacy & Security.
 *
 *   The gate also widened from `userTier === "pro"` to
 *   `userTier !== "free"` — base-tier users (legacy Stripe webhook
 *   safety branch) reach the same surface; free users still see "View
 *   plans" → `/pricing`.
 *
 * The tests below confirm:
 *   1. Manage subscription button has the canonical testID.
 *   2. The button is wired to open `setCancelPromptOpen(true)` (no
 *      direct nav; the dialog owns the route).
 *   3. Copy stays "Manage subscription" — Stripe / iOS Settings own
 *      the word "Cancel".
 *   4. The button is gated on `userTier !== "free"`.
 *   5. View plans Link is gated on `userTier === "free"`.
 *   6. The CancelExportPromptDialog is mounted once in the component.
 *   7. The dialog's onContinueToManage routes to `/account/billing`
 *      via `window.location.href` (hard nav, not Link, because the
 *      destination is outside the SPA shell).
 *
 * Source-level structural test — keeps fast and avoids the deep
 * AppDataContext stack the full Settings tree depends on.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings — Manage subscription opens cancel-flow export prompt (PR replaces #43, 2026-05-02)", () => {
  it("renders a Manage subscription button with the canonical testID", () => {
    expect(SRC).toContain('data-testid="settings-manage-subscription-button"');
  });

  it("the Manage subscription button opens setCancelPromptOpen(true) (dialog-first, not direct nav)", () => {
    // The button must NOT navigate directly to /account/billing —
    // the cancel-flow export prompt dialog owns the route. This pin
    // catches the regression where someone re-introduces a Link
    // alongside the button and short-circuits the export prompt.
    expect(SRC).toMatch(
      /data-testid="settings-manage-subscription-button"[\s\S]{0,400}?setCancelPromptOpen\(true\)/,
    );
  });

  it("uses 'Manage subscription' copy (Stripe / iOS Settings own 'Cancel')", () => {
    const block = SRC.match(
      /\{userTier !== "free" && \(\s*<button[\s\S]*?<\/button>\s*\)\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("Manage subscription");
    // The button itself does not say "Cancel" — Stripe / iOS Settings
    // own that word.
    expect(block![0]).not.toContain(">Cancel<");
  });

  it("the Manage subscription button is gated on userTier !== 'free'", () => {
    // Widened from `userTier === "pro"` (2026-04-30) to
    // `userTier !== "free"` (2026-05-02) so base-tier safety-branch
    // users also reach the cancel-flow export prompt.
    expect(SRC).toMatch(
      /\{userTier !== "free" && \(\s*<button\s+type="button"\s+data-testid="settings-manage-subscription-button"/,
    );
  });

  it("the View plans link is gated on userTier === 'free'", () => {
    // Mirror guard for the free-tier branch.
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
