// @vitest-environment jsdom
/**
 * ImportDetectedChip (ENG-1225 #3) — renders a "Detected: {label}" chip per
 * classified kind, and nothing for empty input.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportDetectedChip } from "../../src/app/components/suppr/import-detected-chip";
import { __resetForcedFlagSeedForTests } from "../../src/lib/analytics/track";

beforeEach(() => {
  __resetForcedFlagSeedForTests();
  window.localStorage.removeItem("__suppr_force_flags__");
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ImportDetectedChip", () => {
  it("shows the detect row subline for CSV when v3 polish is on", () => {
    const { getByTestId } = render(
      <ImportDetectedChip input="my-fitness-pal-export.csv" />,
    );
    const chip = getByTestId("import-detected-chip");
    expect(chip.getAttribute("data-variant")).toBe("row");
    expect(chip.textContent).toContain("Bring your diary history across");
  });

  it("shows the detected label + kind for a TikTok link", () => {
    const { getByTestId } = render(<ImportDetectedChip input="https://vm.tiktok.com/ZMabc/" />);
    const chip = getByTestId("import-detected-chip");
    expect(chip.getAttribute("data-kind")).toBe("social");
    expect(chip.textContent).toContain("TikTok video");
    expect(chip.textContent).toContain("Detected:");
  });

  it("labels a CSV export", () => {
    const csv = "Date,Meal,Calories,Protein\n2026-06-20,Breakfast,320,12\n2026-06-20,Lunch,440,38";
    const { getByTestId } = render(<ImportDetectedChip input={csv} />);
    expect(getByTestId("import-detected-chip").getAttribute("data-kind")).toBe("csv");
    expect(getByTestId("import-detected-chip").textContent).toContain("Nutrition export");
  });

  it("labels a saved Instagram collection", () => {
    const { getByTestId } = render(
      <ImportDetectedChip input="https://www.instagram.com/chef/saved/recipes/123/" />,
    );
    const chip = getByTestId("import-detected-chip");
    expect(chip.getAttribute("data-kind")).toBe("collection");
    expect(chip.textContent).toContain("Instagram saved collection");
  });

  it("renders nothing for empty input", () => {
    const { queryByTestId } = render(<ImportDetectedChip input="   " />);
    expect(queryByTestId("import-detected-chip")).toBeNull();
  });
});
