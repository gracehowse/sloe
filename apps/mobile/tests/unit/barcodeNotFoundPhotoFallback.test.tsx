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

// 2026-05-08 build-45 follow-up: BarcodeScannerModal now imports
// expo-image-picker (for handleSnapLabel) and expo-constants (for
// API base URL). Stub both so the JSDOM test environment doesn't
// error on `__DEV__` from expo-modules-core.
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchCameraAsync: vi.fn(async () => ({ canceled: true, assets: null })),
  MediaTypeOptions: { Images: "Images" },
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { supprApiUrl: "https://test.local" } } },
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
  // ENG-839: verifyRecipe now exports splitFoodSearchResults; passthrough mock.
  splitFoodSearchResults: (_q: string, rows: any[]) => ({ best: rows ?? [], more: [] }),
  lookupBarcode: (...args: any[]) => lookupBarcode(...args),
  scaleMacrosByGrams: vi.fn(() => ({
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

  it("opens the camera (not the legacy onPhotoFallback) when 'Snap the label instead' is tapped", async () => {
    // 2026-05-08 build-45 follow-up: the CTA used to fire onPhotoFallback
    // (PhotoLogSheet → meal-log estimator → never wrote to user_foods).
    // It now invokes handleSnapLabel which captures via ImagePicker and
    // posts to /api/nutrition/scan-label so the contribution actually
    // persists. This test asserts launchCameraAsync gets called and the
    // legacy onPhotoFallback is NOT (would route through the dead path).
    const ImagePicker = await import("expo-image-picker");
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
    await act(async () => {
      fireEvent.press(getByTestId("barcode-not-found-photo-fallback"));
    });
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    expect(onPhotoFallback).not.toHaveBeenCalled();
  });

  it("CTA always renders (post-build-45 the host doesn't need to opt in via onPhotoFallback)", async () => {
    // Pre-build-45: button gated on `onPhotoFallback ? <btn> : null`.
    // Post-build-45: CTA is unconditional because the new handler is
    // self-contained inside the modal (no host callback required).
    lookupBarcode.mockResolvedValue(null);
    const { getByTestId } = render(
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
      expect(getByTestId("barcode-not-found-photo-fallback")).toBeTruthy();
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
      // P1 (customer-lens 2026-05-11): hierarchy reshuffle. The 3-CTA
      // stack of near-synonyms ("Snap the label" / "Add as custom
      // food" / "Enter manually") was confusing — primary CTA is now
      // "Add this product" (saves to library), secondary is "Scan the
      // label" (AI helper), tertiary is "Just log it once" (one-off
      // log, doesn't save).
      expect(getByText("Just log it once")).toBeTruthy();
      expect(getByText("Scan a different barcode")).toBeTruthy();
    });
  });

  it("P1 (2026-05-11) — primary CTA is 'Add this product' when onAddAsCustomFood is wired", async () => {
    lookupBarcode.mockResolvedValue(null);
    const onAddAsCustomFood = vi.fn();
    const { getByTestId, getByText } = render(
      <BarcodeScannerModal
        visible
        onScan={() => {}}
        onClose={() => {}}
        onAddAsCustomFood={onAddAsCustomFood}
      />,
    );
    await act(async () => {
      fireEvent.press(getByTestId("barcode-trigger"));
    });
    await waitFor(() => {
      // Primary CTA copy reflects the user's actual intent at this
      // moment: save the product to library so future scans work.
      expect(getByText("Add this product")).toBeTruthy();
      // Helper subtitle explains the 'save' benefit so the hierarchy
      // reads sensibly (primary > secondary > tertiary).
      expect(
        getByText("Add it to your library so the next scan recognises it."),
      ).toBeTruthy();
      // Secondary CTA copy was tightened from "Snap the label instead"
      // (which read as primary) to "Scan the label" (which reads as
      // an alternative).
      expect(getByText("Scan the label")).toBeTruthy();
    });
  });
});
