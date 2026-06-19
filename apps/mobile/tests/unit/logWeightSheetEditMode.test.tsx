/**
 * ENG-748 #9 (2026-05-27) — edit a mistyped past weigh-in.
 *
 * Before: `LogWeightSheet` always wrote to today's date key and always
 * set the scalar `weight_kg`. A user who mistyped a past weigh-in (e.g.
 * 87 → 187 kg) could only delete + re-add, and the re-add landed on
 * today — the original date was lost.
 *
 * After: an optional `editDate` targets an existing weigh-in. The value
 * changes, the date is preserved, and the scalar `weight_kg` is only
 * touched when the edited entry is the newest one (editing an old entry
 * must not clobber the current weight).
 *
 * These tests drive the sheet through render + a button tap and assert on
 * the exact Supabase update payload.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({ X: () => null }));

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

import { LogWeightSheet } from "../../components/progress/LogWeightSheet";

const SAMPLE: Record<string, number> = {
  "2026-05-11": 54.9, // newest
  "2026-05-10": 54.8,
  "2026-05-06": 187.0, // the mistyped past entry (should have been 87 / 54.x)
};

beforeEach(() => {
  vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
  updateSpy.mockClear();
  eqSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

type UpdatePayload = {
  weight_kg_by_day: Record<string, number>;
  weight_kg?: number;
};

function newestDateKey(map: Record<string, number>): string | null {
  return Object.keys(map).sort().reverse()[0] ?? null;
}

function makeSaveWeight(map: Record<string, number>) {
  return vi.fn(async (kg: number, dateKey: string) => {
    const next = { ...map, [dateKey]: kg };
    const newest = newestDateKey(next);
    const payload: UpdatePayload = { weight_kg_by_day: next };
    if (newest === dateKey) payload.weight_kg = kg;
    updateSpy(payload);
    return { weightKgByDay: next, weightKg: newest ? next[newest] : null };
  });
}

describe("<LogWeightSheet> edit mode (ENG-748 #9)", () => {
  it("shows edit copy and pre-fills with the stored value for the target date", () => {
    const { getByText, getByTestId } = render(
      <LogWeightSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        weightKg={54.9}
        editDate="2026-05-06"
        onSaveWeight={makeSaveWeight(SAMPLE)}
        onSaved={() => {}}
      />,
    );
    expect(getByText("Edit weigh-in")).toBeTruthy();
    // Pre-filled with the mistyped value so the user corrects it in place.
    expect(getByTestId("log-weight-input").props.value).toBe("187");
  });

  it("editing a PAST entry writes to its date and does NOT clobber weight_kg", async () => {
    const onSaved = vi.fn();
    const { getByTestId } = render(
      <LogWeightSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        weightKg={54.9}
        editDate="2026-05-06"
        onSaveWeight={makeSaveWeight(SAMPLE)}
        onSaved={onSaved}
      />,
    );
    fireEvent.changeText(getByTestId("log-weight-input"), "54.3");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [payload] = updateSpy.mock.calls[0] as [UpdatePayload];
    // The corrected value lands on the ORIGINAL date.
    expect(payload.weight_kg_by_day["2026-05-06"]).toBe(54.3);
    // Other entries untouched.
    expect(payload.weight_kg_by_day["2026-05-11"]).toBe(54.9);
    // Editing an OLD entry must not overwrite the current weight.
    expect(payload.weight_kg).toBeUndefined();
    // Parent is told the latest weight is still the newest entry.
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ weightKg: 54.9 }),
    );
  });

  it("editing the NEWEST entry updates weight_kg too", async () => {
    const onSaved = vi.fn();
    const { getByTestId } = render(
      <LogWeightSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        weightKg={54.9}
        editDate="2026-05-11"
        onSaveWeight={makeSaveWeight(SAMPLE)}
        onSaved={onSaved}
      />,
    );
    fireEvent.changeText(getByTestId("log-weight-input"), "55.2");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [payload] = updateSpy.mock.calls[0] as [UpdatePayload];
    expect(payload.weight_kg_by_day["2026-05-11"]).toBe(55.2);
    expect(payload.weight_kg).toBe(55.2);
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ weightKg: 55.2 }),
    );
  });

  it("normal (non-edit) mode still logs to today and sets weight_kg", async () => {
    const onSaved = vi.fn();
    const { getByTestId, getByText } = render(
      <LogWeightSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        weightKg={54.9}
        onSaveWeight={makeSaveWeight(SAMPLE)}
        onSaved={onSaved}
      />,
    );
    expect(getByText("Log your weight")).toBeTruthy();
    fireEvent.changeText(getByTestId("log-weight-input"), "54.5");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [payload] = updateSpy.mock.calls[0] as [UpdatePayload];
    expect(payload.weight_kg_by_day["2026-05-11"]).toBe(54.5);
    expect(payload.weight_kg).toBe(54.5);
  });

  it("rejects a non-positive value without writing (failed-write guard)", () => {
    const alertSpy = vi
      .spyOn(Alert, "alert")
      .mockImplementation((() => {}) as typeof Alert.alert);
    const { getByTestId } = render(
      <LogWeightSheet
        visible
        onClose={() => {}}
        userId="u-1"
        isImperial={false}
        weightKgByDay={SAMPLE}
        weightKg={54.9}
        editDate="2026-05-06"
        onSaveWeight={makeSaveWeight(SAMPLE)}
        onSaved={() => {}}
      />,
    );
    fireEvent.changeText(getByTestId("log-weight-input"), "0");
    fireEvent.press(getByTestId("log-weight-save"));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
