/**
 * ActivityLevelPreview adoption pin (build 10 fix E-2, 2026-04-19).
 *
 * Closes TestFlight `AIIm60n` + `AHCSYMATS` — the tester had no in-app
 * surface to change her stored `activity_level`, so her Maintenance
 * number stayed stuck at 1,900.
 *
 * The fix shipped a shared `ActivityLevelPreview` component (one web
 * copy under `src/app/components/suppr/activity-level-preview.tsx`,
 * one mobile copy under `apps/mobile/components/ActivityLevelPreview.tsx`)
 * and wired it into four surfaces:
 *   - mobile onboarding (activity step)
 *   - mobile Settings (new Activity level row)
 *   - web onboarding (Goal & Activity card)
 *   - web Settings (new Activity level row)
 *
 * This structural test pins adoption: each of the four consumer files
 * must import (and render) the shared component. Same style as
 * `keyboardSafeViewAdoption.test.ts` — source-level grep, not a
 * runtime render.
 *
 * Web parity: enforced here too (web consumer paths included) so the
 * web onboarding + settings can't silently regress to an inline copy.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(__dirname, "../..");
const REPO_ROOT = resolve(MOBILE_ROOT, "../..");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

type Consumer = {
  label: string;
  path: string;
  root: string;
  /** Regex(es) — file must contain at least one match to count as an
   *  import of the shared component. */
  importPatterns: RegExp[];
  /** Render tag must appear somewhere in the (comment-stripped) source. */
  renderTag: RegExp;
};

const CONSUMERS: readonly Consumer[] = [
  {
    label: "mobile onboarding",
    path: "apps/mobile/app/onboarding.tsx",
    root: REPO_ROOT,
    importPatterns: [/from\s+["']@\/components\/ActivityLevelPreview["']/],
    renderTag: /<ActivityLevelPreview\b/,
  },
  {
    label: "mobile Settings",
    path: "apps/mobile/app/(tabs)/settings.tsx",
    root: REPO_ROOT,
    importPatterns: [/from\s+["']@\/components\/ActivityLevelPreview["']/],
    renderTag: /<ActivityLevelPreview\b/,
  },
  {
    // Web `/onboarding` is now a 307 redirect to `/onboarding/v2` (see
    // app/onboarding/page.tsx). The legacy 4-step form lives in
    // `app/onboarding/legacy-form.tsx` for emergency rollback only —
    // pin its imports here so the shared ActivityLevelPreview can't
    // silently regress to an inline copy on the rollback path.
    label: "web onboarding (legacy fallback form)",
    path: "app/onboarding/legacy-form.tsx",
    root: REPO_ROOT,
    importPatterns: [
      /from\s+["']\.\.\/\.\.\/src\/app\/components\/suppr\/activity-level-preview(?:\.tsx)?["']/,
    ],
    renderTag: /<ActivityLevelPreview\b/,
  },
  {
    label: "web Settings",
    path: "src/app/components/Settings.tsx",
    root: REPO_ROOT,
    importPatterns: [
      // Web Settings consumes the picker dialog, which is the
      // component that wraps ActivityLevelPreview. This guarantees
      // the shared math chain reaches the Settings screen.
      /from\s+["']\.\/suppr\/activity-level-picker-dialog["']/,
    ],
    renderTag: /<ActivityLevelPickerDialog\b/,
  },
];

describe("ActivityLevelPreview adoption — build 10 fix E-2", () => {
  for (const c of CONSUMERS) {
    describe(c.label, () => {
      const absPath = resolve(c.root, c.path);
      const src = readFileSync(absPath, "utf8");
      const code = stripComments(src);

      it("imports the shared component (no inline copy)", () => {
        const matched = c.importPatterns.some((pat) => pat.test(src));
        expect(matched).toBe(true);
      });

      it("renders the shared component tag", () => {
        expect(code).toMatch(c.renderTag);
      });
    });
  }

  it("picker dialog on web renders the shared preview (one chain, not two)", () => {
    const absPath = resolve(
      REPO_ROOT,
      "src/app/components/suppr/activity-level-picker-dialog.tsx",
    );
    const src = readFileSync(absPath, "utf8");
    const code = stripComments(src);
    expect(src).toMatch(/from\s+["']\.\/activity-level-preview["']/);
    expect(code).toMatch(/<ActivityLevelPreview\b/);
  });
});
