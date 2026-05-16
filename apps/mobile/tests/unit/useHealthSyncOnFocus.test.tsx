/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react-native";

const syncHealthDataThrottledMock = vi.fn();
const syncNutritionFromHealthThrottledMock = vi.fn();
const isHealthSyncAvailableMock = vi.fn();

vi.mock("@/lib/healthSync", () => ({
  syncHealthDataThrottled: (...args: unknown[]) => syncHealthDataThrottledMock(...args),
  syncNutritionFromHealthThrottled: (...args: unknown[]) => syncNutritionFromHealthThrottledMock(...args),
  isHealthSyncAvailable: () => isHealthSyncAvailableMock(),
}));

// `useFocusEffect` from expo-router fires its callback once on mount in
// a test environment that doesn't have a navigation container — the
// effect IS the value we want to assert.
vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => {
    React.useEffect(() => cb(), [cb]);
  },
}));

import { useHealthSyncOnFocus } from "../../hooks/useHealthSyncOnFocus";

function Harness(props: {
  userId: string | null | undefined;
  loadProfileTargets: () => Promise<void>;
  loadJournal: () => Promise<void>;
}) {
  useHealthSyncOnFocus(props.userId, props.loadProfileTargets, props.loadJournal);
  return null;
}

describe("useHealthSyncOnFocus (Today extract #1)", () => {
  beforeEach(() => {
    syncHealthDataThrottledMock.mockReset();
    syncNutritionFromHealthThrottledMock.mockReset();
    isHealthSyncAvailableMock.mockReset();
    syncHealthDataThrottledMock.mockResolvedValue(undefined);
    syncNutritionFromHealthThrottledMock.mockResolvedValue(undefined);
    isHealthSyncAvailableMock.mockReturnValue(true);
  });

  it("no-ops when userId is null", () => {
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    const loadJournal = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness userId={null} loadProfileTargets={loadProfileTargets} loadJournal={loadJournal} />,
    );
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
    expect(loadProfileTargets).not.toHaveBeenCalled();
    expect(loadJournal).not.toHaveBeenCalled();
  });

  it("no-ops when userId is undefined", () => {
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    const loadJournal = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness userId={undefined} loadProfileTargets={loadProfileTargets} loadJournal={loadJournal} />,
    );
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
  });

  it("no-ops when HealthKit is unavailable (Android / no permissions)", () => {
    isHealthSyncAvailableMock.mockReturnValue(false);
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    const loadJournal = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness userId="user-123" loadProfileTargets={loadProfileTargets} loadJournal={loadJournal} />,
    );
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
    expect(loadProfileTargets).not.toHaveBeenCalled();
  });

  it("runs the sync chain in order when userId + HealthKit available", async () => {
    const callOrder: string[] = [];
    syncHealthDataThrottledMock.mockImplementation(async () => { callOrder.push("syncHealthData"); });
    syncNutritionFromHealthThrottledMock.mockImplementation(async () => { callOrder.push("syncNutrition"); });
    const loadProfileTargets = vi.fn().mockImplementation(async () => { callOrder.push("loadProfileTargets"); });
    const loadJournal = vi.fn().mockImplementation(async () => { callOrder.push("loadJournal"); });

    render(
      <Harness userId="user-123" loadProfileTargets={loadProfileTargets} loadJournal={loadJournal} />,
    );

    // Effect fires synchronously; await one microtask tick for the
    // async IIFE chain to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callOrder).toEqual([
      "syncHealthData",
      "syncNutrition",
      "loadProfileTargets",
      "loadJournal",
    ]);
    expect(syncHealthDataThrottledMock).toHaveBeenCalledWith("user-123");
  });

  it("swallows errors from the HealthKit chain (degrades silently)", async () => {
    syncHealthDataThrottledMock.mockRejectedValue(new Error("HealthKit refused"));
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    const loadJournal = vi.fn().mockResolvedValue(undefined);

    // Should not throw despite the rejection
    expect(() => {
      render(
        <Harness userId="user-123" loadProfileTargets={loadProfileTargets} loadJournal={loadJournal} />,
      );
    }).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Subsequent steps should be skipped because the first await threw
    expect(loadProfileTargets).not.toHaveBeenCalled();
    expect(loadJournal).not.toHaveBeenCalled();
  });
});
