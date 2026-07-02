/**
 * CoachScreen (web) — "What to eat next" empty-state branches (ENG-1294).
 *
 * `assembleCandidates` returns `[]` both when the user is over budget and
 * when there is genuinely nothing to rank. The screen must branch on the
 * SHARED `coachEmptyStateCopy` helper so a fully-logged user is never told
 * to "log a meal", and so web + mobile render identical strings
 * (mobile mirror: `apps/mobile/tests/unit/coachScreenEmptyState.test.tsx`).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string | { pathname?: string } }>) => (
    <a href={typeof href === "string" ? href : (href?.pathname ?? "#")} {...rest}>
      {children}
    </a>
  ),
}));

import { CoachScreen } from "@/app/components/suppr/coach-screen";
import {
  COACH_EMPTY_NO_RECIPES_COPY,
  COACH_EMPTY_OVER_BUDGET_COPY,
} from "@/lib/nutrition/mealCoach";

function renderEmpty(over: { librarySize: number; remainingCalories: number }) {
  return render(
    <CoachScreen
      narrative="A calm read of the day."
      candidates={[]}
      librarySize={over.librarySize}
      remainingCalories={over.remainingCalories}
      selectedChipId={null}
      askAnswer={null}
      askLoading={false}
      onAskChip={() => {}}
    />,
  );
}

describe("CoachScreen empty states (ENG-1294)", () => {
  it("shows the over-budget/day-done copy when the library has recipes but remaining ≤ 0", () => {
    renderEmpty({ librarySize: 8, remainingCalories: -120 });
    expect(screen.getByText(COACH_EMPTY_OVER_BUDGET_COPY)).toBeInTheDocument();
    // Never tell a fully-logged user to log a meal.
    expect(screen.queryByText(/log a meal/i)).toBeNull();
  });

  it("keeps the saved-recipes copy for the genuinely-no-recipes case", () => {
    renderEmpty({ librarySize: 0, remainingCalories: 1400 });
    expect(screen.getByText(COACH_EMPTY_NO_RECIPES_COPY)).toBeInTheDocument();
    expect(screen.queryByText(COACH_EMPTY_OVER_BUDGET_COPY)).toBeNull();
  });
});
