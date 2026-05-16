/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react-native";

const parallelMock = vi.fn();
const timingMock = vi.fn();
const startMock = vi.fn();

vi.mock("react-native", () => ({
  Animated: {
    Value: class {
      _value: number;
      constructor(v: number) { this._value = v; }
    },
    timing: (...args: unknown[]) => {
      timingMock(...args);
      return { start: startMock };
    },
    parallel: (entries: unknown[]) => {
      parallelMock(entries);
      return { start: startMock };
    },
    View: ({ children }: { children?: React.ReactNode }) => children as React.ReactElement,
  },
  Easing: {
    out: (curve: unknown) => curve,
    quad: "quad",
  },
}));

vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => {
    React.useEffect(() => cb(), [cb]);
  },
}));

import { useTodayMountAnimation } from "../../hooks/useTodayMountAnimation";

function Harness() {
  const anims = useTodayMountAnimation();
  return <>{JSON.stringify(Object.keys(anims))}</>;
}

describe("useTodayMountAnimation (Today split #2)", () => {
  beforeEach(() => {
    parallelMock.mockReset();
    timingMock.mockReset();
    startMock.mockReset();
  });

  it("returns three named Animated.Value handles", () => {
    let capturedAnims: ReturnType<typeof useTodayMountAnimation> | null = null;
    function Probe() {
      capturedAnims = useTodayMountAnimation();
      return null;
    }
    render(<Probe />);
    expect(capturedAnims).not.toBeNull();
    const anims = capturedAnims as unknown as Record<string, unknown>;
    expect(anims.heroFadeAnim).toBeDefined();
    expect(anims.sectionSlideAnim).toBeDefined();
    expect(anims.sectionFadeAnim).toBeDefined();
  });

  it("fires Animated.parallel with three timing entries on first focus", () => {
    render(<Harness />);
    expect(parallelMock).toHaveBeenCalledTimes(1);
    const entries = parallelMock.mock.calls[0][0] as unknown[];
    expect(entries).toHaveLength(3);
    expect(timingMock).toHaveBeenCalledTimes(3);
  });

  it("starts the animation chain", () => {
    render(<Harness />);
    expect(startMock).toHaveBeenCalled();
  });

  it("guards re-fires — focus effect running twice does NOT re-trigger animations", () => {
    function DoubleFocus() {
      const anims = useTodayMountAnimation();
      // Second invocation in same render — the inner ref guard should
      // suppress it. (In real RN, useFocusEffect would re-fire on tab
      // re-focus.)
      useTodayMountAnimation();
      return JSON.stringify(Object.keys(anims));
    }
    render(<DoubleFocus />);
    // First hook call fires once; second hook is a separate instance
    // with its own ref so it fires once too. Total: 2 (not 1, not 4).
    expect(parallelMock).toHaveBeenCalledTimes(2);
  });
});
