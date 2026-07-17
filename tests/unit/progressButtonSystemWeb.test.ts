/**
 * Progress lane (WEB + MOBILE parity) — SOLID-PRIMARY / GHOST button system
 * (2026-06-12, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The Progress CTAs were migrated from raw outline pills
 * (`border-[1.5px] border-primary-solid text-primary-solid`) to the shared
 * `SupprButton` grammar, identically on web and mobile:
 *   - "Log weight" — conformed to the v3 prototype's QUIET treatment
 *     (`btn--secondary`) → `variant="ghost"` (ENG-1247): transparent, plum
 *     label, no fill — the trend chart is the weight card's hero, not the
 *     logging button.
 *   - inline-edit "Save" (Steps / Body fat, web-only — mobile has no equivalent
 *     inline-edit surface) → `variant="ghost"`: transparent, plum label, no border.
 *
 * Sanctioned NON-migrations (must stay as-is): the Calendar icon-only button
 * (`h-9 w-9`, no text label) and the hydration-stimulants quick-add preset
 * chips (tinted-fill quick-actions) — neither is a SupprButton.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const WEB = read("src/app/components/ProgressDashboard.tsx");
// The inline Log-weight row (input + ghost button + coaching line) was
// extracted into ProgressWeightLogRow (ENG-1504) so the sparse/empty state
// can hide it behind its in-frame CTA without growing the pinned host.
const WEB_LOG_ROW = read("src/app/components/suppr/progress-weight-log-row.tsx");
// The Steps + Body-Fat inputs (legacy, flag-off path) were extracted into the
// ProgressActivitySection child (ENG-1225 gap #21); their Save CTAs live there.
const WEB_ACTIVITY = read("src/app/components/suppr/progress-activity-section.tsx");
const MOBILE = read("apps/mobile/app/(tabs)/progress.tsx");
const WEB_PRIMITIVE = read("src/app/components/suppr/suppr-button.tsx");
const MOBILE_PRIMITIVE = read("apps/mobile/components/ui/SupprButton.tsx");

describe("Progress CTAs — solid primary / ghost (button system 2026-06-12)", () => {
  it("web imports the shared web SupprButton primitive", () => {
    expect(WEB_LOG_ROW).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("mobile imports the shared mobile SupprButton primitive", () => {
    expect(MOBILE).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("web 'Log weight' is a QUIET ghost (v3 prototype — chart is the hero)", () => {
    expect(WEB_LOG_ROW).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}onSave[\s\S]{0,200}Log weight/,
    );
    // Host still wires the same logical action through the extracted row.
    expect(WEB).toMatch(/onSave=\{\(\) => void saveTodayWeight\(\)\}/);
  });

  it("mobile 'Log weight' is a QUIET ghost with the same logical action", () => {
    expect(MOBILE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,320}Log weight/,
    );
    // Handler + testID preserved through the treatment change.
    expect(MOBILE).toMatch(/testID="progress-log-weight"/);
    expect(MOBILE).toMatch(/setLogWeightOpen\(true\)/);
  });

  it("web inline 'Save' (Steps + Body fat) are GHOST secondaries", () => {
    // Now in the extracted ProgressActivitySection (flag-off legacy path).
    expect(WEB_ACTIVITY).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,120}saveTodaySteps\(\)[\s\S]{0,40}>\s*Save\s*<\/SupprButton>/);
    expect(WEB_ACTIVITY).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,120}saveBodyFat\(\)[\s\S]{0,40}>\s*Save\s*<\/SupprButton>/);
  });

  it("the migrated Progress CTAs no longer carry the retired outline pill", () => {
    // Web: the aubergine-outline className is gone from the migrated commits.
    expect(WEB).not.toMatch(/border-\[1\.5px\]\s+border-primary-solid/);
    // Mobile: the outline border on the weight CTA is gone.
    expect(MOBILE).not.toMatch(/borderColor:\s*t\.accentSolid/);
    expect(MOBILE).not.toMatch(/borderWidth:\s*1\.5/);
  });

  it("SANCTIONED: the Calendar icon-only button stays a raw icon button (not migrated)", () => {
    // h-9 w-9 icon-only affordance — no text label, intentionally left as-is.
    expect(WEB).toMatch(/data-testid="progress-calendar-button"[\s\S]{0,500}h-9 w-9/);
  });

  it("cross-platform parity: both primitives expose the identical variant contract", () => {
    expect(WEB_PRIMITIVE).toMatch(/SupprButtonVariant\s*=\s*"primary"\s*\|\s*"ghost"/);
    expect(MOBILE_PRIMITIVE).toMatch(/SupprButtonVariant\s*=\s*"primary"\s*\|\s*"ghost"/);
    // Primary = solid fill + white label on both.
    expect(WEB_PRIMITIVE).toMatch(/bg-primary-solid[\s\S]{0,40}text-white/);
    expect(MOBILE_PRIMITIVE).toMatch(/isPrimary\s*\?\s*accent\.primarySolid\s*:\s*"transparent"/);
  });
});
