import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ENG-1247 (2026-06-24): `recipes-tab-chrome.tsx` re-gained an overline — the
// v3 prototype "Cook" tab puts a "Cook" overline above the serif "Your kitchen"
// title (superseding the 2026-06-08 generic no-overline "Recipes" treatment).
// It is back in the overline-rhythm pin list so its "Cook" overline matches the
// shared 11px/bold/uppercase/tracking-[0.1em] rhythm.
const OVERLINE_FILES = [
  "src/app/components/suppr/digest-story-card.tsx",
  "src/app/components/suppr/progress-headline.tsx",
  "src/app/components/suppr/progress-story-gate.tsx",
  "src/app/components/suppr/north-star-block.tsx",
  "src/app/components/suppr/progress-tab-chrome.tsx",
  "src/app/components/suppr/plan-tab-chrome.tsx",
  "src/app/components/suppr/today-week-sidebar.tsx",
  "src/app/components/suppr/full-nutrient-panel-sheet.tsx",
  "src/app/components/suppr/recipes-tab-chrome.tsx",
  "src/app/components/Targets.tsx",
];

describe("ENG-63 · Section header overline rhythm", () => {
  for (const file of OVERLINE_FILES) {
    it(`${path.basename(file)} uses consistent tracking-[0.1em]`, () => {
      const src = fs.readFileSync(path.resolve(file), "utf-8");
      expect(src).toContain("text-[11px]");
      expect(src).toContain("font-bold");
      expect(src).toContain("uppercase");
      expect(src).toContain("tracking-[0.1em]");
      expect(src).not.toContain("tracking-[0.08em]");
      expect(src).not.toContain("tracking-[0.14em]");
    });
  }
});
