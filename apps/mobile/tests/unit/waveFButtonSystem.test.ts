/**
 * Wave F (MOBILE) — Fasting + Health-sync + Targets + Weight + Profile +
 * What's-new CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * Wave F is the last batch of everyday CTAs to move off the retired aubergine
 * OUTLINE primary (`borderWidth: 1.5` + `borderColor: accent.primarySolid`,
 * plum label) onto the two SupprButton variants:
 *   - PRIMARY (a surface's ONE main commit/action) → `variant="primary"`:
 *     SOLID aubergine fill, white label, full pill, no border.
 *   - GHOST (secondaries / dismiss / read-out-screen recompute) →
 *     `variant="ghost"`: transparent, plum label, no border.
 *
 * These are source-level structural pins (mirror `plannerButtonSystemWeb` /
 * `fastingButtonSystem` / `settingsLaneAubergineOutline`). They break if any
 * Wave-F CTA regresses to the retired `accent.primarySolid` border outline or
 * a filled `accent.primary` slab so the migration can't silently drift.
 *
 * Web parity: only the fasting timer is a SupprButton-bearing Wave-F surface on
 * web (the rest are mobile-only native screens / a public What's-new page). It
 * is pinned in `tests/unit/waveFButtonSystemWeb.test.ts`.
 *
 * Overlap note: each CTA below is also covered in its own per-surface guard
 * (`fastingButtonSystem`, `settingsLaneAubergineOutline` for health-sync /
 * targets / profile, `todayLaneAubergineOutline` for What's-new). This file is
 * the Wave-F roll-up, and additionally owns the ONLY treatment pins for the
 * standalone `weight-tracker.tsx` Save and the `LogWeightSheet.tsx` Save-weight
 * commit, which previously had only behavioural press tests.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FASTING = read("app/fasting.tsx");
const HEALTH = read("app/health-sync.tsx");
const TARGETS = read("app/targets.tsx");
const PROFILE = read("app/profile.tsx");
const WEIGHT_TRACKER = read("app/weight-tracker.tsx");
const LOG_WEIGHT = read("components/progress/LogWeightSheet.tsx");
const WHATS_NEW = read("app/whats-new.tsx");

// The retired everyday aubergine OUTLINE primary, in both StyleSheet forms.
const OUTLINE_BORDER_COLOR = /borderColor:\s*(?:accent|Accent)\.primarySolid/;
const OUTLINE_BORDER_WIDTH = /borderWidth:\s*1\.5/;

describe("Wave F (mobile) — Fasting CTAs", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(FASTING).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Start fast' (landing) is a SOLID primary — the landing state's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton[\s\S]{0,200}testID="fasting-landing-start"[\s\S]{0,200}variant="primary"[\s\S]{0,200}label="Start fast"/,
    );
  });

  it("'End fast' (in-progress) is a SOLID primary", () => {
    expect(FASTING).toMatch(/<SupprButton\s+variant="primary"\s+style=\{styles\.endBtn\}/);
  });

  it("ANTI-REGRESSION: no fasting CTA falls back to the retired aubergine outline", () => {
    expect(FASTING).not.toMatch(OUTLINE_BORDER_COLOR);
    expect(FASTING).not.toMatch(OUTLINE_BORDER_WIDTH);
  });
});

describe("Wave F (mobile) — Health-sync CTAs", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(HEALTH).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Connect Health Data' is a SOLID primary (the disconnected-state action)", () => {
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}label="Connect Health Data"/,
    );
  });

  it("'Sync Now' is a SOLID primary (the connected-state action — same logical primary)", () => {
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}label="Sync Now"/,
    );
  });

  it("error 'Try again' is a GHOST — the error banner co-renders with the Connect/Sync primary, so both recovery actions are ghost (one-primary law)", () => {
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}testID="health-sync-error-retry"/,
    );
    // Must NOT be a second solid slab competing with Connect/Sync.
    expect(HEALTH).not.toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}testID="health-sync-error-retry"/,
    );
  });

  it("error 'Open iOS Settings' is a GHOST (the secondary recovery alternative)", () => {
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}testID="health-sync-error-open-settings"/,
    );
  });

  it("ANTI-REGRESSION: the retired hand-rolled outline styles are gone", () => {
    expect(HEALTH).not.toMatch(/btnOutline:\s*\{/);
    expect(HEALTH).not.toMatch(/btnOutlineText:\s*\{/);
  });
});

describe("Wave F (mobile) — Targets CTA", () => {
  it("'Recalculate' is a GHOST (secondary action on a read-out screen)", () => {
    expect(TARGETS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="targets-recalculate"/,
    );
  });

  it("ANTI-REGRESSION: Recalculate carries no retired aubergine outline border", () => {
    expect(TARGETS).not.toMatch(
      /testID="targets-recalculate"[\s\S]{0,400}borderColor:\s*accent\.primarySolid/,
    );
  });
});

describe("Wave F (mobile) — Profile CTAs", () => {
  it("'Save Targets' is a SOLID primary (the screen's ONE main commit)", () => {
    expect(PROFILE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}label="Save Targets"/,
    );
  });

  it("the Cancel sibling is a GHOST (the dismiss / revert path)", () => {
    expect(PROFILE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}label="Cancel"/,
    );
  });

  it("ANTI-REGRESSION: the retired hand-rolled save/cancel styles are gone", () => {
    expect(PROFILE).not.toMatch(/saveBtn:\s*\{/);
    expect(PROFILE).not.toMatch(/saveBtnText:\s*\{/);
    expect(PROFILE).not.toMatch(/cancelBtn:\s*\{/);
  });
});

describe("Wave F (mobile) — Weight-tracker Save (this file owns the only treatment pin)", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(WEIGHT_TRACKER).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("the inline 'Save' is a SOLID primary (the weight-tracker's ONE commit)", () => {
    expect(WEIGHT_TRACKER).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,160}onPress=\{\(\) => void saveWeight\(\)\}[\s\S]{0,120}label="Save"/,
    );
  });

  it("ANTI-REGRESSION: the weight Save carries no retired aubergine outline", () => {
    expect(WEIGHT_TRACKER).not.toMatch(OUTLINE_BORDER_COLOR);
    expect(WEIGHT_TRACKER).not.toMatch(OUTLINE_BORDER_WIDTH);
  });
});

describe("Wave F (mobile) — LogWeightSheet Save (this file owns the only treatment pin)", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(LOG_WEIGHT).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Save weight' / 'Update weigh-in' is a SOLID primary (the sheet's ONE commit)", () => {
    expect(LOG_WEIGHT).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}testID="log-weight-save"[\s\S]{0,160}label=\{isEditing \? "Update weigh-in" : "Save weight"\}/,
    );
  });

  it("ANTI-REGRESSION: the LogWeightSheet commit carries no retired aubergine outline", () => {
    expect(LOG_WEIGHT).not.toMatch(
      /testID="log-weight-save"[\s\S]{0,300}borderColor:\s*(?:accent|Accent)\.primarySolid/,
    );
  });
});

describe("Wave F (mobile) — What's-new dismiss", () => {
  it("'Done' is a GHOST (header dismiss, not a commit)", () => {
    expect(WHATS_NEW).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="whats-new-done"/,
    );
    expect(WHATS_NEW).toMatch(/<SupprButton[\s\S]{0,300}label="Done"/);
  });

  it("ANTI-REGRESSION: the Done pill carries no retired aubergine outline border", () => {
    expect(WHATS_NEW).not.toMatch(
      /testID="whats-new-done"[\s\S]{0,300}borderColor:\s*accent\.primarySolid/,
    );
  });
});
