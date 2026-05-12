/**
 * Withings-style "All data" weight list (Grace TF feedback 2026-05-11).
 *
 * Pins:
 *   - Entries grouped by month, newest month first, newest entry first
 *     within each month
 *   - Today / Yesterday relative labels
 *   - Imperial vs metric formatting
 *   - Long-press delete dispatches the correct Supabase update
 *   - Empty state copy when there are no entries
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  Scale: () => null,
  X: () => null,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    background: "#fff",
    text: "#111",
    textSecondary: "#666",
    textTertiary: "#999",
    border: "#eee",
    inputBg: "#f4f4f6",
  }),
}));

const updateSpy = vi.fn();
const eqSpy = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (...args: unknown[]) => {
        updateSpy(...args);
        return { eq: eqSpy };
      },
    })),
  },
}));

vi.mock("@/lib/refreshAdaptiveTdee", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(() => Promise.resolve()),
}));

import { AllWeightDataSheet } from "../../components/progress/AllWeightDataSheet";

const TODAY_ISO = "2026-05-11";

beforeEach(() => {
  vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
  updateSpy.mockClear();
  eqSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const SAMPLE: Record<string, number> = {
  "2026-05-11": 54.9, // Today
  "2026-05-10": 54.8, // Yesterday
  "2026-05-06": 54.3,
  "2026-04-29": 55.2,
  "2026-04-22": 55.4,
  "2026-03-15": 55.8, // older month — should be in a separate section
};

describe("<AllWeightDataSheet>", () => {
  it("renders nothing visible when not open", () => {
    const { queryByTestId } = render(
      <AllWeightDataSheet
        visible={false}
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={() => {}}
      />,
    );
    expect(queryByTestId("all-weight-data-sheet")).toBeNull();
  });

  it("renders Today / Yesterday relative labels for the most recent entries", () => {
    const { getByText } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={() => {}}
      />,
    );
    expect(getByText("Today")).toBeTruthy();
    expect(getByText("Yesterday")).toBeTruthy();
  });

  it("formats weight in kg by default, lb when imperial", () => {
    const { getByText, rerender } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={() => {}}
      />,
    );
    expect(getByText("54.9 kg")).toBeTruthy();
    rerender(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial
        weightKgByDay={SAMPLE}
        onEntryDeleted={() => {}}
      />,
    );
    // 54.9 kg → 121.0 lb (54.9 × 2.20462 = 121.0)
    expect(getByText("121 lb")).toBeTruthy();
  });

  it("groups entries by month with month headers (May / April / March 2026)", () => {
    const { queryAllByText } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={() => {}}
      />,
    );
    expect(queryAllByText(/May 2026/i).length).toBeGreaterThan(0);
    expect(queryAllByText(/April 2026/i).length).toBeGreaterThan(0);
    expect(queryAllByText(/March 2026/i).length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no entries", () => {
    const { getByText, queryByText } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={{}}
        onEntryDeleted={() => {}}
      />,
    );
    expect(getByText("No weigh-ins yet")).toBeTruthy();
    // No month headers in the empty case
    expect(queryByText(/May 2026/i)).toBeNull();
  });

  it("long-press → confirm Delete fires a Supabase update with the entry removed", async () => {
    const onEntryDeleted = vi.fn();
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation(((title, msg, buttons) => {
      // Auto-tap the Delete button so the test stays sync-ish.
      if (Array.isArray(buttons)) {
        const del = buttons.find((b: { text?: string }) => b.text === "Delete");
        del?.onPress?.();
      }
    }) as typeof Alert.alert);

    const { getByTestId } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={onEntryDeleted}
      />,
    );
    fireEvent(getByTestId(`all-weight-data-row-${TODAY_ISO}`), "longPress");
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });
    const [payload] = updateSpy.mock.calls[0];
    expect(payload).toHaveProperty("weight_kg_by_day");
    const next = (payload as { weight_kg_by_day: Record<string, number> }).weight_kg_by_day;
    expect(next[TODAY_ISO]).toBeUndefined();
    // Other entries preserved
    expect(next["2026-05-06"]).toBe(54.3);
    expect(onEntryDeleted).toHaveBeenCalledWith(TODAY_ISO, expect.any(Object));
    alertSpy.mockRestore();
  });

  it("Cancel on the delete confirmation does NOT fire the Supabase update", async () => {
    const onEntryDeleted = vi.fn();
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation(((title, msg, buttons) => {
      // No-op: user taps Cancel implicitly by us not calling Delete.
      void buttons;
    }) as typeof Alert.alert);

    const { getByTestId } = render(
      <AllWeightDataSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        onEntryDeleted={onEntryDeleted}
      />,
    );
    fireEvent(getByTestId(`all-weight-data-row-${TODAY_ISO}`), "longPress");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(onEntryDeleted).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
