// @vitest-environment jsdom
/**
 * ENG-1441 (2026-07-21) — `useStripeTaxEnabled`. Fetches
 * `/api/stripe/tax-status` once (module-level cache/dedupe) and
 * defaults to `false` (never claim VAT-inclusive pricing on an
 * unresolved flag). `vi.resetModules()` + a fresh dynamic import per
 * test isolates the intentional module-level cache — without it these
 * tests would leak the first resolved value into every later test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockRoute(body: Record<string, unknown>, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body });
}

async function loadHook() {
  const mod = await import("../../src/lib/stripe/useStripeTaxEnabled");
  return mod.useStripeTaxEnabled;
}

describe("useStripeTaxEnabled", () => {
  it("defaults to false before the fetch resolves", async () => {
    mockRoute({ ok: true, stripeTaxEnabled: true });
    const useStripeTaxEnabled = await loadHook();
    const { result } = renderHook(() => useStripeTaxEnabled());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("resolves to true when the route reports the flag on", async () => {
    mockRoute({ ok: true, stripeTaxEnabled: true });
    const useStripeTaxEnabled = await loadHook();
    const { result } = renderHook(() => useStripeTaxEnabled());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false when the route reports the flag off", async () => {
    mockRoute({ ok: true, stripeTaxEnabled: false });
    const useStripeTaxEnabled = await loadHook();
    const { result } = renderHook(() => useStripeTaxEnabled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("fails closed (false) on a network error — never guesses VAT-inclusive", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const useStripeTaxEnabled = await loadHook();
    const { result } = renderHook(() => useStripeTaxEnabled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("fails closed (false) on a non-ok response", async () => {
    mockRoute({ ok: false }, /* ok */ false);
    const useStripeTaxEnabled = await loadHook();
    const { result } = renderHook(() => useStripeTaxEnabled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("caches across multiple hook consumers — one fetch for two mounts", async () => {
    mockRoute({ ok: true, stripeTaxEnabled: true });
    const useStripeTaxEnabled = await loadHook();
    const first = renderHook(() => useStripeTaxEnabled());
    const second = renderHook(() => useStripeTaxEnabled());
    await waitFor(() => expect(first.result.current).toBe(true));
    await waitFor(() => expect(second.result.current).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
