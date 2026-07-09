// @vitest-environment jsdom
/**
 * Today ring fresh-day empty-state grammar (mobile) — ENG-1372 slice 1.
 *
 * Behind `empty_state_grammar_v1` (default-OFF): on a true fresh day (host-
 * confirmed zero logged entries, via `TodayScreen`'s `mealsToday.length === 0`)
 * the fresh-day log pill mounts inside the hero, and the BONUS stat cell
 * collapses (law 3 — no zero-triad derived numbers) while Goal/Eaten stay.
 * Source-grep for the flag-branch wiring (mirrors `todayHeroDecard.test.tsx`'s
 * pattern — real transitive analytics imports, not a flag-mocked render) +
 * direct renders for the presentational pieces that don't need the live flag
 * resolver.
 *
 * ENG-1477 (2026-07-09) — the ring's tick track no longer swaps to a "warm"
 * colour on a fresh day: that swap (`colors.surfaceWarm`) measured 1.02:1/
 * 1.14:1 contrast, worse than not swapping at all. Every empty day (fresh or
 * not) now uses the same `colors.ringTick` unconditionally — see the
 * regression guard below.
 *
 * Web parity: `tests/unit/todayFreshDayGrammarWeb.test.tsx`.
 */
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroStats } from "../../components/today/TodayHeroStats";
import { TodayFreshDayLogPill } from "../../components/today/TodayFreshDayLogPill";

void React;

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("TodayFreshDayLogPill", () => {
  it("labels by hour (before 11 / 11-16 / after 16) and fires onPress", () => {
    let pressed = "";
    const { getByLabelText, rerender } = render(
      <TodayFreshDayLogPill hour={7} onPress={() => (pressed = "breakfast")} />,
    );
    const breakfastBtn = getByLabelText("Log breakfast");
    expect(breakfastBtn).toBeTruthy();
    breakfastBtn.props.onPress?.();
    expect(pressed).toBe("breakfast");

    rerender(<TodayFreshDayLogPill hour={12} onPress={() => {}} />);
    expect(getByLabelText("Log lunch")).toBeTruthy();

    rerender(<TodayFreshDayLogPill hour={18} onPress={() => {}} />);
    expect(getByLabelText("Log dinner")).toBeTruthy();
  });
});

describe("TodayHeroStats — suppressZeroBonus (ENG-1372 law 3)", () => {
  const base = {
    goal: 2000,
    consumed: 0,
    textColor: "#000",
    secondaryColor: "#666",
    borderColor: "#eee",
    isDark: false,
  };

  it("without suppressZeroBonus: BONUS renders as 0 (unchanged legacy behaviour)", () => {
    const { getByTestId } = render(
      <TodayHeroStats {...base} baseGoal={undefined} />,
    );
    const bonus = getByTestId("today-ring-bonus");
    expect(bonus).toBeTruthy();
  });

  it("with suppressZeroBonus and no real bonus: BONUS cell is gone; Goal/Eaten stay", () => {
    const { queryByTestId, getByText } = render(
      <TodayHeroStats {...base} baseGoal={undefined} suppressZeroBonus />,
    );
    expect(queryByTestId("today-ring-bonus")).toBeNull();
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
  });

  it("with suppressZeroBonus but a REAL bonus exists: BONUS cell still renders", () => {
    const { getByTestId } = render(
      <TodayHeroStats {...base} baseGoal={1800} suppressZeroBonus />,
    );
    expect(getByTestId("today-ring-bonus")).toBeTruthy();
    expect(getByTestId("today-ring-bonus").props.children).toBeTruthy();
  });
});

describe("TodayHeroRing / CalorieRingDial — empty_state_grammar_v1 wiring (source-grep)", () => {
  const heroRingSrc = read("components/today/TodayHeroRing.tsx");
  const graphicSrc = read("components/today/TodayHeroRingGraphic.tsx");
  const dialSrc = read("components/charts/CalorieRingDial.tsx");

  it("TodayHeroRing reads the flag and gates the pill + track + BONUS suppression on isFreshDay", () => {
    expect(heroRingSrc).toMatch(/isFeatureEnabled\("empty_state_grammar_v1"\)/);
    expect(heroRingSrc).toMatch(/emptyStateGrammarOn && isFreshDay/);
    expect(heroRingSrc).toMatch(/<TodayFreshDayLogPill/);
    expect(heroRingSrc).toMatch(/suppressZeroBonus=\{emptyStateGrammarOn && isFreshDay\}/);
  });

  it("ENG-1477 regression guard: no emptyTrackWarm/surfaceWarm swap remains on the ring — every empty day reads the same tick colour", () => {
    expect(graphicSrc).not.toMatch(/emptyTrackWarm/);
    expect(dialSrc).not.toMatch(/emptyTrackWarm/);
    expect(dialSrc).not.toMatch(/surfaceWarm/);
    expect(dialSrc).toMatch(/tickColor = colors\.ringTick/);
  });
});
