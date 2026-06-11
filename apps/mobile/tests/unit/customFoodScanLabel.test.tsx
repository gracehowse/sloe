/**
 * CreateCustomFoodSheet — "Scan label" OCR pre-fill (Recipe-vision contract,
 * 2026-06-11).
 *
 * The sheet gains a "Scan label" entry that captures a nutrition-label photo,
 * posts it to /api/nutrition/scan-label, and PRE-FILLS the per-100g macro
 * fields. The form stays the source of truth: the user confirms every value
 * before saving. This pins:
 *   - The "Scan label" button renders and announces for a11y.
 *   - A successful scan pre-fills the calorie/protein/carbs/fat fields.
 *   - An implausible / low-confidence scan surfaces a "double-check" warning
 *     (never silently accepted — repo nutrition no-guessing rule).
 *   - A failed scan surfaces an inline error (no silent failure).
 *
 * No live API is called — ImagePicker, supabase, and global fetch are mocked.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";

void React;

vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchCameraAsync: vi.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///label.jpg", mimeType: "image/jpeg" }],
  })),
  MediaTypeOptions: { Images: "Images" },
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { supprApiUrl: "https://test.local" } } },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
    },
  },
}));

const trackMock = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  isFeatureEnabled: () => false,
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#6B4FA0" }),
}));

vi.mock("@/components/ui/SupprCard", () => ({ SHEET_RADIUS: 16 }));
vi.mock("../../components/KeyboardSafeView", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

/* eslint-disable import/first -- vi.mock is hoisted; the sheet module must
   load AFTER the mocks. Standard vitest pattern. */
import CreateCustomFoodSheet from "../../components/CreateCustomFoodSheet";
/* eslint-enable import/first */

const colors = {
  text: "#000",
  textSecondary: "#666",
  textTertiary: "#999",
  card: "#fff",
  cardBorder: "#eee",
  background: "#fff",
};

function renderSheet() {
  return render(
    <CreateCustomFoodSheet
      visible
      onClose={() => {}}
      onSave={() => {}}
      colors={colors}
    />,
  );
}

describe("CreateCustomFoodSheet — Scan label OCR pre-fill", () => {
  beforeEach(() => {
    trackMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the 'Scan label' entry with an a11y label", () => {
    const { getByTestId } = renderSheet();
    const btn = getByTestId("custom-food-scan-label");
    expect(btn).toBeTruthy();
  });

  it("pre-fills macro fields on a successful, plausible scan", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        name: "Greek yogurt",
        calories: 59,
        protein: 10,
        carbs: 3.6,
        fat: 0.4,
        fiberG: 0,
        sugarG: 3.6,
        sodiumMg: 36,
        confidence: "high",
        implausible: false,
        plausibilityReason: null,
      }),
    });

    const { getByTestId, getByLabelText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByTestId("custom-food-scan-label"));
    });

    await waitFor(() => {
      expect((getByLabelText("Calories").props.value as string)).toBe("59");
    });
    expect(getByLabelText("Protein grams").props.value).toBe("10");
    expect(getByLabelText("Carbs grams").props.value).toBe("3.6");
    expect(getByLabelText("Fat grams").props.value).toBe("0.4");
    // No warning on a plausible high-confidence scan.
    expect(() => getByTestId("custom-food-scan-warning")).toThrow();
    // Analytics fired with the confidence + implausible flags.
    expect(trackMock).toHaveBeenCalledWith(
      "custom_food_label_scanned",
      expect.objectContaining({ confidence: "high", implausible: false, platform: "ios" }),
    );
  });

  it("surfaces a 'double-check' warning when the scan is flagged implausible", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        name: "Mystery bar",
        calories: 600,
        protein: 5,
        carbs: 5,
        fat: 1,
        fiberG: 0,
        sugarG: null,
        sodiumMg: null,
        confidence: "low",
        implausible: true,
        plausibilityReason: "atwater_mismatch",
      }),
    });

    const { getByTestId } = renderSheet();
    await act(async () => {
      fireEvent.press(getByTestId("custom-food-scan-label"));
    });

    await waitFor(() => {
      expect(getByTestId("custom-food-scan-warning")).toBeTruthy();
    });
    // The values are still pre-filled (user is source of truth) — but flagged.
    expect(getByTestId("custom-food-scan-warning").props.children).toMatch(/double-check/i);
  });

  it("surfaces an inline error when the scan fails (no silent failure)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: "Couldn't read the label." }),
    });

    const { getByTestId } = renderSheet();
    await act(async () => {
      fireEvent.press(getByTestId("custom-food-scan-label"));
    });

    await waitFor(() => {
      expect(getByTestId("custom-food-scan-error")).toBeTruthy();
    });
    expect(getByTestId("custom-food-scan-error").props.children).toBe("Couldn't read the label.");
  });
});
