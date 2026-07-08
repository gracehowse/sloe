/**
 * Targets surface render test (Claude Design 2026-04-20).
 *
 * Pins the desktop-web content-pane layout for the new Targets view:
 *  - Breadcrumb `Account · Targets · <short date>`.
 *  - Title + subtitle "Estimated daily burn (TDEE) based on Mifflin-St
 *    Jeor · <activity>" (ENG-1469 gloss, default-ON).
 *  - Daily calorie target card + Goal card in the top row.
 *  - 4-tile macro grid: PROTEIN / CARBS / FAT / FIBER.
 *
 * The Supabase client + auth session are mocked so the component runs
 * without a network round-trip. Weight + goal-weight are null on the
 * default seed so we also cover the "no goal set" path.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

const appDataState: {
  current: {
    nutritionTargets: { calories: number; protein: number; carbs: number; fat: number; fiber: number; waterMl: number };
    nutritionByDay: Record<string, unknown>;
    profileMeasurementSystem: "metric" | "imperial";
  };
} = {
  current: {
    nutritionTargets: { calories: 2100, protein: 150, carbs: 220, fat: 60, fiber: 30, waterMl: 2500 },
    nutritionByDay: {},
    profileMeasurementSystem: "metric",
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

vi.mock("../../src/context/AuthSessionContext.tsx", () => ({
  useAuthSession: () => ({ authedUserId: null }),
}));

// Supabase profile read is gated on `authedUserId` being set; with
// null the effect bails before touching Supabase. The client is still
// imported at module-load time, so stub it to a minimal shape.
vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  },
}));

import { Targets } from "../../src/app/components/Targets";

describe("Targets surface (Claude Design 2026-04-20)", () => {
  beforeEach(() => {
    appDataState.current = {
      ...appDataState.current,
      nutritionTargets: { calories: 2100, protein: 150, carbs: 220, fat: 60, fiber: 30, waterMl: 2500 },
      nutritionByDay: {},
    };
  });

  it("renders the breadcrumb row `Account · Targets · <date>`", () => {
    render(<Targets onNavigate={() => {}} />);
    const crumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    const text = crumb.textContent ?? "";
    expect(text).toMatch(/Account/);
    expect(text).toMatch(/Targets/);
    // en-US format — "Mon, Apr 20".
    expect(text).toMatch(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}/);
  });

  it("renders title 'Targets' and the Mifflin-St Jeor subtitle", () => {
    render(<Targets onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: /Targets/i })).toBeInTheDocument();
    // ENG-1469 — the subtitle is gloss-gated (onboarding_jargon_gloss_v1,
    // default-ON per ENG-1461), so it now reads "Estimated daily burn
    // (TDEE) based on Mifflin-St Jeor" rather than the bare-acronym form.
    expect(
      screen.getByText(/Estimated daily burn \(TDEE\) based on Mifflin-St Jeor · moderate activity/i),
    ).toBeInTheDocument();
  });

  it("renders the Daily calorie target card with the number from AppData", () => {
    render(<Targets onNavigate={() => {}} />);
    expect(screen.getByText(/Daily calorie target/i)).toBeInTheDocument();
    // 2100 renders thousands-separated as "2,100".
    expect(screen.getByText("2,100")).toBeInTheDocument();
  });

  it("shows the 'No goal set' empty state when goal weight is absent", () => {
    render(<Targets onNavigate={() => {}} />);
    expect(screen.getByText(/No goal set/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Set a goal/i }),
    ).toBeInTheDocument();
  });

  it("renders a 4-tile macro grid (Protein / Carbs / Fat / Fiber) with `N / target g` values", () => {
    render(<Targets onNavigate={() => {}} />);
    // Tile overlines.
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Carbs")).toBeInTheDocument();
    expect(screen.getByText("Fat")).toBeInTheDocument();
    expect(screen.getByText("Fiber")).toBeInTheDocument();
    // Target suffixes — one per tile.
    expect(screen.getByText("/ 150 g")).toBeInTheDocument();
    expect(screen.getByText("/ 220 g")).toBeInTheDocument();
    expect(screen.getByText("/ 60 g")).toBeInTheDocument();
    expect(screen.getByText("/ 30 g")).toBeInTheDocument();
    // Each tile is a button with an aria-label for the macro edit path.
    expect(
      screen.getByRole("button", { name: /Edit Protein target/i }),
    ).toBeInTheDocument();
  });
});
