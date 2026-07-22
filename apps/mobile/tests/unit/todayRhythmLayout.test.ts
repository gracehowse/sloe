/**
 * ENG-871 / ENG-1655 — Today scroll rhythm: tight within groups, one
 * between-section break size (24).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Layout } from "../../constants/layout";

const ROOT = join(__dirname, "../..");

describe("Today rhythm layout (ENG-871 / ENG-1655)", () => {
  it("uses a larger section break than the default scroll gap", () => {
    expect(Layout.todaySectionBreak).toBeGreaterThan(Layout.todayScrollGap);
    expect(Layout.todaySectionBreak).toBe(24);
    expect(Layout.todayScrollGap).toBe(8);
  });

  it("gates two-tier scroll gap behind today_section_rhythm_v1", () => {
    const src = readFileSync(join(ROOT, "app/(tabs)/_today/TodayScreen.tsx"), "utf8");
    expect(src).toContain('today_section_rhythm_v1');
    expect(src).toContain("Layout.todayScrollGap");
    expect(src).toContain("TodayMealsSection");
    expect(src).toContain("WeeklyInsightCard");
    expect(src).toContain('title="Activity & energy"');
    expect(src).toContain('title="Hydration & stimulants"');
  });

  it("uses the Claude Design prototype macro tile grid gap (10–14 density)", () => {
    expect(Layout.macroTileGridGap).toBe(12);
  });
});

describe("Today rhythm layout — strip→hero dead band (ENG-1609)", () => {
  const src = readFileSync(
    join(ROOT, "app/(tabs)/_today/TodayScreen.tsx"),
    "utf8",
  );

  it("no longer double-stacks a marginBottom wrapper on top of the scroll gap before the week strip", () => {
    expect(src).not.toMatch(/marginBottom:\s*Spacing\.md\s*}}>\s*<TodayDateHeader/);
    expect(src).toMatch(/<TodayDateHeader\s/);
  });

  it("renders the extracted <TodayGreetingHero> ahead of the week strip (boy-scout shrink, ENG-1609)", () => {
    expect(src).toMatch(/import \{ TodayGreetingHero \} from "@\/components\/today\/TodayGreetingHero"/);
    expect(src).toMatch(/<TodayGreetingHero\s+viewMode=\{viewMode\}\s+isToday=\{isToday\}\s+selectedDate=\{selectedDate\}\s*\/>/);
  });
});
