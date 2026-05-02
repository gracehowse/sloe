/**
 * TodayMicrosWidget (web) — pin the 4-tile micros widget rendering.
 *
 * Mirrors `apps/mobile/tests/unit/todayMicrosWidget.test.tsx`. Web and
 * mobile share the same `dailyValuePercent` helper and the same colour
 * ramp semantics; this file pins the web bar fill colour-var the same
 * way the mobile test pins the RN style colour. If the two tests
 * diverge, parity has broken — fix at the helper layer, not here.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayMicrosWidget } from "../../src/app/components/suppr/today-micros-widget";

describe("TodayMicrosWidget (web)", () => {
  it("renders the four headline nutrient tiles", () => {
    render(
      <TodayMicrosWidget
        microSum={{ ironMg: 9, vitaminDMcg: 10, sodiumMg: 1150 }}
        fiberG={14}
      />,
    );
    expect(screen.getByText("Fiber")).toBeTruthy();
    expect(screen.getByText("Iron")).toBeTruthy();
    expect(screen.getByText("Vit D")).toBeTruthy();
    expect(screen.getByText("Sodium")).toBeTruthy();

    expect(screen.getByTestId("today-micros-tile-fiberG")).toBeTruthy();
    expect(screen.getByTestId("today-micros-tile-ironMg")).toBeTruthy();
    expect(screen.getByTestId("today-micros-tile-vitaminDMcg")).toBeTruthy();
    expect(screen.getByTestId("today-micros-tile-sodiumMg")).toBeTruthy();
  });

  it("renders 50% DV captions for each tile under the fixture inputs", () => {
    render(
      <TodayMicrosWidget
        microSum={{ ironMg: 9, vitaminDMcg: 10, sodiumMg: 1150 }}
        fiberG={14}
      />,
    );
    // 4 tiles all at exactly 50%.
    expect(screen.getAllByText("50% DV")).toHaveLength(4);
  });

  it("paints sodium green at 50% DV (below 80% warning gate)", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 1150 }} fiberG={0} />);
    const fill = screen.getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.style.background).toContain("var(--success)");
  });

  it("paints sodium amber at 80% DV (warning gate)", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 1840 }} fiberG={0} />);
    const fill = screen.getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.style.background).toContain("var(--warning)");
  });

  it("paints sodium amber at 99% DV (still warning, not danger)", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 2277 }} fiberG={0} />);
    const fill = screen.getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.style.background).toContain("var(--warning)");
  });

  it("paints sodium red at 100% DV (limit reached)", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 2300 }} fiberG={0} />);
    const fill = screen.getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.style.background).toContain("var(--destructive)");
  });

  it("paints sodium red at 120% DV (over limit) and caps the bar fill at 100%", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 2760 }} fiberG={0} />);
    const fill = screen.getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.style.background).toContain("var(--destructive)");
    expect(fill.style.width).toBe("100%");
    expect(screen.getByText("120% DV")).toBeTruthy();
  });

  it("keeps non-limit nutrients green even when over target", () => {
    render(<TodayMicrosWidget microSum={{ ironMg: 36 }} fiberG={56} />);
    const ironFill = screen.getByTestId("today-micros-bar-fill-ironMg");
    const fiberFill = screen.getByTestId("today-micros-bar-fill-fiberG");
    expect(ironFill.style.background).toContain("var(--success)");
    expect(fiberFill.style.background).toContain("var(--success)");
  });

  it("renders 0% across all tiles when microSum is empty and fiber is zero", () => {
    render(<TodayMicrosWidget microSum={{}} fiberG={0} />);
    expect(screen.getAllByText("0% DV")).toHaveLength(4);
  });

  it("treats null microSum as empty (defensive)", () => {
    render(<TodayMicrosWidget microSum={null} fiberG={0} />);
    expect(screen.getAllByText("0% DV")).toHaveLength(4);
  });

  it("exposes progressbar aria semantics for screen readers", () => {
    render(<TodayMicrosWidget microSum={{ sodiumMg: 1150 }} fiberG={14} />);
    const sodiumBar = screen.getByTestId("today-micros-bar-sodiumMg");
    expect(sodiumBar.getAttribute("role")).toBe("progressbar");
    expect(sodiumBar.getAttribute("aria-valuenow")).toBe("50");
    expect(sodiumBar.getAttribute("aria-label")).toContain("Sodium 50% of daily value");
  });
});
