import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
// ENG-1225 #14 — the Discover import slab was extracted from the pinned
// `DiscoverFeed.tsx` host into `discover-import-card.tsx` (screen-budget).
const discoverImportCard = readFileSync(
  resolve(ROOT, "src/app/components/suppr/discover-import-card.tsx"),
  "utf8",
);
const todayMealsSection = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-meals-section.tsx"),
  "utf8",
);

describe("ENG-1138 web focus-visible rings", () => {
  it("keeps the Discover import hero visibly keyboard-focusable (discover_import_hero_v1 collapsed ENG-1356 — legacy branch removed, only the hero remains)", () => {
    const importHeroBlocks = discoverImportCard.match(
      /data-testid="discover-import-cta-top"[\s\S]*?className="([^"]+)"/g,
    );

    expect(importHeroBlocks).toHaveLength(1);
    for (const block of importHeroBlocks ?? []) {
      expect(block).toContain("focus-visible:outline-none");
      expect(block).toContain("focus-visible:ring-2");
      expect(block).toContain("focus-visible:ring-primary");
      expect(block).toContain("focus-visible:ring-offset-2");
    }
  });

  it("keeps Today meal-slot headers visibly keyboard-focusable inside the card", () => {
    expect(todayMealsSection).toMatch(
      /data-testid=\{`today-slot-header-\$\{sectionName\}`\}[\s\S]*?focus:outline-none[\s\S]*?focus-visible:ring-2[\s\S]*?focus-visible:ring-primary[\s\S]*?focus-visible:ring-inset/,
    );
  });
});
