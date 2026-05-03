// @vitest-environment jsdom
/**
 * Web `<EmptyState />` upgrade pin (ui-critic finding #6, P1).
 *
 * The web primitive lifted to a 72px illustration disc + 17px headline
 * + 14px body + optional CTA, mirroring the mobile shape. Backwards
 * compatible — callers that pass only `title` still render.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { EmptyState } from "../../src/app/components/suppr/empty-state";

void React;

describe("EmptyState (web) — 72px illustration + headline ladder + CTA", () => {
  it("back-compat: renders only `title` when nothing else is provided", () => {
    const { container } = render(
      <EmptyState title="Nothing to re-log yet." />,
    );
    expect(container.textContent).toContain("Nothing to re-log yet.");
    // No 72px disc when no illustration is passed — verifies the disc
    // is gated on the prop, not always rendered.
    expect(container.querySelector(".size-\\[72px\\]")).toBeNull();
  });

  it("renders the 72px primary-tinted disc when `illustration` is provided", () => {
    const { container } = render(
      <EmptyState
        illustration={<svg data-testid="illustration-svg" />}
        title="No favourites yet."
      />,
    );
    const disc = container.querySelector(
      "div.size-\\[72px\\].rounded-full.bg-primary\\/10",
    );
    expect(disc).not.toBeNull();
    expect(disc?.querySelector('[data-testid="illustration-svg"]')).not.toBeNull();
  });

  it("title uses 17px / leading-[22px] (mirrors mobile Type.headline)", () => {
    const { container } = render(<EmptyState title="My title" />);
    const titleP = container.querySelector("p.text-\\[17px\\]");
    expect(titleP).not.toBeNull();
    expect(titleP?.textContent).toBe("My title");
    // The legacy 13px size must be gone.
    expect(container.querySelector("p.text-\\[13px\\]")).toBeNull();
  });

  it("description uses text-sm (14px — mirrors mobile Type.body)", () => {
    const { container } = render(
      <EmptyState
        title="My title"
        description="A factual description sentence."
      />,
    );
    const descP = container.querySelector("p.text-sm");
    expect(descP).not.toBeNull();
    expect(descP?.textContent).toBe("A factual description sentence.");
  });

  it("renders all four slots together (illustration + title + description + CTA)", () => {
    const { container, getByText } = render(
      <EmptyState
        illustration={<svg data-testid="illustration-svg" />}
        title="No favourites yet."
        description="Star meals you log often for one-tap re-logging."
        cta={<button data-testid="cta-button">Browse recipes</button>}
      />,
    );
    expect(
      container.querySelector("div.size-\\[72px\\].rounded-full.bg-primary\\/10"),
    ).not.toBeNull();
    expect(getByText("No favourites yet.")).toBeInTheDocument();
    expect(
      getByText("Star meals you log often for one-tap re-logging."),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-testid="cta-button"]')).not.toBeNull();
  });

  it("renders the CTA slot when `cta` is passed and prefers it over `action`", () => {
    const { container, rerender } = render(
      <EmptyState
        title="Nothing to re-log yet."
        cta={<button data-testid="cta-button">Browse recipes</button>}
      />,
    );
    expect(container.querySelector('[data-testid="cta-button"]')).not.toBeNull();

    rerender(
      <EmptyState
        title="Nothing to re-log yet."
        action={<button data-testid="action-button">Action</button>}
        cta={<button data-testid="cta-button">CTA</button>}
      />,
    );
    expect(container.querySelector('[data-testid="cta-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="action-button"]')).toBeNull();
  });
});
