import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("ENG-1237 body-composition trends parity pins", () => {
  it("registers body_composition_trends_v1 default-ON on web + mobile", () => {
    expect(read("src/lib/analytics/track.ts")).toMatch(/"body_composition_trends_v1"/);
    expect(read("apps/mobile/lib/analytics.ts")).toMatch(/"body_composition_trends_v1"/);
  });

  it("wires BodyCompositionTrendCard on web Progress + mobile Progress", () => {
    expect(read("src/app/components/ProgressDashboard.tsx")).toMatch(/BodyCompositionTrendCard/);
    expect(read("apps/mobile/app/(tabs)/progress.tsx")).toMatch(/BodyCompositionTrendCard/);
  });

  it("keeps trend reads behind the server-enforced route instead of parent props", () => {
    const webCard = read("src/app/components/suppr/body-composition-trend-card.tsx");
    const mobileCard = read("apps/mobile/components/progress/BodyCompositionTrendCard.tsx");
    expect(webCard).toMatch(/\/api\/progress\/body-composition-trends/);
    expect(mobileCard).toMatch(/\/api\/progress\/body-composition-trends/);
    expect(read("src/app/components/ProgressDashboard.tsx")).not.toMatch(/bodyFatPctByDay=\{/);
    expect(read("apps/mobile/app/(tabs)/progress.tsx")).not.toMatch(/bodyFatPctByDay=\{/);
  });

  it("stages body_fat_pct_by_day migration", () => {
    expect(read("supabase/migrations/20260702120700_eng1237_body_fat_pct_by_day.sql")).toMatch(
      /body_fat_pct_by_day/,
    );
  });
});
