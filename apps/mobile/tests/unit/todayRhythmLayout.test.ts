/**
 * ENG-871 — Today scroll rhythm: tighter hero cluster, larger breaks
 * before meals / weekly insight.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Layout } from "../../constants/layout";

const ROOT = join(__dirname, "../..");

describe("Today rhythm layout (ENG-871)", () => {
  it("uses a larger section break than the default scroll gap", () => {
    expect(Layout.todaySectionBreak).toBeGreaterThan(Layout.todayScrollGap);
    expect(Layout.todaySectionBreak).toBe(32);
    expect(Layout.todayScrollGap).toBe(8);
    expect(Layout.todayScrollGap + Layout.todaySectionBreak).toBe(40);
  });

  it("pins section breaks on meals, insight, and TD1/TD2 in Today host", () => {
    const src = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf8");
    expect(src).toContain("marginTop: Layout.todaySectionBreak");
    expect(src).toContain("TodayMealsSection");
    expect(src).toContain("WeeklyInsightCard");
    expect(src).toContain('title="Activity & energy"');
    expect(src).toContain('title="Hydration & stimulants"');
  });

  it("uses the Claude Design prototype macro tile grid gap (10–14 density)", () => {
    // ENG-871 tightened this to 8; the Sloe re-skin matches the prototype
    // density (`gap: 10–14`) at 12 — see constants/layout.ts.
    expect(Layout.macroTileGridGap).toBe(12);
  });
});
