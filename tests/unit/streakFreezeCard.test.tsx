// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — StreakFreezeCard render contract (web, web-only card).
 *
 * ALL figures 0 (Available/Earned/Used) + `empty_state_grammar_v1` on →
 * collapse to one explanatory row (law 3: a card whose every figure is 0
 * is a zero-triad — derived numbers with nothing behind them yet). At
 * least one non-zero figure, or the flag off, keeps the full grid.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { StreakFreezeCard } from "../../src/app/components/suppr/streak-freeze-card";

const EMPTY_LEDGER = { earnedAt: [], usedHistory: [] };

describe("StreakFreezeCard — zero-triad collapse", () => {
  it("collapses to one row when nothing has ever been earned (flag on)", () => {
    const { getByTestId, queryByText } = render(
      <StreakFreezeCard
        freezeBudgetMax={4}
        freezesAvailable={0}
        freezeLedger={EMPTY_LEDGER}
        protectedDateKeys={[]}
        rawStreakDays={2}
        streakDays={2}
        emptyStateGrammarOn
      />,
    );
    expect(getByTestId("streak-freeze-zero-collapse").textContent).toBe(
      "Log 7 days in a row to earn your first streak freeze.",
    );
    expect(queryByText("Available")).toBeNull();
    expect(queryByText("Earned")).toBeNull();
    expect(queryByText("Used")).toBeNull();
  });

  it("keeps the legacy three-stat grid when the flag is off (OFF renders legacy exactly)", () => {
    const { queryByTestId, getByText } = render(
      <StreakFreezeCard
        freezeBudgetMax={4}
        freezesAvailable={0}
        freezeLedger={EMPTY_LEDGER}
        protectedDateKeys={[]}
        rawStreakDays={0}
        streakDays={0}
        emptyStateGrammarOn={false}
      />,
    );
    expect(queryByTestId("streak-freeze-zero-collapse")).toBeNull();
    expect(getByText("Available")).toBeTruthy();
    expect(getByText("Earned")).toBeTruthy();
    expect(getByText("Used")).toBeTruthy();
  });

  it("keeps the full grid once at least one freeze has ever been earned/used/available", () => {
    const { queryByTestId, getByText } = render(
      <StreakFreezeCard
        freezeBudgetMax={4}
        freezesAvailable={1}
        freezeLedger={{ earnedAt: ["2026-06-01"], usedHistory: [] }}
        protectedDateKeys={[]}
        rawStreakDays={7}
        streakDays={7}
        emptyStateGrammarOn
      />,
    );
    expect(queryByTestId("streak-freeze-zero-collapse")).toBeNull();
    expect(getByText("Available")).toBeTruthy();
    expect(getByText("Earned")).toBeTruthy();
    expect(getByText("Used")).toBeTruthy();
  });

  it("renders nothing when the freeze budget is 0 (unrelated, pre-existing gate)", () => {
    const { container } = render(
      <StreakFreezeCard
        freezeBudgetMax={0}
        freezesAvailable={0}
        freezeLedger={EMPTY_LEDGER}
        protectedDateKeys={[]}
        rawStreakDays={0}
        streakDays={0}
        emptyStateGrammarOn
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the 'Recent freezes used' list + raw-streak note once freezes exist and have protected a day", () => {
    const { getByText } = render(
      <StreakFreezeCard
        freezeBudgetMax={4}
        freezesAvailable={0}
        freezeLedger={{ earnedAt: ["2026-06-01"], usedHistory: ["2026-06-05"] }}
        protectedDateKeys={["2026-06-05"]}
        rawStreakDays={5}
        streakDays={8}
        emptyStateGrammarOn
      />,
    );
    expect(getByText("Recent freezes used")).toBeTruthy();
    expect(getByText(/Raw streak \(without freezes\): 5 days\./)).toBeTruthy();
  });
});
