/**
 * TodayScrollSectionHeader (web) — Figma TD1/TD2 section chrome.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayScrollSectionHeader } from "../../src/app/components/suppr/today-scroll-section-header";

void React;

describe("TodayScrollSectionHeader (web) — Figma TD1/TD2 section chrome", () => {
  it("renders the plum Newsreader title without a duplicate date on full Today", () => {
    render(<TodayScrollSectionHeader title="Activity & energy" />);
    expect(screen.getByRole("heading", { name: "Activity & energy" })).toBeTruthy();
    expect(screen.queryByText("Friday, 5 June")).toBeNull();
  });

  it("renders an optional date subline for isolated TD frames", () => {
    render(
      <TodayScrollSectionHeader title="Activity & energy" subtitle="Friday, 5 June" />,
    );
    expect(screen.getByText("Friday, 5 June")).toBeTruthy();
  });

  it("applies the 20px bottom gap token via mb-5", () => {
    const { container } = render(
      <TodayScrollSectionHeader title="Hydration & stimulants" subtitle="Today" />,
    );
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/mb-5/);
  });
});
