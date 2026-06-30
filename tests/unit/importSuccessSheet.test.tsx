// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Flag gate — flipped per-test (default OFF, the shipped state).
const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((_flag: string) => false),
}));
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: isFeatureEnabledSpy,
}));

// Mock the celebration leaf so we assert the MOUNT decision (the gate), not the
// SVG/CSS guts — that primitive has its own tests (winMomentPlayer.test.tsx).
vi.mock("../../src/app/components/ui/win-moment-player.tsx", () => ({
  WinMomentPlayer: (props: { testID?: string }) => (
    <div data-testid={props.testID}>win</div>
  ),
}));

import { ImportSuccessSheet } from "../../src/app/components/suppr/import-success-sheet";

function setReducedMotion(matches: boolean) {
  // @ts-expect-error — jsdom matchMedia shim.
  window.matchMedia = (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

function renderSheet() {
  return render(
    <ImportSuccessSheet
      recipeTitle="Sheet-Pan Chicken"
      recipeId="recipe-1"
      macroLine="420 kcal · 32P · 12C · 18F per serving"
      onViewRecipe={() => {}}
    />,
  );
}

beforeEach(() => {
  isFeatureEnabledSpy.mockReturnValue(false);
  setReducedMotion(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ENG-901 M6 — ImportSuccessSheet (web)", () => {
  it("renders saved kicker, title, macro line, and library chip", () => {
    renderSheet();
    expect(screen.getByTestId("import-success-sheet")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Sheet-Pan Chicken")).toBeInTheDocument();
    expect(screen.getByText(/420 kcal/)).toBeInTheDocument();
    expect(screen.getByText("In your library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View recipe" })).toBeInTheDocument();
  });
});

describe("ENG-728 — ImportSuccessSheet magic-moment gate (web)", () => {
  it("flag OFF (default): NO overlay, no settle animation (zero visual change)", () => {
    isFeatureEnabledSpy.mockReturnValue(false);
    renderSheet();
    expect(screen.queryByTestId("import-magic-moment")).toBeNull();
    expect(screen.getByTestId("import-success-sheet")).not.toHaveAttribute(
      "data-magic-moment",
    );
  });

  it("flag ON + motion allowed: mounts the one-shot log-confirm overlay", () => {
    isFeatureEnabledSpy.mockReturnValue(true);
    renderSheet();
    expect(isFeatureEnabledSpy).toHaveBeenCalledWith("import_magic_moment");
    expect(screen.getByTestId("import-magic-moment")).toBeInTheDocument();
    expect(screen.getByTestId("import-success-sheet")).toHaveAttribute(
      "data-magic-moment",
      "on",
    );
  });

  it("flag ON + reduce-motion: NO overlay, no settle (instant — parity with mobile)", () => {
    isFeatureEnabledSpy.mockReturnValue(true);
    setReducedMotion(true);
    renderSheet();
    expect(screen.queryByTestId("import-magic-moment")).toBeNull();
    expect(screen.getByTestId("import-success-sheet")).not.toHaveAttribute(
      "data-magic-moment",
    );
  });
});
