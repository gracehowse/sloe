/**
 * ENG-125 — web Profile "Daily Targets" row is wired to the targets editor.
 *
 * Before this change the "Daily Targets" row in the web Settings/Profile
 * surface (`src/app/components/Profile.tsx`) was a DEAD `<div>`: it carried
 * `cursor-pointer` + a forward chevron (implying navigation) but had no
 * `onClick` / `href`, so tapping it did nothing. Mobile's equivalent surface
 * (`apps/mobile/app/profile.tsx`) already opens the shared goal/pace editor
 * (`GoalPaceEditorSheet`), gated on the `goal_editor` flag.
 *
 * This test pins the wiring contract — and the web↔mobile parity — at the
 * source level (the same approach as `settingsProfileHeaderCardParity.test.ts`;
 * a DOM mount of `Profile` would need AppDataContext + supabase + posthog
 * mocks and would be brittle). It FAILS on revert because the old dead `<div>`
 * had no handler, no testID, and the dialog was never mounted.
 *
 *   1. The row is an interactive `<button>` with the canonical testID and an
 *      `openDailyTargets` click handler — not a dead `<div>`.
 *   2. `goal_editor` gates the destination: flag ON opens the shared
 *      `GoalPaceEditorDialog`; flag OFF opens the in-page manual Macro
 *      Calculator editor (never a dead row in either state).
 *   3. The `GoalPaceEditorDialog` is mounted and refreshes the targets on
 *      save (`refreshProfileBasics`) so the row summary + in-page editor
 *      reflect the recompute in place.
 *   4. The fibre / per-macro overrides handoff stays on the manual editor
 *      (`onCustomiseMacros`) — ENG-846 (fibre input) is out of scope here.
 *   5. Parity: mobile `profile.tsx` opens its editor gated on the same
 *      `goal_editor` flag.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const WEB_PROFILE = resolve(ROOT, "src/app/components/Profile.tsx");
const MOBILE_PROFILE = resolve(ROOT, "apps/mobile/app/profile.tsx");

const web = readFileSync(WEB_PROFILE, "utf8");
const mobile = readFileSync(MOBILE_PROFILE, "utf8");

describe("ENG-125 — web Daily Targets row is no longer dead", () => {
  it("renders the row as an interactive button with the canonical testID", () => {
    expect(web).toContain('data-testid="profile-daily-targets-row"');
    // The button carries the row's onClick handler — the dead `<div>` had none.
    expect(web).toMatch(
      /<button[^>]*data-testid="profile-daily-targets-row"[\s\S]*?onClick=\{openDailyTargets\}/,
    );
  });

  it("the row label is still 'Daily Targets' (copy preserved)", () => {
    expect(web).toMatch(/>Daily Targets</);
  });

  it("ships full interactive states (hover + focus-visible ring)", () => {
    expect(web).toMatch(
      /data-testid="profile-daily-targets-row"[\s\S]*?hover:bg-muted\/30[\s\S]*?focus-visible:ring-2[\s\S]*?focus-visible:ring-primary/,
    );
  });
});

describe("ENG-125 — goal_editor flag gates the destination", () => {
  it("reads the goal_editor flag via isFeatureEnabled", () => {
    expect(web).toMatch(/isFeatureEnabled\("goal_editor"\)/);
  });

  it("flag ON opens the shared GoalPaceEditorDialog; flag OFF opens the manual editor", () => {
    // openDailyTargets: goalEditorEnabled ? setGoalEditorOpen(true) : manual editor
    expect(web).toMatch(
      /const openDailyTargets = \(\) => \{[\s\S]*?if \(goalEditorEnabled\) \{[\s\S]*?setGoalEditorOpen\(true\);[\s\S]*?\} else \{[\s\S]*?openManualTargetsEditor\(\);/,
    );
  });

  it("the manual fallback arms the in-page targets editor (never a dead row)", () => {
    expect(web).toMatch(
      /const openManualTargetsEditor = \(\) => \{[\s\S]*?setActiveTab\("targets"\);[\s\S]*?setIsEditingTargets\(true\);/,
    );
    // Scroll anchor exists on the in-page editor so the fallback lands on it.
    expect(web).toContain('id="daily-targets-editor"');
  });
});

describe("ENG-125 — the shared editor dialog is mounted + refreshes on save", () => {
  it("imports and mounts GoalPaceEditorDialog (same editor as Targets.tsx)", () => {
    expect(web).toContain(
      'import { GoalPaceEditorDialog } from "./suppr/goal-pace-editor-dialog.tsx"',
    );
    expect(web).toMatch(/<GoalPaceEditorDialog[\s\S]*?open=\{goalEditorOpen\}/);
  });

  it("refreshes targets on save so the row summary updates in place", () => {
    expect(web).toMatch(
      /<GoalPaceEditorDialog[\s\S]*?onSaved=\{\(\) => \{[\s\S]*?refreshProfileBasics\(\)/,
    );
  });

  it("routes fibre / per-macro overrides to the manual editor (ENG-846 out of scope)", () => {
    expect(web).toMatch(
      /<GoalPaceEditorDialog[\s\S]*?onCustomiseMacros=\{\(\) => \{[\s\S]*?openManualTargetsEditor\(\)/,
    );
  });
});

describe("ENG-125 — web↔mobile parity", () => {
  it("mobile profile opens its editor gated on the same goal_editor flag", () => {
    expect(mobile).toMatch(/isFeatureEnabled\("goal_editor"\)/);
    expect(mobile).toMatch(/if \(goalEditorEnabled\) \{[\s\S]*?setGoalEditorOpen\(true\)/);
  });

  it("both platforms key the editor open-state off goalEditorOpen", () => {
    expect(web).toMatch(/const \[goalEditorOpen, setGoalEditorOpen\] = useState\(false\)/);
    expect(mobile).toMatch(/const \[goalEditorOpen, setGoalEditorOpen\] = useState\(false\)/);
  });
});
