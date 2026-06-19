/**
 * ENG-824 (Redesign — Design Direction 2026, 2026-05-31 design-director
 * review) — the reserved weight win-moment on the LogWeightSheet.
 *
 * A new all-time low is the single weight landmark worth a loud celebration:
 *   - flag ON  + new low      → loud SUCCESS notification haptic, `isNewLow: true`
 *   - flag ON  + not a low    → quiet LIGHT impact haptic,         `isNewLow: false`
 *   - flag OFF (any save)     → NO haptic,                         `isNewLow: false`
 *
 * These drive the sheet through render + a save tap and assert on the haptic
 * call + the `onSaved` payload. The pure new-low math is unit-tested in
 * `tests/unit/weightWinMoment.test.ts`; this pins the WIRING (flag gate +
 * haptic split) so a refactor can't silently drop the celebration or fire a
 * loud haptic on every save.
 */
import React from "react";
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

const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({ update: () => ({ eq: eqSpy }) })),
  },
}));

vi.mock("@/lib/refreshAdaptiveTdee", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(() => Promise.resolve()),
}));

// Flag gate — flipped per-test via `isFeatureEnabled.mockReturnValue`.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
  track: vi.fn(),
}));

// Haptics — assert the kind of feedback that fired.
const notificationAsync = vi.fn((..._a: unknown[]) => Promise.resolve());
const impactAsync = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("expo-haptics", () => ({
  notificationAsync: (...a: unknown[]) => notificationAsync(...a),
  impactAsync: (...a: unknown[]) => impactAsync(...a),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

import { LogWeightSheet } from "../../components/progress/LogWeightSheet";

// Prior history whose minimum is 78.5kg — a save below that is a new low.
const HISTORY: Record<string, number> = {
  "2026-05-29": 80,
  "2026-05-30": 78.5,
};

beforeEach(() => {
  vi.setSystemTime(new Date("2026-05-31T10:00:00Z"));
  isFeatureEnabled.mockReturnValue(false);
  notificationAsync.mockClear();
  impactAsync.mockClear();
  eqSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderSheet(onSaved: ReturnType<typeof vi.fn>) {
  return render(
    <LogWeightSheet
      onSaveWeight={async (kg, dateKey) => ({
        weightKgByDay: { ...HISTORY, [dateKey]: kg },
        weightKg: kg,
      })}
      visible
      onClose={() => {}}
      userId="u-1"
      isImperial={false}
      weightKgByDay={HISTORY}
      weightKg={78.5}
      onSaved={onSaved}
    />,
  );
}

describe("<LogWeightSheet> weight win-moment (ENG-824)", () => {
  it("flag ON + new low: fires the loud success haptic and reports isNewLow", async () => {
    isFeatureEnabled.mockReturnValue(true);
    const onSaved = vi.fn();
    const { getByTestId } = renderSheet(onSaved);
    fireEvent.changeText(getByTestId("log-weight-input"), "77.0");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(notificationAsync).toHaveBeenCalledWith("success");
    expect(impactAsync).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ isNewLow: true }),
    );
  });

  it("flag ON + NOT a new low: fires only the quiet confirm haptic, isNewLow false", async () => {
    isFeatureEnabled.mockReturnValue(true);
    const onSaved = vi.fn();
    const { getByTestId } = renderSheet(onSaved);
    fireEvent.changeText(getByTestId("log-weight-input"), "79.0");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(impactAsync).toHaveBeenCalledWith("medium");
    expect(notificationAsync).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ isNewLow: false }),
    );
  });

  it("flag OFF: no haptic of any kind, isNewLow false (silent save preserved)", async () => {
    isFeatureEnabled.mockReturnValue(false);
    const onSaved = vi.fn();
    const { getByTestId } = renderSheet(onSaved);
    fireEvent.changeText(getByTestId("log-weight-input"), "77.0");
    fireEvent.press(getByTestId("log-weight-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(notificationAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ isNewLow: false }),
    );
  });
});
