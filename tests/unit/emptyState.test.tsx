import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../../src/app/components/suppr/empty-state";
// React is imported above so the JSX runtime in vitest/jsdom can resolve it.
void React;

/**
 * Tests for the shared <EmptyState /> primitive (audit M5, 2026-04-18).
 * Verifies shape: title required, description optional, action optional,
 * icon optional. Replaces the 4 bespoke empty-state renderers that used
 * to live in QuickAddPanel + SavedMealsTab.
 */

describe("EmptyState (audit M5)", () => {
  it("renders the title", () => {
    render(<EmptyState title="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });

  it("renders an optional description when provided", () => {
    render(<EmptyState title="Title" description="Helpful description." />);
    expect(screen.getByText("Helpful description.")).toBeInTheDocument();
  });

  it("does not render a description node when none is supplied", () => {
    const { container } = render(<EmptyState title="Just a title" />);
    // Only the title `<p>` should exist inside the empty-state container.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });

  it("renders an optional action slot", () => {
    render(
      <EmptyState
        title="No meals"
        action={<button type="button">Log a meal</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Log a meal" })).toBeInTheDocument();
  });

  it("renders rich title content (e.g. inline <span>)", () => {
    render(
      <EmptyState
        title={
          <>
            Log 2 or more items in a slot, then tap{" "}
            <span className="font-medium">Save these as a meal</span> to re-log it.
          </>
        }
      />,
    );
    expect(screen.getByText("Save these as a meal")).toBeInTheDocument();
  });

  it("marks the icon slot aria-hidden so screen readers skip it", () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="icon" role="img" aria-label="star" />}
        title="Favourites empty"
      />,
    );
    const iconWrap = container.querySelector('[aria-hidden="true"]');
    expect(iconWrap).not.toBeNull();
  });

  it("accepts a custom className on the root", () => {
    const { container } = render(
      <EmptyState title="x" className="my-special-class" />,
    );
    expect(container.firstChild).toHaveClass("my-special-class");
  });
});
