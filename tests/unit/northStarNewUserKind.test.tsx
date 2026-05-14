/**
 * ENG-94 — `new-user` NorthStar kind on day-1 users.
 *
 * The 2026-04-30 audit flagged the default suggestion card showing
 * a "1,128-kcal steak bowl · Close fit" before the user had logged
 * anything. The algorithm was pattern-matching on targets alone —
 * felt presumptuous. New `new-user` kind renders a calm
 * "Log your first meal" card instead until ≥ 1 meal exists in the
 * user's history.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import * as React from "react";

import { NorthStarBlock } from "../../src/app/components/suppr/north-star-block";

describe("NorthStarBlock — `new-user` kind", () => {
  it("renders the calm 'Log your first meal' card with the data-slot attribute", () => {
    const { getByTestId, container } = render(
      <NorthStarBlock kind="new-user" testID="ns-new-user" />,
    );
    const node = getByTestId("ns-new-user");
    expect(node).toBeTruthy();
    expect(container.textContent ?? "").toContain("Log your first meal");
    expect(node.getAttribute("data-slot")).toBe("north-star-new-user");
  });

  it("does not render an Open Library button (no CTA for fresh users)", () => {
    const { container } = render(<NorthStarBlock kind="new-user" />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });

  it("does not render any 'Close fit' / 'Hits within' band copy", () => {
    const { container } = render(<NorthStarBlock kind="new-user" />);
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toContain("close fit");
    expect(text.toLowerCase()).not.toContain("hits within");
    expect(text).not.toMatch(/\d+\s*kcal/i);
  });
});
