// @vitest-environment jsdom
/**
 * ENG-775 — PortionPicker (mobile) render-level gram-invariant tests.
 *
 * Mirror of `tests/unit/portionPickerWebRender.test.tsx` (web↔mobile parity).
 * The pure state math (`switchUnit`/`stateToGrams`) is unit-tested in
 * `tests/unit/portionPicker.test.ts`. THIS test proves the invariant at the
 * RENDER level: driving a unit switch through the real PortionPicker UI (the
 * Modal unit picker) must preserve the entered gram weight and never reset the
 * amount to a default. Guards the food-search convergence (ENG-775) against a
 * wrapper regression that wires `onChange` to a reset instead of `switchUnit`.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { PortionPicker } from "../../components/PortionPicker";
import {
  buildPickerOptions,
  stateToGrams,
  type PortionState,
  type ProductInput,
} from "@suppr/nutrition-core/portionPicker";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    card: "#ffffff",
    cardBorder: "#e4e4ec",
    background: "#fafafa",
    border: "#e4e4ec",
  }),
}));
vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#7c3aed" }),
}));

// Count product: 1 meatball = 22 g, serving = 88 g → units [meatball, serving, gram, ounce].
const PRODUCT: ProductInput = {
  servingOptions: [{ label: "1 meatball", grams: 22 }],
  servingSizeG: 88,
};

function meatballUnit() {
  const u = buildPickerOptions(PRODUCT).units.find((x) => x.kind === "count");
  if (!u) throw new Error("expected a count unit");
  return u;
}

/** Controlled harness so a unit switch re-renders the picker with the new value. */
function Harness({ onState }: { onState: (s: PortionState) => void }) {
  const [value, setValue] = React.useState<PortionState>({ amount: 3, unit: meatballUnit() });
  return (
    <PortionPicker
      product={PRODUCT}
      value={value}
      onChange={(next) => {
        setValue(next);
        onState(next);
      }}
    />
  );
}

describe("PortionPicker (mobile) — render-level gram invariant (ENG-775)", () => {
  it("preserves grams switching count → gram → serving through the unit picker", () => {
    const states: PortionState[] = [];
    const { getByLabelText } = render(<Harness onState={(s) => states.push(s)} />);

    // Start: 3 meatballs = 66 g. Open unit picker, choose gram.
    fireEvent.press(getByLabelText("Change unit"));
    fireEvent.press(getByLabelText("Use gram"));
    expect(stateToGrams(states.at(-1)!)).toBeCloseTo(66, 5);

    // Switch to serving (88 g/serving) — still 66 g.
    fireEvent.press(getByLabelText("Change unit"));
    fireEvent.press(getByLabelText("Use serving"));
    expect(stateToGrams(states.at(-1)!)).toBeCloseTo(66, 5);
  });

  it("does NOT reset the amount to a default on a unit switch", () => {
    const states: PortionState[] = [];
    const { getByLabelText } = render(<Harness onState={(s) => states.push(s)} />);

    fireEvent.press(getByLabelText("Change unit"));
    fireEvent.press(getByLabelText("Use gram"));

    const last = states.at(-1)!;
    expect(last.unit.kind).toBe("gram");
    // Gram-preserving → 66, NOT the 100 g gram-default and NOT 1.
    expect(last.amount).toBeCloseTo(66, 5);
    expect(last.amount).not.toBe(100);
    expect(last.amount).not.toBe(1);
  });
});

describe("PortionPicker (mobile) — hideQuickChips (ENG-775 parity pin)", () => {
  const baseProps = {
    product: PRODUCT,
    value: { amount: 3, unit: meatballUnit() } as PortionState,
    onChange: () => undefined,
  };

  it("renders the Quick chip row by default", () => {
    const { queryByText } = render(<PortionPicker {...baseProps} />);
    expect(queryByText("Quick")).not.toBeNull();
  });

  it("hides the Quick chip row when hideQuickChips is set", () => {
    const { queryByText } = render(<PortionPicker {...baseProps} hideQuickChips />);
    expect(queryByText("Quick")).toBeNull();
  });
});
