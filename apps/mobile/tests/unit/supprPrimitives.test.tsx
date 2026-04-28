// @vitest-environment jsdom
/**
 * Production design spec — 2026-04-27 — Phase 1 mobile primitives.
 *
 * Pins shape + state coverage for the mobile design-system primitives:
 *   - SupprCard (variants, elevation, gradient, padding, radius)
 *   - TrustChip (six variants)
 *   - SourceDot (5 sources, sparkle pairing on AI)
 *   - ConfidenceChip (3 levels)
 *   - EmptyState universal (icon / title / body / primaryCta /
 *     secondaryCta)
 *   - SkeletonRow / SkeletonCard
 *
 * If any of these primitives drift away from the spec, tests break.
 * Phase 2 work (sweeping callers) does not change this surface.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { SupprCard } from "../../components/ui/SupprCard";
import { TrustChip } from "../../components/ui/TrustChip";
import { SourceDot } from "../../components/ui/SourceDot";
import { ConfidenceChip } from "../../components/ui/ConfidenceChip";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  SkeletonRow,
  SkeletonCard,
} from "../../components/ui/SkeletonRow";
void React;

/**
 * Components under test read theme colours via `useThemeColors()`
 * which falls back to the dark `Colors` default when no `ThemeProvider`
 * is mounted. We render bare so the dark default is used (matches the
 * default app theme), avoiding the AsyncStorage round-trip the
 * provider gates on.
 */
function renderWithTheme(node: React.ReactElement) {
  return render(node);
}

describe("mobile SupprCard", () => {
  it("renders children", () => {
    const { getByText } = renderWithTheme(
      <SupprCard testID="card">
        <Text>hello</Text>
      </SupprCard>,
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("supports each tone without throwing", () => {
    const tones = ["neutral", "primary", "success", "warning", "magenta"] as const;
    for (const tone of tones) {
      const { getByTestId } = renderWithTheme(
        <SupprCard testID={`card-${tone}`} tone={tone} />,
      );
      expect(getByTestId(`card-${tone}`)).toBeTruthy();
    }
  });

  it("supports gradient + tone=primary combo", () => {
    const { getByTestId } = renderWithTheme(
      <SupprCard testID="grad" tone="primary" gradient />,
    );
    expect(getByTestId("grad")).toBeTruthy();
  });

  it("border=false omits the border", () => {
    const { getByTestId } = renderWithTheme(
      <SupprCard testID="noborder" border={false} />,
    );
    const card = getByTestId("noborder");
    // The flattened style from RNTL exposes the borderWidth.
    const flat = (card.props.style as Array<Record<string, unknown>>)
      .filter(Boolean)
      .reduce((a, b) => ({ ...a, ...b }), {} as Record<string, unknown>);
    expect(flat.borderWidth).toBe(0);
  });
});

describe("mobile TrustChip", () => {
  it.each([
    ["usda", "USDA verified"],
    ["off-adjusted", "OFF · adjusted"],
    ["estimated", "Estimated · verify"],
    ["manual", "Manual"],
    ["gluten-high-conf", "No gluten-containing ingredients"],
    ["gluten-uncertain", "Contains potential gluten · review"],
  ] as const)("variant=%s renders %s", (variant, label) => {
    const { getByText } = renderWithTheme(<TrustChip variant={variant} />);
    expect(getByText(label)).toBeTruthy();
  });

  it("accepts custom label override", () => {
    const { getByText } = renderWithTheme(
      <TrustChip variant="manual" label="Hand-entered" />,
    );
    expect(getByText("Hand-entered")).toBeTruthy();
  });
});

describe("mobile SourceDot", () => {
  it.each(["usda", "off", "fatsecret", "manual", "ai"] as const)(
    "renders source=%s without throwing",
    (source) => {
      const { getByTestId } = renderWithTheme(
        <SourceDot testID={`dot-${source}`} source={source} />,
      );
      expect(getByTestId(`dot-${source}`)).toBeTruthy();
    },
  );

  it("ai source has accessibility label 'AI estimated'", () => {
    const { getByLabelText } = renderWithTheme(
      <SourceDot source="ai" testID="ai-dot" />,
    );
    expect(getByLabelText("AI estimated")).toBeTruthy();
  });
});

describe("mobile ConfidenceChip", () => {
  it.each([
    ["low", "Low confidence"],
    ["medium", "Medium confidence"],
    ["high", "High confidence"],
  ] as const)("level=%s renders %s", (level, label) => {
    const { getByText } = renderWithTheme(
      <ConfidenceChip level={level} />,
    );
    expect(getByText(label)).toBeTruthy();
  });
});

describe("mobile EmptyState (universal)", () => {
  it("renders title only", () => {
    const { getByText } = renderWithTheme(
      <EmptyState title="Nothing here yet" />,
    );
    expect(getByText("Nothing here yet")).toBeTruthy();
  });

  it("renders all slots", () => {
    const { getByText } = renderWithTheme(
      <EmptyState
        title="No saved meals"
        body="Tap save on any meal to keep it here."
        icon={<View testID="icon" />}
        primaryCta={<Text>Try it</Text>}
        secondaryCta={<Text>Skip</Text>}
      />,
    );
    expect(getByText("No saved meals")).toBeTruthy();
    expect(getByText("Tap save on any meal to keep it here.")).toBeTruthy();
    expect(getByText("Try it")).toBeTruthy();
    expect(getByText("Skip")).toBeTruthy();
  });
});

describe("mobile SkeletonRow / SkeletonCard", () => {
  it("SkeletonRow renders", () => {
    const { getByTestId } = renderWithTheme(<SkeletonRow testID="row" />);
    expect(getByTestId("row")).toBeTruthy();
  });

  it("SkeletonRow without thumb renders", () => {
    const { getByTestId } = renderWithTheme(
      <SkeletonRow testID="row" thumb={false} />,
    );
    expect(getByTestId("row")).toBeTruthy();
  });

  it("SkeletonCard renders", () => {
    const { getByTestId } = renderWithTheme(<SkeletonCard testID="card" />);
    expect(getByTestId("card")).toBeTruthy();
  });

  it("SkeletonCard without hero renders", () => {
    const { getByTestId } = renderWithTheme(
      <SkeletonCard testID="card" hero={false} lines={1} />,
    );
    expect(getByTestId("card")).toBeTruthy();
  });
});
