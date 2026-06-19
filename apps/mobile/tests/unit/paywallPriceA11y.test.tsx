// @vitest-environment jsdom
/**
 * ENG-716 — paywall price VoiceOver fix + token sweep (mobile lane).
 *
 * The plan-selector price renders the amount and the "/mo"·"/yr" suffix as two
 * separate Text nodes (serif numeral + small sans suffix). Left bare, VoiceOver
 * reads the suffix literally as "slash m o" / "slash y r". The fix collapses the
 * price block into ONE accessible element with a spoken "<price> per month/year"
 * label and hides the raw children from the a11y tree — the visible price is
 * untouched. The standalone Subscribe CTA gets the same spoken treatment via a
 * `accessibilityLabel` override (visible "/month" stays).
 *
 * Render test for the spoken label + source-assertions for the CTA override and
 * the NutritionSourceBadge token swap.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

void React;

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

/** Strip `//` line + block comments so negative literal-assertions test CODE,
 *  not comments that legitimately cite a token's hex value for documentation. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#655C6E",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    card: "#FFFFFF",
    border: "#E8E2EC",
    borderStrong: "#C9C2D6",
    sourceManual: "#9B93A3",
  }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primary: "#3B2A4D",
    primaryForeground: "#ffffff",
    primarySoft: "rgba(91, 59, 110, 0.12)",
  }),
}));

import { PaywallPlanSelector } from "../../components/paywall/PaywallPlanSelector";

describe("ENG-716 — PaywallPlanSelector price reads naturally to VoiceOver", () => {
  it("annual price block is announced as '<price> per year', not 'slash yr'", () => {
    const { getByLabelText, queryByLabelText } = render(
      <PaywallPlanSelector
        billing="annual"
        onSelect={() => {}}
        annualPriceString="£59.99"
        monthlyPriceString="£7.99"
        savingsBadge="Save 37%"
        annualPerMonthLine="just £5.00/mo"
        showAnnual
        showMonthly
      />,
    );
    // The price block carries one composed, natural label.
    expect(getByLabelText("£59.99 per year")).toBeTruthy();
    // The raw "/yr" suffix is NOT exposed as its own a11y label.
    expect(queryByLabelText("/yr")).toBeNull();
  });

  it("monthly price block is announced as '<price> per month', not 'slash mo'", () => {
    const { getByLabelText, queryByLabelText } = render(
      <PaywallPlanSelector
        billing="monthly"
        onSelect={() => {}}
        annualPriceString="£59.99"
        monthlyPriceString="£7.99"
        savingsBadge={null}
        annualPerMonthLine={null}
        showAnnual
        showMonthly
      />,
    );
    expect(getByLabelText("£7.99 per month")).toBeTruthy();
    expect(queryByLabelText("/mo")).toBeNull();
  });

  it("still renders the visible price + suffix text unchanged", () => {
    const { getByText } = render(
      <PaywallPlanSelector
        billing="monthly"
        onSelect={() => {}}
        annualPriceString="£59.99"
        monthlyPriceString="£7.99"
        savingsBadge={null}
        annualPerMonthLine={null}
        showAnnual={false}
        showMonthly
      />,
    );
    expect(getByText("£7.99")).toBeTruthy();
    expect(getByText("/mo")).toBeTruthy();
  });
});

describe("ENG-716 — paywall CTA + source badge token/a11y source-checks", () => {
  it("PaywallCta accepts a spoken accessibilityLabel override (visible /month stays)", () => {
    const src = read("../../components/paywall/PaywallCta.tsx");
    expect(src).toMatch(/accessibilityLabel\?: string/);
    expect(src).toMatch(/accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  });

  it("paywall screen passes a 'per month/year' spoken label to the Subscribe CTA", () => {
    const src = read("../../app/paywall.tsx");
    expect(src).toMatch(/periodWord = billing === "annual" \? "per year" : "per month"/);
    expect(src).toMatch(/\$\{currentProPkg\.product\.priceString\} \$\{periodWord\}/);
  });

  it("mobile NutritionSourceBadge dropped the cool-slate literal for the warm-grey token", () => {
    const src = read("../../components/NutritionSourceBadge.tsx");
    const code = codeOnly(src);
    expect(code).not.toMatch(/#94a3b8/i);
    expect(code).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(src).toMatch(/colors\.sourceManual/);
  });
});
