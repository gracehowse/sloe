/**
 * MealPlanner themed-dialog migration guard (audit 2026-04-30).
 *
 * Pins the migration of three call sites in
 * `src/app/components/MealPlanner.tsx` from native browser dialogs
 * (`window.prompt` for plan rename + new plan, `window.confirm`
 * for plan deletion) to themed Radix dialogs
 * (`TextPromptDialog` + `DestructiveConfirmDialog`).
 *
 * Why a source-level test:
 *  - Native browser dialogs are unthemed (broken in dark mode),
 *    inconsistent across browsers (iOS Safari fires `confirm`
 *    twice on some versions), and blocked outright in cross-origin
 *    iframes. Drift back to them is a UX regression.
 *  - The M7 audit (2026-04-18) explicitly migrated every
 *    `window.confirm` / `window.prompt` site in the web app to
 *    `DestructiveConfirmDialog` / `TextPromptDialog`. This test
 *    locks the planner into that posture.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
  "utf8",
);

describe("MealPlanner themed-dialog migration (2026-04-30)", () => {
  it("does NOT call window.prompt anywhere", () => {
    // `\(` at the tail keeps doc-comment mentions of the API name
    // from tripping the guard while still catching real call sites.
    expect(SRC).not.toMatch(/window\.prompt\(/);
  });

  it("does NOT call window.confirm anywhere", () => {
    expect(SRC).not.toMatch(/window\.confirm\(/);
  });

  it("imports TextPromptDialog from suppr/", () => {
    expect(SRC).toMatch(
      /from\s+["']\.\/suppr\/text-prompt-dialog["']/,
    );
    expect(SRC).toMatch(/\bTextPromptDialog\b/);
  });

  it("imports DestructiveConfirmDialog from suppr/", () => {
    expect(SRC).toMatch(
      /from\s+["']\.\/suppr\/destructive-confirm-dialog["']/,
    );
    expect(SRC).toMatch(/\bDestructiveConfirmDialog\b/);
  });

  it("renames a plan via TextPromptDialog wired to renameMealPlanSlot", () => {
    // The rename dialog target state holds id + name and the confirm
    // handler routes the trimmed name back through the context API.
    expect(SRC).toMatch(/renameSlotTarget/);
    expect(SRC).toMatch(/setRenameSlotTarget/);
    expect(SRC).toMatch(/renameMealPlanSlot\(\s*renameSlotTarget\.id/);
  });

  it("creates a new plan via TextPromptDialog wired to createMealPlanSlot", () => {
    expect(SRC).toMatch(/newPlanOpen/);
    expect(SRC).toMatch(/setNewPlanOpen/);
    expect(SRC).toMatch(/createMealPlanSlot\(\s*name\s*\)/);
  });

  it("deletes a plan via DestructiveConfirmDialog wired to deleteMealPlanSlot", () => {
    expect(SRC).toMatch(/deleteSlotTarget/);
    expect(SRC).toMatch(/setDeleteSlotTarget/);
    expect(SRC).toMatch(/deleteMealPlanSlot\(\s*deleteSlotTarget\.id\s*\)/);
  });

  it("renders all three themed dialogs in the JSX", () => {
    const renameOpen = SRC.indexOf("<TextPromptDialog");
    const destructive = SRC.indexOf("<DestructiveConfirmDialog");
    expect(renameOpen).toBeGreaterThan(-1);
    expect(destructive).toBeGreaterThan(-1);
    // Two TextPromptDialog instances (rename + new) and one
    // DestructiveConfirmDialog (delete) are wired below the swap
    // dialog at the bottom of the JSX tree.
    const promptCount = SRC.match(/<TextPromptDialog/g)?.length ?? 0;
    const destructiveCount =
      SRC.match(/<DestructiveConfirmDialog/g)?.length ?? 0;
    expect(promptCount).toBe(2);
    expect(destructiveCount).toBe(1);
  });
});
