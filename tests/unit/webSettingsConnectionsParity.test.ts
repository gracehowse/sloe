/**
 * ENG-1200 — Web Settings: Connections parity (Household + Apple Health).
 *
 * Web `Settings.tsx` was missing the Connections rows mobile ships in
 * `SettingsBundleContent` (Household + Apple Health), so web users could
 * not reach household management from Settings and had no honest Apple
 * Health status. This pins the parity wiring (source-check, matching the
 * sibling `settingsDestructiveCopy.test.ts` style — Settings is a large
 * client component that's awkward to mount in jsdom, so the suite asserts
 * on the source the way the destructive-zone suite does):
 *
 *  - a Connections section exists, gated behind the rollout flag so the
 *    structural change ramps via PostHog (feature-flag rule);
 *  - the Household row hands off to the proven `?view=household-settings`
 *    flow and reuses the shared sharing-preset subtitle helper, so the
 *    member count + preset label stay in lockstep with Profile + mobile;
 *  - the Household row hides when the user isn't in a household (no solo
 *    row — mobile + Profile behaviour);
 *  - the Apple Health row is informational only (HealthKit is iOS-only)
 *    — it opens an honest explainer dialog, never a fake connect toggle.
 *
 * Drift in any of these will fail the suite.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings — Connections section (ENG-1200 parity)", () => {
  it("renders a Connections section gated behind the rollout flag", () => {
    // The structural/navigation addition ships behind a flag; the old
    // path (no Connections section) stays alive when it's off.
    expect(SRC).toContain('isFeatureEnabled("web_settings_connections_v1")');
    expect(SRC).toMatch(/connectionsEnabled \?/);
    expect(SRC).toMatch(/data-testid="settings-connections-card"/);
    expect(SRC).toMatch(/>Connections<\/h3>/);
  });

  it("Household row hands off to the proven ?view=household-settings flow", () => {
    expect(SRC).toContain('data-testid="settings-household-row"');
    expect(SRC).toContain('href="/home?view=household-settings"');
  });

  it("Household subtitle reuses the shared sharing-preset helper (lockstep with Profile + mobile)", () => {
    expect(SRC).toContain("sharingPresetShortLabel(preset)");
    expect(SRC).toContain(
      '`${count} ${count === 1 ? "person" : "people"} · ${sharingPresetShortLabel(preset)}`',
    );
  });

  it("Household row hides when the user is not in a household", () => {
    // The row only renders inside the `householdSummary ?` branch — same
    // as mobile + Profile (no solo invite row).
    expect(SRC).toMatch(
      /householdSummary \?[\s\S]{0,400}?data-testid="settings-household-row"/,
    );
  });

  it("Apple Health row is informational only and opens an honest explainer", () => {
    expect(SRC).toContain('data-testid="settings-apple-health-row"');
    // Tapping opens the explainer dialog, not a connect action.
    expect(SRC).toContain("setAppleHealthInfoOpen(true)");
    expect(SRC).toContain('data-testid="settings-apple-health-info-dialog"');
    // Honest copy: iOS-only, read-only on web.
    expect(SRC).toContain("HealthKit is");
    expect(SRC).toMatch(/iOS-only/);
  });

  it("Apple Health row wires no Switch / connect toggle (web cannot connect HealthKit)", () => {
    const idx = SRC.indexOf('data-testid="settings-apple-health-row"');
    expect(idx).toBeGreaterThan(-1);
    // Window the row's button block; it must not embed a <Switch …/> the
    // way the real preference toggles do.
    const rowBlock = SRC.slice(idx, idx + 700);
    expect(rowBlock).not.toMatch(/<Switch\b/);
  });
});
