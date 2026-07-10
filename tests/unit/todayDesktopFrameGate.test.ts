/**
 * ENG-1494 — TodayDesktopFrame is wired behind `today_desktop_frame_v1`
 * (source pins, repo convention for App-level view dispatch):
 *
 *   - App gates the today view on the flag with the direct
 *     `<NutritionTracker>` as the else/kill-switch;
 *   - the frame is dynamic-imported (it statically imports
 *     NutritionTracker — a static mount would pull the tracker into the
 *     main bundle and defeat the existing code-split);
 *   - the frame forwards `onOpenSettings` (previously dropped, which
 *     would have broken the settings avatar under the flag);
 *   - the flag stays OUT of `REDESIGN_DEFAULT_ON` until the ENG-1495
 *     conformance work lands (Today-centre + no-duplicate decisions).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const APP = read("src/app/App.tsx");
const FRAME = read("src/app/components/TodayDesktopFrame.tsx");
const TRACK = read("src/lib/analytics/track.ts");

describe("TodayDesktopFrame wiring — ENG-1494", () => {
  it("App gates the today view on today_desktop_frame_v1 with the tracker as kill-switch", () => {
    expect(APP).toMatch(/isFeatureEnabled\("today_desktop_frame_v1"\) \? \(/);
    expect(APP).toMatch(/<TodayDesktopFrame/);
    // Kill switch: the direct tracker render survives as the else branch.
    expect(APP).toMatch(/\) : \(\s*<NutritionTracker/);
  });

  it("the frame is dynamic-imported, preserving the tracker code-split", () => {
    expect(APP).toMatch(
      /const TodayDesktopFrame = dynamic\(\s*\(\) => import\("\.\/components\/TodayDesktopFrame\.tsx"\)/,
    );
  });

  it("the frame forwards onOpenSettings to the tracker", () => {
    expect(FRAME).toMatch(/onOpenSettings\?: \(\) => void;/);
    expect(FRAME).toMatch(/onOpenSettings=\{onOpenSettings\}/);
  });

  it("the flag is default-OFF (not in REDESIGN_DEFAULT_ON) until ENG-1495 lands", () => {
    const defaultOnBlock = TRACK.slice(
      TRACK.indexOf("const REDESIGN_DEFAULT_ON"),
      TRACK.indexOf("]);", TRACK.indexOf("const REDESIGN_DEFAULT_ON")),
    );
    expect(defaultOnBlock).not.toContain("today_desktop_frame_v1");
    // The default-OFF rationale is documented in the registry comment.
    expect(TRACK).toMatch(/`today_desktop_frame_v1` — ENG-1494/);
  });
});
