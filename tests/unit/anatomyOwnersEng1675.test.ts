/**
 * ENG-1675 — Today notice surfaces route through SupprNotice under
 * `ui_anatomy_owners_v1` (web + mobile parity).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1675 Today notices — SupprNotice under ui_anatomy_owners_v1", () => {
  it("NorthStar non-default branches use SupprNotice for tinted system prompts", () => {
    const mobile = read("apps/mobile/components/today/NorthStarBlockNonDefault.tsx");
    const web = read("src/app/components/suppr/north-star-block-non-default.tsx");
    for (const src of [mobile, web]) {
      expect(src).toMatch(/ui_anatomy_owners_v1/);
      expect(src).toMatch(/kind === "library-empty"/);
      expect(src).toMatch(/kind === "new-user"/);
      expect(src.match(/<SupprNotice\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it("Weekly check-in banner uses SupprNotice when flag is on", () => {
    const mobile = read("apps/mobile/components/today/WeeklyCheckinBanner.tsx");
    const web = read("src/app/components/suppr/weekly-checkin-banner.tsx");
    expect(mobile).toMatch(/ui_anatomy_owners_v1[\s\S]*<SupprNotice\b/);
    expect(web).toMatch(/ui_anatomy_owners_v1[\s\S]*<SupprNotice\b/);
  });

  it("Today offline pill uses SupprNotice on mobile + web NutritionTracker", () => {
    const mobile = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
    const web = read("src/app/components/NutritionTracker.tsx");
    expect(mobile).toMatch(/today-offline-notice/);
    expect(mobile).toMatch(/variant="pill"/);
    expect(web).toMatch(/today-offline-notice/);
    expect(web).toMatch(/variant="pill"/);
  });

  it("Weekly insight callout can use SupprNotice inline under the flag", () => {
    const mobile = read("apps/mobile/components/today/WeeklyInsightCard.tsx");
    const web = read("src/app/components/suppr/today-weekly-insight-mobile-card.tsx");
    expect(mobile).toMatch(/ui_anatomy_owners_v1[\s\S]*<SupprNotice\b/);
    expect(web).toMatch(/ui_anatomy_owners_v1[\s\S]*<SupprNotice\b/);
  });
});
