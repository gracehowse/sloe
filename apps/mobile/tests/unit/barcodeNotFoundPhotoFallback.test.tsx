/**
 * BarcodeScannerModal — "not found" → photo fallback (Audit 2026-04-30,
 * Lose It "Closer" parity, Fix 2).
 *
 * When `lookupBarcode` resolves to null (= product not found in OFF /
 * Suppr DB), the scanner used to dead-end with "Product not found" +
 * a manual-entry button. We now soft-handoff to the AI photo log
 * (PhotoLogSheet) via a primary `onPhotoFallback` CTA. This pins:
 *   - Friendly empty-state copy renders.
 *   - The CTA fires the host callback and is announced as "Snap the
 *     label instead" for a11y.
 *   - The CTA is suppressed when `onPhotoFallback` is undefined (host
 *     hasn't migrated yet — legacy "Enter manually" path stays primary).
 *   - Manual-entry escape hatch still renders below the fallback CTA.
 */

import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

void React;

const lookupBarcode = vi.fn();

// Capture the latest scan handler so the test can fire it.
let onScannedRef: ((e: { data: string }) => void) | undefined;

vi.mock("expo-camera", () => ({
  useCameraPermissions: () => [
    { granted: true, status: "granted" },
    vi.fn(),
  ],
}));

vi.mock("@/components/BarcodeCameraView", () => ({
  BarcodeCameraView: ({
    onBarcodeScanned,
  }: {
    onBarcodeScanned?: (e: { data: string }) => void;
  }) => {
    onScannedRef = onBarcodeScanned;
    return (
      <Pressable
        testID="barcode-trigger"
        onPress={() => onScannedRef?.({ data: "0000000000000" })}
      >
        <Text>scan</Text>
      </Pressable>
    );
  },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
    inputBg: "#f4f4f4",
  }),
}));

vi.mock("@/lib/verifyRecipe", () => ({
  lookupBarcode: (...args: any[]) => lookupBarcode(...args),
  scaleMacros: vi.fn(() => ({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0,
  })),
  submitFoodCorrection: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/barcodePortionMemory", () => ({
  getRememberedPortion: vi.fn(async () => null),
  recordPortion: vi.fn(async () => undefined),
  clampRememberedToServingOptions: vi.fn((g: number) => g),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

vi.mock("@/lib/barcodeCorrection", () => ({
  scaleCorrectionToPer100g: () => null,
}));

/* eslint-disable import/first -- vi.mock is hoisted; the scanner
   module must load AFTER the mocks so its imports pick up the stubbed
   lookupBarcode / camera view. Standard vitest pattern, see
   foodSearchModalFitThisIn.test.tsx. */
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
/* eslint-enable import/first */

describe("BarcodeScannerModal — not-found photo fallback", () => {
  beforeEach(() => {
    lookupBarcode.mockReset();
    onScannedRef = undefined;
  });

  it("renders the friendly 'We don't have this product yet.' copy when lookup misses", async () => {
    lookupBarcode.mockResolvedValue(null);
    const { getByText, getByTestId } = render(
      <BarcodeScannerModal
        visible
        onScan={() => {}}
        onClose={() => {}}
        onPhotoFallback={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.press(getByTestId("barcode-trigger"));
    });
    await waitFor(() => {
      expect(getByText("We don't have this product yet.")).toBeTruthy();
    });
  });

  it("fires onPhotoFallback when the user taps 'Snap the label instead'", async () => {
    lookupBarcode.mockResolvedValue(null);
    const onPhotoFallback = vi.fn();
    const { getByTestId } = render(
      <BarcodeScannerModal
        visible
        onScan={() => {}}
        onClose={() => {}}
        onPhotoFallback={onPhotoFallback}
      />,
    );
    await act(async () => {
      fireEvent.press(getByTestId("barcode-trigger"));
    });
    await waitFor(() => {
      expect(getByTestId("barcode-not-found-photo-fallback")).toBeTruthy();
    });
    fireEvent.press(getByTestId("barcode-not-found-photo-fallback"));
    expect(onPhotoFallback).toHaveBeenCalledTimes(1);
  });

  it("hides the photo-fallback CTA when the host hasn't wired onPhotoFallback (legacy path)", async () => {
    lookupBarcode.mockResolvedValue(null);
    const { getByTestId, queryByTestId } = render(
      <BarcodeScannerModal
        visible
        onScan={() => {}}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      fireEvent.press(getByTestId("barcode-trigger"));
    });
    await waitFor(() => {
      expect(queryByTestId("barcode-not-found-photo-fallback")).toBeNull();
    });
  });

  it("keeps the manual-entry escape hatch alongside the photo CTA", async () => {
    lookupBarcode.mockResolvedValue(null);
    const { getByTestId, getByText } = render(
      <BarcodeScannerModal
        visible
        onScan={() => {}}
        onClose={() => {}}
        onPhotoFallback={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.press(getByTestId("barcode-trigger"));
    });
    await waitFor(() => {
      expect(getByText("Enter manually instead")).toBeTruthy();
      expect(getByText("Scan again")).toBeTruthy();
    });
  });
});
