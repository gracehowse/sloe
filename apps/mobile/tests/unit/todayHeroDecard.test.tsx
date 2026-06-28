// @vitest-environment jsdom
/**
 * Today calorie hero DE-CARD (ENG-1247, flag `today_hero_decard_v3`).
 *
 * The v3 prototype `.ring-hero` is a BARE centered block (no card chrome) with
 * the status line BELOW the ring; the carded hero keeps the chip ABOVE. This
 * guards:
 *   1. the extracted TodayHeroStats renders Goal / Eaten / Bonus (shared by both
 *      hero layouts), and
 *   2. TodayHeroRing keeps the flag-gated branch intact (bare View + RingStatusLine
 *      when on; SupprCard + chip-above when off) so a refactor can't silently
 *      collapse one path. Source-grep (not a flag-mocked render) so transitive
 *      analytics imports stay real.
 */
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroStats } from "../../components/today/TodayHeroStats";

void React;

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("TodayHeroStats (extracted, shared by both heroes)", () => {
  it("renders Goal / Eaten / Bonus values", () => {
    const { getByText } = render(
      <TodayHeroStats
        goal={2000}
        consumed={1200}
        baseGoal={1800}
        textColor="#000"
        secondaryColor="#666"
        borderColor="#eee"
        isDark={false}
      />,
    );
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("2,000")).toBeTruthy(); // goal
    expect(getByText("1,200")).toBeTruthy(); // eaten
    expect(getByText("+200")).toBeTruthy(); // bonus = goal - baseGoal
  });

  it("renders nothing when goal is 0 (calibrating)", () => {
    const { toJSON } = render(
      <TodayHeroStats
        goal={0}
        consumed={0}
        baseGoal={undefined}
        textColor="#000"
        secondaryColor="#666"
        borderColor="#eee"
        isDark={false}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("TodayHeroRing de-card flag branch (today_hero_decard_v3)", () => {
  const src = read("components/today/TodayHeroRing.tsx");

  it("reads the de-card flag", () => {
    expect(src).toMatch(/isFeatureEnabled\("today_hero_decard_v3"\)/);
  });

  it("renders the status CHIP only on the carded path (!decard), status LINE on de-card", () => {
    expect(src).toMatch(/\{!decard \?/); // chip-above gated to carded
    expect(src).toMatch(/<RingStatusLine state=\{chipState\}/); // status line component
    expect(src).toMatch(/\{decard \?/); // ...rendered only on the de-card path
  });

  it("branches the wrapper — bare View when de-carded, SupprCard otherwise", () => {
    expect(src).toMatch(/if \(decard\) \{/);
    expect(src).toMatch(/<SupprCard/);
  });
});
