/**
 * ENG-728 — `<ImportSuccessCelebration>` gate behaviour (mobile).
 *
 * The render-level companion to `importMagicMomentParity.test.ts` (which pins
 * the source wiring on both platforms). These mount the wrapper and assert the
 * OBSERVABLE outcome of the gate matrix:
 *
 *   - flag ON  + motion allowed → children render AND the one-shot overlay mounts
 *   - flag ON  + reduce-motion  → children render, NO overlay (instant)
 *   - flag OFF (the default)    → children render, NO overlay (zero change)
 *   - overlay plays ONCE        → onComplete unmounts it (no replay)
 *
 * `WinMomentPlayer` is mocked to a marker so the test asserts the MOUNT
 * decision (the gate), not the celebration's internal SVG/Reanimated work —
 * that primitive is covered by its own tests. The flag + reduce-motion are
 * flipped per-test.
 */
import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
  track: vi.fn(),
}));

// Reduce-motion — flipped per-test.
const reduceMotion = vi.fn(() => false);
vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => reduceMotion(),
}));

// Mock the leaf so we assert the MOUNT decision, not the SVG/Reanimated guts.
// It exposes an onComplete trigger so we can verify the one-shot unmount.
let lastOnComplete: (() => void) | undefined;
vi.mock("@/components/ui/WinMomentPlayer", () => ({
  WinMomentPlayer: (props: { onComplete?: () => void; testID?: string }) => {
    lastOnComplete = props.onComplete;
    return React.createElement(Text, { testID: props.testID }, "win");
  },
}));

import { ImportSuccessCelebration } from "../../components/import/ImportSuccessCelebration";

function renderCelebration() {
  return render(
    <ImportSuccessCelebration sheetStyle={{}} testID="success-sheet">
      <Text testID="sheet-body">Saved</Text>
    </ImportSuccessCelebration>,
  );
}

beforeEach(() => {
  isFeatureEnabled.mockReturnValue(false);
  reduceMotion.mockReturnValue(false);
  lastOnComplete = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("<ImportSuccessCelebration> (ENG-728)", () => {
  it("flag ON + motion allowed: renders children AND mounts the one-shot overlay", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { getByTestId, queryByTestId } = renderCelebration();
    expect(getByTestId("sheet-body")).toBeTruthy();
    expect(queryByTestId("import-magic-moment")).toBeTruthy();
    // Gate read the right flag.
    expect(isFeatureEnabled).toHaveBeenCalledWith("import_magic_moment");
  });

  it("flag ON + reduce-motion: renders children, NO overlay (instant)", () => {
    isFeatureEnabled.mockReturnValue(true);
    reduceMotion.mockReturnValue(true);
    const { getByTestId, queryByTestId } = renderCelebration();
    expect(getByTestId("sheet-body")).toBeTruthy();
    expect(queryByTestId("import-magic-moment")).toBeNull();
  });

  it("flag OFF (default): renders children, NO overlay (zero visual change)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { getByTestId, queryByTestId } = renderCelebration();
    expect(getByTestId("sheet-body")).toBeTruthy();
    expect(queryByTestId("import-magic-moment")).toBeNull();
  });

  it("plays once: onComplete unmounts the overlay (no replay)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { queryByTestId } = renderCelebration();
    expect(queryByTestId("import-magic-moment")).toBeTruthy();
    // Simulate the celebration finishing.
    expect(typeof lastOnComplete).toBe("function");
    act(() => {
      lastOnComplete?.();
    });
    expect(queryByTestId("import-magic-moment")).toBeNull();
  });
});
