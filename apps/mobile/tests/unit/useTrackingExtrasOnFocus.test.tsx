/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup, act } from "@testing-library/react-native";

const getItemMock = vi.fn();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => getItemMock(key),
  },
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void) => {
    React.useEffect(() => cb(), [cb]);
  },
}));

import { useTrackingExtrasOnFocus } from "../../hooks/useTrackingExtrasOnFocus";

function Probe(props: { onValues?: (v: { trackCaffeine: boolean; trackAlcohol: boolean }) => void }) {
  const v = useTrackingExtrasOnFocus();
  React.useEffect(() => { props.onValues?.(v); }, [v.trackCaffeine, v.trackAlcohol, props, v]);
  return null;
}

// 2026-05-16: full-suite runs were flaking on test #3 (`trackCaffeine: true`)
// because the post-mock async state updates from the hook's IIFE inside
// `useFocusEffect` weren't being flushed inside React's `act` queue —
// jsdom + vitest's vmThreads pool surfaces this differently than
// running the file in isolation. Wrapping the flush in `act` makes
// React commit the pending effect chain deterministically before the
// assertion runs.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useTrackingExtrasOnFocus (Today split #4)", () => {
  beforeEach(() => {
    getItemMock.mockReset();
  });

  afterEach(() => {
    // Explicit unmount between tests so a stale Probe from a prior
    // test never lingers and overwrites the new test's `last` via its
    // residual onValues callback.
    cleanup();
  });

  it("defaults to false / false on mount before storage resolves", () => {
    getItemMock.mockResolvedValue(null);
    let last = { trackCaffeine: true, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    // Synchronous initial render sees the default false / false
    expect(last).toEqual({ trackCaffeine: false, trackAlcohol: false });
  });

  it("stays at defaults when storage is empty (`null`)", async () => {
    getItemMock.mockResolvedValue(null);
    let last = { trackCaffeine: true, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: false, trackAlcohol: false });
  });

  it("parses `trackCaffeine: true, trackAlcohol: false` from storage", async () => {
    getItemMock.mockResolvedValue(JSON.stringify({ trackCaffeine: true, trackAlcohol: false }));
    let last = { trackCaffeine: false, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: true, trackAlcohol: false });
  });

  it("parses both true", async () => {
    getItemMock.mockResolvedValue(JSON.stringify({ trackCaffeine: true, trackAlcohol: true }));
    let last = { trackCaffeine: false, trackAlcohol: false };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: true, trackAlcohol: true });
  });

  it("falls back to false for non-boolean storage values", async () => {
    getItemMock.mockResolvedValue(JSON.stringify({ trackCaffeine: "yes", trackAlcohol: 1 }));
    let last = { trackCaffeine: true, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: false, trackAlcohol: false });
  });

  it("keeps defaults when JSON is malformed", async () => {
    getItemMock.mockResolvedValue("{ not valid json");
    let last = { trackCaffeine: true, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: false, trackAlcohol: false });
  });

  it("keeps defaults when AsyncStorage rejects", async () => {
    getItemMock.mockRejectedValue(new Error("AsyncStorage down"));
    let last = { trackCaffeine: true, trackAlcohol: true };
    render(<Probe onValues={(v) => { last = v; }} />);
    await flush();
    expect(last).toEqual({ trackCaffeine: false, trackAlcohol: false });
  });

  it("reads the canonical `suppr.tracking-extras.v1` storage key", async () => {
    getItemMock.mockResolvedValue(null);
    render(<Probe />);
    await flush();
    expect(getItemMock).toHaveBeenCalledWith("suppr.tracking-extras.v1");
  });
});
