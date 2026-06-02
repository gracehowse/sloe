/**
 * ENG-823 (Redesign — Design Direction 2026, 2026-05-31 design-director review)
 * — web Settings soft-elevation is flag-gated.
 *
 * The 5-spine direction wants one elevation model: a soft ambient shadow with
 * NO border on every resting card. Web Settings previously used the static
 * `card-elevated` utility (always-on `--shadow` + a competing `border-border`
 * = a double edge). This pins that the resting cards now derive their class
 * from `design_system_elevation`:
 *   - flag ON  → `--elev-card-soft` shadow, border dropped.
 *   - flag OFF → today's `card-elevated` + border (preserved until ramp).
 *
 * Parity with the mobile `SettingsCard` wrapper + `useCardElevation` hook.
 * Source-level structural check — no React rendering.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const SETTINGS_PATH = resolve(ROOT, "src/app/components/Settings.tsx");
const SUBCARD_PATH = resolve(
  ROOT,
  "src/app/components/settings/SubscriptionCard.tsx",
);
const THEME_PATH = resolve(ROOT, "src/styles/theme.css");

const settings = readFileSync(SETTINGS_PATH, "utf8");
const subCard = readFileSync(SUBCARD_PATH, "utf8");
const themeCss = readFileSync(THEME_PATH, "utf8");

describe("web Settings elevation flag (ENG-823)", () => {
  it("routes its resting cards through the canonical SupprCard primitive", () => {
    // ENG-823 → ENG-822 (Design Direction 2026): resting cards no longer
    // hand-roll a `settingsCardClass` / `settingsHeroCardClass` ternary — they
    // go through <SupprCard>, which owns the design_system_elevation flag-gate
    // internally. The inner divide-y settings *groups* (not resting cards) are
    // not SupprCards and keep their own inline gate.
    expect(settings).toContain("<SupprCard");
    expect(settings).toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("no resting card hardcodes the old always-on card-elevated string anymore", () => {
    // The literal `card-elevated"` class only survives inside the flag-OFF
    // fallback string (which ends in `card-elevated`, no closing quote in the
    // className literal). A leftover `card-elevated"` in a className= attr means
    // a card escaped the flag wiring.
    expect(settings).not.toMatch(/className="[^"]*card-elevated"/);
    expect(settings).not.toMatch(/className="[^"]*card-elevated-hero[^"]*"/);
  });

  it("SubscriptionCard is routed through SupprCard too (web billing parity surface)", () => {
    // The billing card was migrated from a hand-rolled cardClass div to
    // <SupprCard padding="lg" radius="xl"> — elevation now comes from the
    // primitive, so no inline flag read or card-elevated literal remains.
    expect(subCard).toContain("<SupprCard");
    expect(subCard).not.toMatch(/className="[^"]*card-elevated"/);
  });

  it("the soft-elevation token is declared in theme.css", () => {
    expect(themeCss).toContain("--elev-card-soft");
  });
});
