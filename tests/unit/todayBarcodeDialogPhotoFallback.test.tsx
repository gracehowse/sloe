/**
 * TodayBarcodeDialog — "not found" → photo fallback (web mirror).
 *
 * Audit 2026-04-30 (Lose It "Closer" parity, Fix 2). When the OFF
 * lookup returns `not_found`, the dialog flips into a soft empty
 * state and surfaces a primary "Snap the label instead" CTA that
 * hands off to the host's PhotoLog flow. Mirrors mobile's
 * `barcodeNotFoundPhotoFallback.test.tsx`.
 *
 * ENG-1247 §A5 flipped `eng1247_section_a_v1` default-ON (ENG-1264 red
 * main): the not-found empty state now uses the v3 copy
 * (`COMPLETE_DAY_V3_COPY.barcodeNotFoundTitle` "New barcode" +
 * barcodeNotFoundBody) by default, not the legacy "We don't have this
 * product yet." headline. The photo-fallback CTA testid + the
 * "Try another barcode" reset are unchanged across the flag. The first
 * block asserts the now-default v3 copy + the unchanged CTA behaviour;
 * the second block forces the flag OFF to keep guarding the legacy copy
 * (the PostHog kill-switch path).
 *
 * Tests pin:
 *   - Friendly empty-state copy renders (v3 default + legacy off).
 *   - The CTA fires the host callback.
 *   - The CTA is suppressed when `onPhotoFallback` is undefined
 *     (host hasn't migrated yet — legacy form stays).
 *   - "Try another barcode" on the empty state takes the user back
 *     to the input form (clears the not-found state).
 */

import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

function forceSectionA(value: boolean): void {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    eng1247_section_a_v1: value,
  };
}

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

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

// ── v3 default copy (eng1247_section_a_v1 ON — the shipped default) ─────────
describe("TodayBarcodeDialog — not-found photo fallback (web), v3 default copy", () => {
  beforeEach(() => {
    fetchProductByBarcode.mockReset();
  });

  it("renders the v3 'New barcode' empty state when lookup misses", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() => {
      expect(screen.getByText("New barcode")).toBeDefined();
    });
    // The v3 body names the scanned code + the community-save framing.
    expect(
      screen.getByText(/Add it once and it's saved for you/),
    ).toBeDefined();
  });

  it("fires onPhotoFallback when the user clicks the photo-fallback CTA", async () => {
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
      // Friendly empty state still shows.
      expect(screen.getByText("New barcode")).toBeDefined();
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

    await screen.findByText("New barcode");

    // Click the "Try another barcode" button on the empty state.
    await user.click(
      screen.getByRole("button", { name: "Try another barcode" }),
    );

    // Input form is back; the not-found copy is gone.
    expect(screen.queryByText("New barcode")).toBeNull();
    expect(screen.getByPlaceholderText("8–13 digits")).toBeDefined();
  });
});

// ── Legacy copy (eng1247_section_a_v1 forced OFF — PostHog kill-switch path) ─
// Forced OFF deliberately: guards the pre-v3 "We don't have this product yet."
// empty-state copy that stays live behind the kill switch. Do not delete.
describe("TodayBarcodeDialog — not-found photo fallback (web), legacy copy (flag forced OFF)", () => {
  beforeEach(() => {
    fetchProductByBarcode.mockReset();
    forceSectionA(false);
  });

  it("renders the friendly 'We don't have this product yet.' empty state when lookup misses", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() => {
      expect(screen.getByText("We don't have this product yet.")).toBeDefined();
    });
  });

  it("fires onPhotoFallback when the user clicks the photo-fallback CTA", async () => {
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
      expect(screen.getByText("We don't have this product yet.")).toBeDefined();
    });
    expect(screen.queryByTestId("barcode-not-found-photo-fallback")).toBeNull();
  });

  it("'Try another barcode' from the empty state returns the user to the input form", async () => {
    fetchProductByBarcode.mockResolvedValue({ ok: false, error: "not_found" });
    const user = userEvent.setup();
    render(<Harness onPhotoFallback={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("8–13 digits"), "1234567890123");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await screen.findByText("We don't have this product yet.");

    await user.click(
      screen.getByRole("button", { name: "Try another barcode" }),
    );

    expect(screen.queryByText("We don't have this product yet.")).toBeNull();
    expect(screen.getByPlaceholderText("8–13 digits")).toBeDefined();
  });
});
