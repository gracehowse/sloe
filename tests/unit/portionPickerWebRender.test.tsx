/**
 * ENG-775 — PortionPickerWeb render-level gram-invariant tests.
 *
 * The pure state math (`switchUnit`/`stateToGrams`) is unit-tested in
 * `portionPicker.test.ts`. THIS test proves the invariant at the RENDER
 * level: driving a unit switch through the real PortionPickerWeb UI must
 * preserve the entered gram weight and never reset the amount to a default
 * (e.g. 100 g). It guards against a wrapper regression that wires `onChange`
 * to a reset instead of `switchUnit` — exactly the bug ENG-775 fixes on the
 * food-search surfaces, where today switching units resets quantity to 100 g.
 *
 * Mirror of `apps/mobile/tests/unit/portionPickerRender.test.tsx` (parity).
 */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { PortionPickerWeb } from "../../src/app/components/suppr/portion-picker";
import {
  buildPickerOptions,
  stateToGrams,
  type PortionState,
  type ProductInput,
} from "../../src/lib/nutrition/portionPicker";

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
    <PortionPickerWeb
      product={PRODUCT}
      value={value}
      onChange={(next) => {
        setValue(next);
        onState(next);
      }}
    />
  );
}

describe("PortionPickerWeb — render-level gram invariant (ENG-775)", () => {
  it("preserves grams switching count → gram → serving through the UI", () => {
    const states: PortionState[] = [];
    const { getByLabelText, getByText } = render(<Harness onState={(s) => states.push(s)} />);

    // Start: 3 meatballs = 66 g. Switch to gram.
    fireEvent.click(getByLabelText("Change unit"));
    fireEvent.click(getByText("gram"));
    expect(stateToGrams(states.at(-1)!)).toBeCloseTo(66, 5);

    // Switch to serving (88 g/serving) — still 66 g.
    fireEvent.click(getByLabelText("Change unit"));
    fireEvent.click(getByText("serving"));
    expect(stateToGrams(states.at(-1)!)).toBeCloseTo(66, 5);
  });

  it("does NOT reset the amount to a default on a unit switch", () => {
    const states: PortionState[] = [];
    const { getByLabelText, getByText } = render(<Harness onState={(s) => states.push(s)} />);

    fireEvent.click(getByLabelText("Change unit"));
    fireEvent.click(getByText("gram"));

    const last = states.at(-1)!;
    expect(last.unit.kind).toBe("gram");
    // Gram-preserving → 66, NOT the 100 g gram-default and NOT 1.
    expect(last.amount).toBeCloseTo(66, 5);
    expect(last.amount).not.toBe(100);
    expect(last.amount).not.toBe(1);
  });
});

describe("PortionPickerWeb — hideQuickChips parity with mobile (ENG-775)", () => {
  const baseProps = {
    product: PRODUCT,
    value: { amount: 3, unit: meatballUnit() } as PortionState,
    onChange: () => undefined,
  };

  it("renders the Quick chip row by default", () => {
    const { queryByText } = render(<PortionPickerWeb {...baseProps} />);
    expect(queryByText("Quick")).not.toBeNull();
  });

  it("hides the Quick chip row when hideQuickChips is set", () => {
    const { queryByText } = render(<PortionPickerWeb {...baseProps} hideQuickChips />);
    expect(queryByText("Quick")).toBeNull();
  });
});
