/**
 * TodayBarcodeDialog — "not found" → photo fallback (web mirror).
 *
 * Audit 2026-04-30 (Lose It "Closer" parity, Fix 2). When the OFF
 * lookup returns `not_found`, the dialog flips into a soft empty
 * state and surfaces a primary "Snap the label instead" CTA that
 * hands off to the host's PhotoLog flow. Mirrors mobile's
 * `barcodeNotFoundPhotoFallback.test.tsx`.
 *
 * Tests pin:
 *   - Friendly empty-state copy renders.
 *   - The CTA fires the host callback.
 *   - The CTA is suppressed when `onPhotoFallback` is undefined
 *     (host hasn't migrated yet — legacy form stays).
 *   - "Try another barcode" on the empty state takes the user back
 *     to the input form (clears the not-found state).
 */

import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

void React;

const fetchProductByBarcode = vi.fn();

vi.mock("../../src/lib/openFoodFacts/fetchProductByBarcode", () => ({
  fetchProductByBarcode: (...args: any[]) => fetchProductByBarcode(...args),
}));
vi.mock("../../src/lib/openFoodFacts/scaleFromPer100g", () => ({
  scaleFromPer100gGrams: vi.fn(() => ({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0,
  })),
}));
vi.mock("../../src/lib/barcodePortionMemory", () => ({
  getRememberedPortion: vi.fn(() => null),
  recordPortion: vi.fn(),
  clampRememberedToServingOptions: vi.fn((g: number) => g),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import { TodayBarcodeDialog } from "../../src/app/components/suppr/today-barcode-dialog";

function Harness({ onPhotoFallback }: { onPhotoFallback?: () => void }) {
  const [open, setOpen] = React.useState(true);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);
  return (
    <TodayBarcodeDialog
      open={open}
      onOpenChange={setOpen}
      barcodeValue={value}
      onBarcodeValueChange={setValue}
      barcodeBusy={busy}
      onBarcodeBusyChange={setBusy}
      barcodePreview={preview}
      onBarcodePreviewChange={setPreview}
      barcodeGramsStr="100"
      onBarcodeGramsStrChange={() => {}}
      barcodeGramsParsed={100}
      barcodeTitleOverride=""
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
      onPhotoFallback={onPhotoFallback}
    />
  );
}

describe("TodayBarcodeDialog — not-found photo fallback (web)", () => {
  beforeEach(() => {
    fetchProductByBarcode.mockReset();
  });

  it("renders the friendly 'We don't have this product yet.' empty state when lookup misses", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={vi.fn()} />);

    // Type a barcode + click Look up.
    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() => {
      expect(screen.getByText("We don't have this product yet.")).toBeDefined();
    });
  });

  it("fires onPhotoFallback when the user clicks 'Snap the label instead'", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const onPhotoFallback = vi.fn();
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={onPhotoFallback} />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    const cta = await screen.findByTestId("barcode-not-found-photo-fallback");
    await user.click(cta);
    expect(onPhotoFallback).toHaveBeenCalledTimes(1);
  });

  it("hides the photo-fallback CTA when the host hasn't wired onPhotoFallback", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() => {
      // Friendly copy still shows.
      expect(screen.getByText("We don't have this product yet.")).toBeDefined();
    });
    // ...but the photo CTA does NOT.
    expect(screen.queryByTestId("barcode-not-found-photo-fallback")).toBeNull();
  });

  it("'Try another barcode' from the empty state returns the user to the input form", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await screen.findByText("We don't have this product yet.");

    // Click the "Try another barcode" button on the empty state.
    await user.click(
      screen.getByRole("button", { name: "Try another barcode" }),
    );

    // Input form is back; the not-found copy is gone.
    expect(screen.queryByText("We don't have this product yet.")).toBeNull();
    expect(screen.getByPlaceholderText("8–13 digits")).toBeDefined();
  });
});
