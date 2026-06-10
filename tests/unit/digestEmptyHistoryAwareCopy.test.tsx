/**
 * ENG-1019/1020 — web parity for the history-aware weekly-recap empty +
 * check-in copy (mirror of `apps/mobile/tests/unit/weeklyRecapScreen.test.tsx`).
 *
 * The Digest is the web mirror of the mobile weekly-recap surface. Its
 * empty subline and the first_week TDEE check-in headline must be
 * history-aware:
 *   - True cold start (no journal history) → cold-start copy.
 *   - Returning user, empty recap week → week-scoped copy, never
 *     "come back after your first meal" / "starts after 7 days".
 *
 * Both the legacy and the blended ENG-740 layouts are pinned so the
 * copy can't drift on either render path.
 */

import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import { Digest, type DigestProps } from "../../src/app/components/suppr/digest";
import type { WeeklyCheckin } from "../../src/lib/nutrition/weeklyCheckin";

const emptyProps: DigestProps = {
  weekKey: "2026-W21",
  weekLabel: "May 18–24",
  daysLogged: 0,
  mealsLogged: 0,
  headline: "Quiet week.",
  stats: {
    streakDays: 0,
    streakFreezesAvailable: 0,
    avgCalories: 0,
    avgProtein: 0,
    proteinAdherencePct: null,
    weightDeltaKg: null,
    weightFirstKg: null,
    weightLastKg: null,
  },
  narrative: { closestToTarget: null, maintenanceLine: null, usualMeal: null },
  shareText: "My week on Suppr",
  state: "empty",
  onShare: () => {},
  onDismiss: () => {},
};

// A first_week check-in payload — the cascade emits this whenever last
// week's TDEE snapshot is missing (also true on a returning user's first
// visit this week).
const firstWeekCheckin: WeeklyCheckin = {
  kind: "first_week",
  direction: "flat",
  headline: "Your check-in starts after 7 days of data.",
  whyLine: "",
  deltaLine: "",
  intakeLine: "",
  weightLine: "",
  tdeeDeltaKcal: null,
  weightDeltaKg: null,
  intakeDeltaKcal: null,
};

describe("Digest legacy — history-aware empty subline", () => {
  it("cold start (no history) keeps the 'starts here' promise", () => {
    render(<Digest {...emptyProps} hasHistory={false} />);
    const sub = screen.getByTestId("digest-subline").textContent ?? "";
    expect(sub).toContain("come back after your first meal");
    expect(sub).not.toContain("This week's recap builds as you log");
  });

  it("returning user (history) gets week-scoped copy, not cold-start copy", () => {
    render(<Digest {...emptyProps} hasHistory />);
    const sub = screen.getByTestId("digest-subline").textContent ?? "";
    expect(sub).toContain("This week's recap builds as you log");
    expect(sub).not.toContain("come back after your first meal");
  });
});

describe("Digest legacy — history-aware first_week check-in headline", () => {
  it("renders the cold-start headline when there's no history", () => {
    render(
      <Digest
        {...emptyProps}
        daysLogged={2}
        state="success"
        narrative={{
          closestToTarget: null,
          maintenanceLine: null,
          usualMeal: null,
          weeklyCheckin: firstWeekCheckin,
        }}
        hasHistory={false}
      />,
    );
    expect(
      screen.getByTestId("digest-weekly-checkin-headline").textContent,
    ).toBe("Your check-in starts after 7 days of data.");
  });

  it("swaps to a week-scoped headline when the account has history", () => {
    render(
      <Digest
        {...emptyProps}
        daysLogged={2}
        state="success"
        narrative={{
          closestToTarget: null,
          maintenanceLine: null,
          usualMeal: null,
          weeklyCheckin: firstWeekCheckin,
        }}
        hasHistory
      />,
    );
    const headline = screen.getByTestId(
      "digest-weekly-checkin-headline",
    ).textContent;
    expect(headline).toBe("Your check-in updates as you log this week.");
    expect(headline).not.toContain("7 days");
  });
});

describe("Digest blended (ENG-740) — history-aware empty subline", () => {
  it("cold start keeps the cold-start subline", () => {
    render(<Digest {...emptyProps} blended hasHistory={false} />);
    const sub = screen.getByTestId("digest-hero-empty-sub").textContent ?? "";
    expect(sub).toContain("come back after your first meal");
  });

  it("returning user gets week-scoped subline", () => {
    render(<Digest {...emptyProps} blended hasHistory />);
    const sub = screen.getByTestId("digest-hero-empty-sub").textContent ?? "";
    expect(sub).toContain("This week's recap builds as you log");
    expect(sub).not.toContain("come back after your first meal");
  });
});
