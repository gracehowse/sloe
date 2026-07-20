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
    const src = readFileSync(join(ROOT, "app/(tabs)/_today/TodayScreen.tsx"), "utf8");
    // ENG-1099 M1 flag-gated the break (`tierV1 ? 0 : Layout.todaySectionBreak`).
    // `today_tracker_tier_v1` was always-on in production and was collapsed in
    // ENG-1356 — the break is now the unconditional `marginTop: 0`; the one 24
    // `Spacing.xl` scroll gap on `styles.scroll` carries the rhythm instead.
    expect(src).not.toContain("Layout.todaySectionBreak");
    expect(src).not.toContain("tierV1");
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

describe("Today rhythm layout — strip→hero dead band (ENG-1609)", () => {
  const src = readFileSync(
    join(ROOT, "app/(tabs)/_today/TodayScreen.tsx"),
    "utf8",
  );

  it("no longer double-stacks a marginBottom wrapper on top of the scroll gap before the week strip", () => {
    // Grace, 2026-07-19 (annotated screenshot): "too much space here" between
    // the week strip and the Coach chip + kcal dial. The wrapper was added by
    // the 2026-06-11 rhythm sweep (ENG-1032) back when `styles.scroll`'s base
    // gap was 8px (16 + 8 = a deliberate 24pt break). The ENG-1356 flag
    // collapse (2026-07-06) later made the scroll gap unconditionally
    // `Spacing.xl` (24) everywhere, so the un-revisited 16px wrapper silently
    // doubled the seam to 40px. Removed — the strip→hero gap is now the same
    // single 24px `Spacing.xl` scroll gap every other Today section break
    // uses (Meals / Activity / Hydration / Planned).
    expect(src).not.toMatch(/marginBottom:\s*Spacing\.md\s*}}>\s*<TodayDateHeader/);
    expect(src).toMatch(/<TodayDateHeader\s/);
  });

  it("renders the extracted <TodayGreetingHero> ahead of the week strip (boy-scout shrink, ENG-1609)", () => {
    expect(src).toMatch(/import \{ TodayGreetingHero \} from "@\/components\/today\/TodayGreetingHero"/);
    expect(src).toMatch(/<TodayGreetingHero\s+viewMode=\{viewMode\}\s+isToday=\{isToday\}\s+selectedDate=\{selectedDate\}\s*\/>/);
  });
});
