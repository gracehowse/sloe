import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const DISCOVER = readFileSync(resolve(ROOT, "src/app/components/DiscoverFeed.tsx"), "utf8");
const TODAY_MEALS = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-meals-section.tsx"),
  "utf8",
);

describe("ENG-1138 — custom web div-buttons expose keyboard focus rings", () => {
  it("adds primary focus-visible rings to both Discover import-hero flag branches", () => {
    expect(DISCOVER).toMatch(
      /discover_import_hero_v1[\s\S]*?className="[^"]*focus-visible:outline-none[^"]*focus-visible:ring-2[^"]*focus-visible:ring-primary[^"]*focus-visible:ring-offset-2"/,
    );

    expect(DISCOVER).toMatch(
      /Legacy nav-row slab[\s\S]*?className="[^"]*focus-visible:outline-none[^"]*focus-visible:ring-2[^"]*focus-visible:ring-primary[^"]*focus-visible:ring-offset-2"/,
    );
  });

  it("adds an inset primary focus-visible ring to the Today meal-slot header", () => {
    expect(TODAY_MEALS).toMatch(
      /data-testid={`today-slot-header-\$\{sectionName\}`}[\s\S]*?className={`[^`]*focus:outline-none[^`]*focus-visible:ring-2[^`]*focus-visible:ring-primary[^`]*focus-visible:ring-inset/,
    );
  });
});
