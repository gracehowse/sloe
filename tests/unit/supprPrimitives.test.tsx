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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

// Redesign 2026 ships default-ON (`REDESIGN_DEFAULT_ON` in `track.ts`). This
// file pins the pre-redesign FLAT primitive treatment, so force the design-
// system flags OFF via the same `window.__SUPPR_FORCE_FLAGS__` hook `track.ts`
// honours — an explicit `false` wins over the default-on. The redesign on-state
// is covered by Storybook + Chromatic. (Reconciliation 2026-06-01: keep the
// flat path under test.)
const FLAT_FLAGS = {
  design_system_colours: false,
} as const;
beforeEach(() => {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    ...FLAT_FLAGS,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("SupprCard", () => {
  it("renders children with default neutral tone + flat slab elevation (system contract)", () => {
    render(
      <SupprCard data-testid="card">
        <span>hello</span>
      </SupprCard>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-tone", "neutral");
    // SupprCard DEFAULT stays flat. Under the one card grammar (ENG-1497/
    // 1499, docs/decisions/2026-07-10-card-grammar-rounder-flat.md) both the
    // `slab-flat` default and the `card` tier resolve to the same flat +
    // hairline `.card-slab` class (`.card-slab-flat` retired — it had become
    // byte-identical); painted via the class, not inline boxShadow.
    expect(card).toHaveAttribute("data-elevation", "slab-flat");
    expect(card.getAttribute("data-flat-slab")).toBe("true");
    expect(card.className.split(/\s+/)).toContain("card-slab");
    expect(card.style.boxShadow).toBe("");
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

  it("uses --radius-card-lg (24px, the Sloe warm-slab corner) by default (lg)", () => {
    render(<SupprCard data-testid="card" />);
    expect(screen.getByTestId("card").className).toMatch(
      /rounded-\[var\(--radius-card-lg\)\]/,
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
    ["usda", "USDA"],
    ["off-adjusted", "OFF · adjusted"],
    ["estimated", "Estimated · verify"],
    ["manual", "Manual"],
    ["gluten-high-conf", "No gluten-containing ingredients"],
    ["gluten-uncertain", "Contains potential gluten · review"],
  ] as const)("variant=%s renders label %s", (variant, label) => {
    render(<TrustChip variant={variant} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("emits a Check glyph on usda + off-adjusted", () => {
    for (const v of ["usda", "off-adjusted"] as const) {
      const { container } = render(<TrustChip variant={v} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("class") ?? "").toContain("lucide-check");
    }
  });

  it("emits a Sparkles glyph on estimated + gluten-uncertain", () => {
    for (const v of ["estimated", "gluten-uncertain"] as const) {
      const { container } = render(<TrustChip variant={v} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("class") ?? "").toContain("lucide-sparkles");
    }
  });

  // ENG-748: the gluten high-confidence chip must NOT render the
  // verified Check glyph on a coeliac surface — it uses the Sparkles
  // ("estimated") glyph so it never reads as a safety guarantee.
  it("gluten-high-conf emits Sparkles, NOT Check (ENG-748)", () => {
    const { container } = render(<TrustChip variant="gluten-high-conf" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    const cls = svg?.getAttribute("class") ?? "";
    expect(cls).toContain("lucide-sparkles");
    expect(cls).not.toContain("lucide-check");
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

  it("uses foreground-secondary on soft grey (NOT warning/destructive)", () => {
    const { container } = render(<ConfidenceChip level="low" />);
    const chip = container.querySelector('[data-slot="confidence-chip"]');
    expect(chip).toHaveAttribute("data-level", "low");
    // WCAG-safe on soft background — not --warning / --destructive / --confidence-neutral.
    expect((chip as HTMLElement).style.color).toBe(
      "var(--foreground-secondary)",
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
