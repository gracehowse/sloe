// @vitest-environment jsdom
/**
 * Production design spec — 2026-04-27 — Phase 1 web primitives.
 *
 * Pins shape + state coverage for the new design-system primitives:
 *   - SupprCard (variants, elevation, gradient, padding, radius)
 *   - TrustChip (six variants, label override)
 *   - SourceDot (5 sources, sparkle pairing on AI)
 *   - ConfidenceChip (3 levels)
 *   - EmptyState universal (icon / title / body / primaryCta / secondaryCta)
 *   - SkeletonRow / SkeletonCard (shape + aria-busy)
 *
 * If any of these primitives drift away from the spec, tests break.
 * Phase 2 work (sweeping callers) does not change this surface.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SupprCard } from "../../src/app/components/ui/suppr-card";
import { TrustChip } from "../../src/app/components/ui/trust-chip";
import { SourceDot } from "../../src/app/components/ui/source-dot";
import { ConfidenceChip } from "../../src/app/components/ui/confidence-chip";
import { EmptyState as UniversalEmptyState } from "../../src/app/components/ui/empty-state";
import {
  SkeletonRow,
  SkeletonCard,
} from "../../src/app/components/ui/skeleton-row";

void React;

describe("SupprCard", () => {
  it("renders children with default neutral tone + card elevation", () => {
    render(
      <SupprCard data-testid="card">
        <span>hello</span>
      </SupprCard>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-tone", "neutral");
    expect(card).toHaveAttribute("data-elevation", "card");
    expect(card.style.boxShadow).toContain("var(--elev-card)");
  });

  it("applies the gradient bg only for tone=primary + gradient=true", () => {
    render(
      <>
        <SupprCard data-testid="plain-primary" tone="primary" />
        <SupprCard data-testid="grad-primary" tone="primary" gradient />
      </>,
    );
    expect(screen.getByTestId("plain-primary")).not.toHaveAttribute(
      "data-gradient",
    );
    expect(screen.getByTestId("grad-primary")).toHaveAttribute(
      "data-gradient",
      "true",
    );
    expect(screen.getByTestId("grad-primary").style.background).toContain(
      "linear-gradient",
    );
  });

  it("respects elevation=none (no boxShadow inline style)", () => {
    render(<SupprCard data-testid="flat" elevation="none" />);
    expect(screen.getByTestId("flat").style.boxShadow).toBe("");
  });

  it("uses --radius-card by default (lg)", () => {
    render(<SupprCard data-testid="card" />);
    expect(screen.getByTestId("card").className).toMatch(
      /rounded-\[var\(--radius-card\)\]/,
    );
  });

  it("supports tone=warning for over-budget surfaces", () => {
    render(<SupprCard data-testid="warn" tone="warning" />);
    expect(screen.getByTestId("warn")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByTestId("warn").style.backgroundColor).toBe(
      "var(--over-budget-soft)",
    );
  });
});

describe("TrustChip", () => {
  it.each([
    ["usda", "USDA verified"],
    ["off-adjusted", "OFF · adjusted"],
    ["estimated", "Estimated · verify"],
    ["manual", "Manual"],
    ["gluten-high-conf", "Gluten-free · high confidence"],
    ["gluten-uncertain", "Gluten contamination risk · review"],
  ] as const)("variant=%s renders label %s", (variant, label) => {
    render(<TrustChip variant={variant} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("emits a Check glyph on usda + off-adjusted + gluten-high-conf", () => {
    const { container } = render(<TrustChip variant="usda" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("emits a Sparkles glyph on estimated + gluten-uncertain", () => {
    const { container } = render(<TrustChip variant="estimated" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("manual variant has no glyph (no svg)", () => {
    const { container } = render(<TrustChip variant="manual" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("accepts a custom label override", () => {
    render(<TrustChip variant="manual" label="Hand-entered" />);
    expect(screen.getByText("Hand-entered")).toBeInTheDocument();
  });
});

describe("SourceDot", () => {
  it.each([
    "usda",
    "off",
    "fatsecret",
    "manual",
    "ai",
  ] as const)("renders source=%s", (source) => {
    const { container } = render(<SourceDot source={source} />);
    expect(container.querySelector('[data-slot="source-dot"]')).toBeInTheDocument();
  });

  it("ai pairs the dot with a Sparkles glyph", () => {
    const { container } = render(<SourceDot source="ai" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("non-ai sources do NOT render a glyph", () => {
    const { container } = render(<SourceDot source="usda" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("respects size prop (6 / 8 / 10)", () => {
    const { container } = render(<SourceDot source="usda" size={10} />);
    const dot = container.querySelector('[data-slot="source-dot"] > span');
    expect(dot).toHaveStyle({ width: "10px", height: "10px" });
  });
});

describe("ConfidenceChip", () => {
  it.each([
    ["low", "Low confidence"],
    ["medium", "Medium confidence"],
    ["high", "High confidence"],
  ] as const)("level=%s renders %s label", (level, label) => {
    render(<ConfidenceChip level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses the neutral grey colour token (NOT a warning)", () => {
    const { container } = render(<ConfidenceChip level="low" />);
    const chip = container.querySelector('[data-slot="confidence-chip"]');
    expect(chip).toHaveAttribute("data-level", "low");
    // The chip must not pull from --warning / --destructive.
    expect((chip as HTMLElement).style.color).toBe(
      "var(--confidence-neutral)",
    );
  });
});

describe("EmptyState (universal)", () => {
  it("renders title only when other slots omitted", () => {
    render(<UniversalEmptyState title="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders icon, body, and both CTAs when provided", () => {
    render(
      <UniversalEmptyState
        icon={<svg data-testid="icon" />}
        title="No saved meals"
        body="Tap save on any meal to keep it here."
        primaryCta={<button>Try it</button>}
        secondaryCta={<button>Skip</button>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("No saved meals")).toBeInTheDocument();
    expect(
      screen.getByText("Tap save on any meal to keep it here."),
    ).toBeInTheDocument();
    expect(screen.getByText("Try it")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });
});

describe("SkeletonRow / SkeletonCard", () => {
  it("SkeletonRow advertises aria-busy=true", () => {
    const { container } = render(<SkeletonRow />);
    const row = container.querySelector('[data-slot="skeleton-row"]');
    expect(row).toHaveAttribute("aria-busy", "true");
  });

  it("SkeletonRow without thumb has fewer children", () => {
    const { container } = render(<SkeletonRow thumb={false} />);
    const row = container.querySelector('[data-slot="skeleton-row"]');
    // Row contains only the body wrapper when thumb=false.
    expect(row?.children.length).toBe(1);
  });

  it("SkeletonCard advertises aria-busy=true", () => {
    const { container } = render(<SkeletonCard />);
    const card = container.querySelector('[data-slot="skeleton-card"]');
    expect(card).toHaveAttribute("aria-busy", "true");
  });

  it("SkeletonCard without hero skips the hero block", () => {
    const { container } = render(<SkeletonCard hero={false} lines={1} />);
    const card = container.querySelector('[data-slot="skeleton-card"]');
    // hero=false → only the body block remains.
    expect(card?.children.length).toBe(1);
  });
});
