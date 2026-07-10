import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ENG-1247 (2026-06-24): `recipes-tab-chrome.tsx` re-gained an overline — the
// v3 prototype "Cook" tab puts a "Cook" overline above the serif "Your kitchen"
// title (superseding the 2026-06-08 generic no-overline "Recipes" treatment).
// S6 (2026-07-10, ENG-1375): the three tab chromes (progress / plan /
// recipes) are now thin wrappers over the shared `screen-chrome.tsx`, which
// owns the overline markup — the pin moved to the primitive.
const OVERLINE_FILES = [
  "src/app/components/suppr/digest-story-card.tsx",
  "src/app/components/suppr/progress-headline.tsx",
  "src/app/components/suppr/progress-story-gate.tsx",
  "src/app/components/suppr/north-star-block.tsx",
  "src/app/components/suppr/screen-chrome.tsx",
  "src/app/components/suppr/today-week-sidebar.tsx",
  "src/app/components/suppr/full-nutrient-panel-sheet.tsx",
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
