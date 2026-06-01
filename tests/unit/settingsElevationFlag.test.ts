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
  it("derives the resting-card class from design_system_elevation", () => {
    expect(settings).toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
    expect(settings).toContain("settingsCardClass");
    expect(settings).toContain("settingsHeroCardClass");
  });

  it("flag-ON path uses the soft-elevation token and drops the border", () => {
    expect(settings).toContain("shadow-[var(--elev-card-soft)]");
    expect(settings).toMatch(/elevation\s*\n?\s*\?\s*"bg-card rounded-2xl border-0 shadow-\[var\(--elev-card-soft\)\]"/);
  });

  it("flag-OFF path preserves today's static card-elevated + border", () => {
    expect(settings).toContain(
      "bg-card border border-border rounded-2xl card-elevated",
    );
  });

  it("no resting card hardcodes the old always-on card-elevated string anymore", () => {
    // The literal `card-elevated"` class only survives inside the flag-OFF
    // fallback string (which ends in `card-elevated`, no closing quote in the
    // className literal). A leftover `card-elevated"` in a className= attr means
    // a card escaped the flag wiring.
    expect(settings).not.toMatch(/className="[^"]*card-elevated"/);
    expect(settings).not.toMatch(/className="[^"]*card-elevated-hero[^"]*"/);
  });

  it("SubscriptionCard is flag-aware too (web billing parity surface)", () => {
    expect(subCard).toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
    expect(subCard).toContain("shadow-[var(--elev-card-soft)]");
    expect(subCard).not.toMatch(/className="[^"]*card-elevated"/);
  });

  it("the soft-elevation token is declared in theme.css", () => {
    expect(themeCss).toContain("--elev-card-soft");
  });
});
