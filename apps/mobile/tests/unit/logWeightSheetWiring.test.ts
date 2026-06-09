/**
 * Weight chart consolidation Phase 1 (2026-05-11, B6).
 *
 * Pins: the Progress tab `/weight-tracker` push CTAs have been
 * replaced by an inline `<LogWeightSheet>` open. The standalone
 * `/weight-tracker` route is still alive for backwards compat
 * (Phase 3 deletes it), but Progress no longer pushes there.
 *
 * Without this pin a future agent could re-add a router.push for
 * convenience, undoing the consolidation.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PROGRESS_PATH = resolve(ROOT, "app/(tabs)/progress.tsx");
const SHEET_PATH = resolve(ROOT, "components/progress/LogWeightSheet.tsx");

const src = readFileSync(PROGRESS_PATH, "utf8");

describe("Progress tab — log-weight inline sheet (Phase 1)", () => {
  it("LogWeightSheet component exists at the canonical path", () => {
    expect(existsSync(SHEET_PATH)).toBe(true);
  });

  it("Progress imports LogWeightSheet", () => {
    expect(src).toContain(
      'from "@/components/progress/LogWeightSheet"',
    );
    expect(src).toContain("LogWeightSheet");
  });

  it("Progress mounts the sheet with the expected props", () => {
    expect(src).toMatch(/<LogWeightSheet\s/);
    expect(src).toMatch(/visible=\{logWeightOpen\}/);
    expect(src).toContain("setLogWeightOpen");
    expect(src).toContain("weightKgByDay={weightKgByDay}");
    expect(src).toContain("onSaved=");
  });

  it("no Progress CTA pushes to /weight-tracker anymore", () => {
    // The 4 prior CTAs (header Scale, Trend tile, sparse-state Log
    // weight, Weight Journey card) must all open the sheet. Phase 3
    // deletes the route; until then, only deeplinks should land
    // there — Progress code should not push there itself.
    expect(src).not.toMatch(/router\.push\(\s*"\/weight-tracker"/);
  });

  it("Progress still renders the weight sparkline for in-tab chart display", () => {
    // The whole point of the consolidation: Progress remains the
    // single canonical surface for the weight chart.
    // Sloe/aubergine redesign (2026-06-04): the full WeightChart component
    // was replaced with an inline Sparkline helper for the redesigned
    // compact weight card. The chart still lives in progress.tsx — it is
    // not delegated to a push route. Pin both the Sparkline definition and
    // its usage so a future agent can't silently delete either.
    expect(src).toContain("function Sparkline(");
    expect(src).toContain("<Sparkline points={sparkSeries}");
  });
});
