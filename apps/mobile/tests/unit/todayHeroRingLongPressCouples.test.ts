/**
 * Source-pin: Today host (`apps/mobile/app/(tabs)/_today/TodayScreen.tsx`) wires
 * the long-press on the calorie ring so it fires BOTH the display-
 * mode toggle AND the ring-expanded toggle in lock-step (2026-05-02
 * user feedback: "the click and hold to switch between views was
 * better showing and hiding macro rings").
 *
 * This is a source-level pin rather than a render test because the
 * Today host is a 5,000-line composition root; rendering it in a
 * unit suite would require stubbing 30+ Supabase / RevenueCat /
 * NetInfo modules. The behaviour we care about is the host's
 * `onToggleDisplayMode` handler, and its source signature is what
 * makes / breaks the user-visible behaviour. The presentation
 * components (`TodayHeroRing`, `CalorieRing`) carry their own tests
 * elsewhere.
 *
 * If the wiring drifts (someone re-introduces a chip control or
 * decouples the gestures) this pin fails first and the diff is
 * one-line obvious.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const HOST_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "(tabs)",
  "index.tsx",
);

describe("Today host — long-press couples display-mode + ring-expanded", () => {
  it("the Remaining/Consumed toggle plumbing is fully retired (Grace 2026-06-10)", () => {
    // The toggle duplicated the EATEN stat below the ring, and the
    // collapsed ring ignored it. No displayMode state, no toggle handler.
    const SRC = readFileSync(HOST_PATH, "utf8");
    expect(SRC).not.toMatch(/setCalorieDisplayMode/);
    expect(SRC).not.toMatch(/onToggleDisplayMode=\{/);
  });

  it("does NOT pass an onSetDisplayMode prop to TodayHero (chip wiring deleted)", () => {
    const SRC = readFileSync(HOST_PATH, "utf8");
    expect(SRC).not.toMatch(/onSetDisplayMode=/);
  });

  it("does NOT import or render TodayMicrosWidget on Today (4-tile widget removed)", () => {
    const SRC = readFileSync(HOST_PATH, "utf8");
    expect(SRC).not.toMatch(/from ["'][^"']*TodayMicrosWidget["']/);
    expect(SRC).not.toMatch(/<TodayMicrosWidget\b/);
  });
});
