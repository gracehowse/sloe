/**
 * ENG-685 — Discover + Today remote thumbnails use SmartImage.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-685 SmartImage adoption", () => {
  it("mobile Discover cover + hero media use SmartImage", () => {
    const src = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx"), "utf8");
    // DiscoverCoverImage (the More-ideas row thumbnail) was extracted to
    // DiscoverMoreIdeaRow (ENG-1225 Block 6 pre-work); it still uses SmartImage.
    const moreIdea = readFileSync(
      resolve(ROOT, "apps/mobile/components/discover/DiscoverMoreIdeaRow.tsx"),
      "utf8",
    );
    expect(moreIdea).toMatch(/DiscoverCoverImage[\s\S]*SmartImage/);
    expect(src).toMatch(/DiscoverHeroMedia[\s\S]*SmartImage/);
  });

  it("Today meal rows + north-star hero use SmartImage for remote URIs", () => {
    const meals = readFileSync(resolve(ROOT, "apps/mobile/components/today/TodayMealsSection.tsx"), "utf8");
    const north = readFileSync(resolve(ROOT, "apps/mobile/components/today/NorthStarBlock.tsx"), "utf8");
    expect(meals).toMatch(/SmartImage/);
    expect(north).toMatch(/SmartImage/);
  });
});
