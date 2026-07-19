/**
 * TodayBarcodeDialog — redesigned result card (ENG-737, 2026-06-17).
 *
 * The web barcode "Review & log" preview was a flat muted-text paragraph
 * ("{kcal} kcal · P … · C … · F …") that lagged both the food-search result
 * row and the mobile barcode redesign — Grace's "looks awful" report. This
 * brings it to parity: a result card with
 *   - a Verified/Estimated confidence chip (shared `barcodeConfidenceTier`),
 *   - a prominent kcal headline (18px extrabold, tabular-nums),
 *   - the same coloured P/C/F macro treatment as the food-search row.
 *
 * Trust posture (CLAUDE.md): a raw Open Food Facts lookup carries no
 * `verified` flag, so the chip must read "Estimated" — never a UI default of
 * "Structured". A row whose per-100g basis we reconstructed (`basisCorrected`)
 * also reads "Estimated". These tests pin exactly that, and will fail if the
 * flat-paragraph layout is reinstated.
 */

import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

vi.mock("../../src/lib/openFoodFacts/fetchProductByBarcode", () => ({
  fetchProductByBarcode: vi.fn(),
}));
// Real scaler so the kcal/macro numbers in the card are the genuine
// per-100g × grams math, not a stub — the card must show real values.
vi.mock("../../src/lib/barcodePortionMemory", () => ({
  getRememberedPortion: vi.fn(() => null),
  recordPortion: vi.fn(),
  clampRememberedToServingOptions: vi.fn((g: number) => g),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

import { TodayBarcodeDialog } from "../../src/app/components/suppr/today-barcode-dialog";
import type { OffProductMacros } from "../../src/lib/openFoodFacts/fetchProductByBarcode";

function makeProduct(overrides: Partial<OffProductMacros> = {}): OffProductMacros {
  return {
    name: "Test Granola",
    calories: 400,
    protein: 10,
    carbs: 60,
    fat: 12,
    fiberG: 8,
    sugarG: 20,
    sodiumMg: 100,
    servingLabel: "100 g",
    servingSizeG: 100,
    servingOptions: [{ label: "100 g", grams: 100 }],
    ...overrides,
  } as OffProductMacros;
}

function Harness({ preview }: { preview: OffProductMacros }) {
  const [open, setOpen] = React.useState(true);
  return (
    <TodayBarcodeDialog
      open={open}
      onOpenChange={setOpen}
      barcodeValue="1234567890123"
      onBarcodeValueChange={() => {}}
      barcodeBusy={false}
      onBarcodeBusyChange={() => {}}
      barcodePreview={preview}
      onBarcodePreviewChange={() => {}}
      barcodeGramsStr="100"
      onBarcodeGramsStrChange={() => {}}
      barcodeGramsParsed={100}
      barcodeTitleOverride={preview.name}
      onBarcodeTitleOverrideChange={() => {}}
      barcodeMacrosManual={false}
      onBarcodeMacrosManualChange={() => {}}
      barcodeEditCal=""
      onBarcodeEditCalChange={() => {}}
      barcodeEditPro=""
      onBarcodeEditProChange={() => {}}
      barcodeEditCarb=""
      onBarcodeEditCarbChange={() => {}}
      barcodeEditFat=""
      onBarcodeEditFatChange={() => {}}
      mealSlot="Snacks"
      onMealSlotChange={() => {}}
      recentFoods={[]}
      onPickRecentFood={() => {}}
      onConfirm={() => {}}
    />
  );
}

describe("TodayBarcodeDialog — redesigned result card (web)", () => {
  it("renders the result card shell instead of a flat paragraph", () => {
    render(<Harness preview={makeProduct()} />);
    expect(screen.getByTestId("barcode-result-card")).toBeDefined();
  });

  it("shows the Estimated confidence chip for a raw OFF lookup (never defaults to Structured)", () => {
    render(<Harness preview={makeProduct()} />);
    expect(screen.getByTestId("barcode-confidence-estimated")).toBeDefined();
    expect(screen.getByText("Estimated")).toBeDefined();
    expect(screen.queryByTestId("barcode-confidence-verified")).toBeNull();
  });

  it("drops to Estimated when the per-100g basis was reconstructed", () => {
    render(<Harness preview={makeProduct({ basisCorrected: true })} />);
    expect(screen.getByTestId("barcode-confidence-estimated")).toBeDefined();
    expect(screen.queryByTestId("barcode-confidence-verified")).toBeNull();
  });

  it("names Open Food Facts instead of claiming Structured for a source-backed row", () => {
    render(<Harness preview={makeProduct({ verified: true })} />);
    expect(screen.getByTestId("barcode-confidence-verified")).toBeDefined();
    expect(screen.getByText("Open Food Facts")).toBeDefined();
    expect(screen.queryByText("Structured")).toBeNull();
  });

  it("surfaces a prominent kcal headline with the real per-100g number", () => {
    render(<Harness preview={makeProduct({ calories: 400 })} />);
    const card = screen.getByTestId("barcode-result-card");
    // 400 kcal at 100 g → headline reads 400.
    expect(card.textContent).toContain("400");
    expect(card.textContent).toContain("kcal");
  });

  it("renders the P/C/F macros (and fiber when present) inside the card", () => {
    render(<Harness preview={makeProduct({ protein: 10, carbs: 60, fat: 12, fiberG: 8 })} />);
    const card = screen.getByTestId("barcode-result-card");
    expect(card.textContent).toContain("P 10g");
    expect(card.textContent).toContain("C 60g");
    expect(card.textContent).toContain("F 12g");
    expect(card.textContent).toContain("Fiber 8g");
  });

  it("omits the fiber chip when the product has no fiber", () => {
    render(<Harness preview={makeProduct({ fiberG: 0 })} />);
    const card = screen.getByTestId("barcode-result-card");
    expect(card.textContent).not.toContain("Fiber");
  });
});
