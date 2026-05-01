/**
 * Mobile parity test for the range-first photo-log re-architecture
 * (2026-05-01) — pins that `PhotoLogSheet.tsx` renders the SAME shape
 * as the web `PhotoLogDialog.tsx`:
 *   - groups by macro role via `groupItemsByCategory`
 *   - renders each item's kcal range via `formatRangeKcal`
 *   - renders the plate total via `sumRanges` + `formatRangeKcal`
 *   - renders add-on chips with `formatRange(...) + " kcal"` suffix
 *   - tapping an addon calls `setItems` with the addon promoted
 *   - "Save to today" projects items via `rangedItemToLogged` before
 *     calling `onCommit`
 *
 * Why a structural (source-grep) test: jsdom-vitest cannot render the
 * React Native sheet (Modal + ScrollView + lucide-react-native +
 * AsyncStorage). RNTL coverage is on the R7 backlog — once it lands,
 * this test can swap to a render-based assertion. Until then we grep
 * for the load-bearing wiring so a regression that drops the grouping,
 * the range formatter, the sumRanges call, or the rangedItemToLogged
 * projection fails this test.
 *
 * Web parity test lives at `tests/unit/photoLogDialogGrouping.test.tsx`
 * and renders the same shape against the real DOM.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHEET_PATH = resolve(__dirname, "../../components/PhotoLogSheet.tsx");
const SHEET_SRC = readFileSync(SHEET_PATH, "utf8");

describe("PhotoLogSheet (mobile) — range-first wiring (2026-05-01)", () => {
  it("imports the range-aware helpers from the shared lib", () => {
    expect(SHEET_SRC).toMatch(/formatRange\b/);
    expect(SHEET_SRC).toMatch(/formatRangeKcal\b/);
    expect(SHEET_SRC).toMatch(/groupItemsByCategory\b/);
    expect(SHEET_SRC).toMatch(/rangedItemToLogged\b/);
    expect(SHEET_SRC).toMatch(/sumRanges\b/);
    expect(SHEET_SRC).toMatch(/photoLogRanges/);
  });

  it("imports the new photo-log types (PhotoLogItemRanged, PhotoLogAddon)", () => {
    expect(SHEET_SRC).toMatch(/PhotoLogItemRanged\b/);
    expect(SHEET_SRC).toMatch(/PhotoLogAddon\b/);
  });

  it("renders items grouped by macro role (groups.map -> group.items.map)", () => {
    expect(SHEET_SRC).toMatch(/groups\.map\(\(group\)/);
    expect(SHEET_SRC).toMatch(/group\.items\.map\(\(item\)/);
  });

  it("renders each item's calories via formatRangeKcal", () => {
    expect(SHEET_SRC).toMatch(/formatRangeKcal\(item\.calories\)/);
  });

  it("renders the plate total banner via sumRanges + formatRangeKcal", () => {
    expect(SHEET_SRC).toMatch(/totalKcal[^=]*=[^;]*sumRanges/);
    expect(SHEET_SRC).toMatch(/formatRangeKcal\(totalKcal\)/);
    // The banner copy "Plate total" matches Grace's screenshot.
    expect(SHEET_SRC).toMatch(/Plate total/);
  });

  it("renders add-on chips with `+formatRange(addon.calories) kcal` suffix", () => {
    // The +LOW–HIGH kcal pattern matches Grace's screenshot's "Add wine: +120-150 kcal".
    expect(SHEET_SRC).toMatch(/\+\{formatRange\(addon\.calories\)\}\s*kcal/);
  });

  it("addon tap promotes the addon into items[] and removes it from addons[]", () => {
    // The tap handler appends to setItems and filters out of setAddons.
    expect(SHEET_SRC).toMatch(/setItems\(\(prev\)\s*=>\s*\[/);
    expect(SHEET_SRC).toMatch(/setAddons\(\(prev\)\s*=>\s*prev\.filter/);
    // Fires the analytics event so the funnel stays comparable with web.
    expect(SHEET_SRC).toMatch(/ai_photo_log_addon_added/);
  });

  it("flags low-confidence items with the amber 'verify before logging' note", () => {
    expect(SHEET_SRC).toMatch(/Low confidence — verify before logging/);
  });

  it("renders the model's notes caveat when supplied", () => {
    expect(SHEET_SRC).toMatch(/\{notes\}/);
  });

  it("'Save to today' projects items via rangedItemToLogged before onCommit", () => {
    expect(SHEET_SRC).toMatch(
      /projected\s*=\s*items\.map\(\(it\)\s*=>\s*rangedItemToLogged\(it\)\)/,
    );
    expect(SHEET_SRC).toMatch(/onCommit\(projected/);
    // The button label matches the web sheet exactly.
    expect(SHEET_SRC).toMatch(/Save to today/);
  });

  it("never blanket-fails on partial / low-confidence items (anti-regression on the old 'Couldn't analyse' path)", () => {
    // The error path now requires `data.items.length === 0` AND
    // `!data.ok`. Previously this was the condition `!data.ok ||
    // !Array.isArray(data.items)` which blocked any partial-items
    // response. The new shape gracefully degrades when SOME items
    // return — which is the central anti-regression invariant of the
    // 2026-05-01 re-architecture.
    expect(SHEET_SRC).toMatch(/data\.items\.length\s*===\s*0/);
  });
});
