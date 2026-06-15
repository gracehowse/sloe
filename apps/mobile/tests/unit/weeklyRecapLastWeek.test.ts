/**
 * The mobile Weekly recap screen is RETROSPECTIVE — it summarises the LAST
 * COMPLETED week (the week that just ended), not the current in-progress week.
 *
 * Bug (2026-06-15): on Monday, `weekly-recap.tsx` rolled its own *current-week*
 * anchor (`buildWeekStats(..., new Date(), ...)` + the per-day target loop), so
 * the screen showed "This week · Jun 15 – Jun 21 · 1 of 7 days" — a near-empty,
 * barely-started week. The web Digest + the weekly-recap push already anchor on
 * the last completed week; this aligns mobile to that.
 *
 * Source-pin (the screen pulls react-native + expo-router, not mountable under
 * vitest). The TDEE check-in deliberately keeps its OWN current-week snapshot
 * anchor (read at now-7, written at now) — shifting it too would double-shift
 * the previous-vs-current TDEE comparison — so this file pins ONLY the recap
 * stats window, not the snapshot logic.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../app/weekly-recap.tsx"), "utf8");

describe("Weekly recap — recaps the LAST completed week", () => {
  it("weekStats anchors 7 days back and feeds that to buildWeekStats (not a bare current Date)", () => {
    // The memo must build a `- 7` anchor and pass *that* to buildWeekStats. A
    // revert to `buildWeekStats(..., new Date(), ...)` drops `lastWeekAnchor`
    // from the call and fails this pin.
    expect(SRC).toMatch(
      /const\s+lastWeekAnchor\s*=\s*new Date\(\);[\s\S]{0,120}lastWeekAnchor\.setDate\(\s*lastWeekAnchor\.getDate\(\)\s*-\s*7\s*\)/,
    );
    expect(SRC).toMatch(/buildWeekStats\([^)]*\blastWeekAnchor\b[^)]*\)/);
  });

  it("the per-day target snapshot window also anchors to the last completed week", () => {
    // The daily-target keys are derived from `nowD`; it must be shifted -7 so
    // the per-day targets line up with the recapped (last) week.
    expect(SRC).toMatch(/nowD\.setDate\(\s*nowD\.getDate\(\)\s*-\s*7\s*\)/);
  });

  it("labels the recap window 'Last week' (not 'This week')", () => {
    expect(SRC).toMatch(/Last week/);
  });
});
