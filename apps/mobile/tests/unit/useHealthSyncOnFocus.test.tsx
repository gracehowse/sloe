/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, waitFor } from "@testing-library/react-native";

const syncHealthDataThrottledMock = vi.fn();
const isHealthSyncAvailableMock = vi.fn();

vi.mock("@/lib/healthSync", () => ({
  syncHealthDataThrottled: (...args: unknown[]) => syncHealthDataThrottledMock(...args),
  isHealthSyncAvailable: () => isHealthSyncAvailableMock(),
}));

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    InteractionManager: {
      runAfterInteractions: (cb: () => void) => {
        cb();
        return { cancel: vi.fn() };
      },
    },
  };
});

vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(() => cb(), [cb]);
  },
}));

import { useHealthSyncOnFocus } from "../../hooks/useHealthSyncOnFocus";

function Harness(props: {
  userId: string | null | undefined;
  loadProfileTargets: () => Promise<void>;
}) {
  useHealthSyncOnFocus(props.userId, props.loadProfileTargets);
  return null;
}

describe("useHealthSyncOnFocus (Today extract #1)", () => {
  beforeEach(() => {
    syncHealthDataThrottledMock.mockReset();
    isHealthSyncAvailableMock.mockReset();
    syncHealthDataThrottledMock.mockResolvedValue(undefined);
    isHealthSyncAvailableMock.mockReturnValue(true);
  });

  it("no-ops when userId is null", () => {
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    render(<Harness userId={null} loadProfileTargets={loadProfileTargets} />);
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
    expect(loadProfileTargets).not.toHaveBeenCalled();
  });

  it("no-ops when userId is undefined", () => {
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    render(<Harness userId={undefined} loadProfileTargets={loadProfileTargets} />);
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
  });

  it("no-ops when HealthKit is unavailable (Android / no permissions)", () => {
    isHealthSyncAvailableMock.mockReturnValue(false);
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);
    render(<Harness userId="user-123" loadProfileTargets={loadProfileTargets} />);
    expect(syncHealthDataThrottledMock).not.toHaveBeenCalled();
    expect(loadProfileTargets).not.toHaveBeenCalled();
  });

  it("syncs body metrics then refreshes profile after HealthKit writes land", async () => {
    const callOrder: string[] = [];
    syncHealthDataThrottledMock.mockImplementation(async () => { callOrder.push("syncHealthData"); });
    const loadProfileTargets = vi.fn().mockImplementation(async () => { callOrder.push("loadProfileTargets"); });

    render(<Harness userId="user-123" loadProfileTargets={loadProfileTargets} />);

    await waitFor(() => {
      expect(callOrder).toEqual(["syncHealthData", "loadProfileTargets"]);
    });
    expect(syncHealthDataThrottledMock).toHaveBeenCalledWith("user-123");
  });

  it("still refreshes profile when HealthKit sync fails", async () => {
    syncHealthDataThrottledMock.mockRejectedValue(new Error("HealthKit refused"));
    const loadProfileTargets = vi.fn().mockResolvedValue(undefined);

    expect(() => {
      render(<Harness userId="user-123" loadProfileTargets={loadProfileTargets} />);
    }).not.toThrow();

    await waitFor(() => {
      expect(loadProfileTargets).toHaveBeenCalled();
    });
  });
});
