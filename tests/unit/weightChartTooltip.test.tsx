import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeightChartTooltip } from "../../src/app/components/progress/WeightChartTooltip";

/**
 * ENG-1526 — the web weight chart's bespoke callout (replaced the stock default
 * Recharts tooltip). Validates the presentational contract directly, since the
 * live hover needs weight data + a hover the web-drive CLI can't perform.
 */
describe("ENG-1526 — WeightChartTooltip", () => {
  it("shows the hovered point's date, weight value, and unit when active", () => {
    const { container } = render(
      <WeightChartTooltip
        active
        label="12 Jul"
        unit="kg"
        payload={[{ value: 72.5 } as never]}
      />,
    );
    expect(container.textContent).toContain("12 Jul");
    expect(container.textContent).toContain("72.5");
    expect(container.textContent).toContain("kg");
    // tokenised card shell, not the stock white box
    expect(container.querySelector(".bg-card")).not.toBeNull();
  });

  it("renders nothing (no stray box) when inactive or payload is empty", () => {
    const { container: inactive } = render(
      <WeightChartTooltip active={false} unit="kg" payload={[{ value: 72.5 } as never]} />,
    );
    expect(inactive.firstChild).toBeNull();

    const { container: empty } = render(
      <WeightChartTooltip active unit="kg" payload={[]} />,
    );
    expect(empty.firstChild).toBeNull();
  });
});
