/**
 * TareAestheticGate — preview override resolution test.
 *
 * Pins the resolution-order contract documented at the top of
 * `app/tare-aesthetic-gate.tsx`:
 *
 *   1. URL param `?tare=on` / `?tare=off` / `?tare=clear`
 *   2. localStorage `suppr.tare-preview`
 *   3. PostHog flag `tare-aesthetic-v1`
 *
 * Why pin it: V0.9 ships the dev-preview gate that Grace uses to
 * review every visible-change increment before it ramps. If the
 * resolution order ever drifts (e.g. flag silently wins over URL
 * param) Grace's preview would be misleading. This pin would trip.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { TareAestheticGate } from "../../app/tare-aesthetic-gate";

const PREVIEW_KEY = "suppr.tare-preview";

// Mock posthog-js/react — useFeatureFlagEnabled returns a stub we
// control per test via the closure variable below.
let mockFlag: boolean | undefined = false;
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => mockFlag,
}));

// Mock next/navigation — usePathname is the only hook we use, returns
// a stable string so the effect runs once per test render.
vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
}));

function setSearch(search: string): void {
  // Mutate the URL in JSDOM so `window.location.search` reflects the
  // test's intended URL state. Use `pushState` so the navigation API
  // mirrors a real router transition.
  window.history.pushState({}, "", `/today${search}`);
}

function clearAll(): void {
  window.localStorage.clear();
  setSearch("");
  document.body.className = "";
  mockFlag = false;
}

describe("<TareAestheticGate>", () => {
  beforeEach(() => {
    clearAll();
  });

  it("flag off + no override → no `tare-on` class", () => {
    mockFlag = false;
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(false);
  });

  it("flag on + no override → `tare-on` class added", () => {
    mockFlag = true;
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
  });

  it("URL `?tare=on` beats flag off", () => {
    mockFlag = false;
    setSearch("?tare=on");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
    // …and persists to localStorage so subsequent navigations keep
    // the preview alive even after the param is dropped from the URL.
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("on");
  });

  it("URL `?tare=off` beats flag on", () => {
    mockFlag = true;
    setSearch("?tare=off");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(false);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("off");
  });

  it("localStorage `on` beats flag off (preview persists across navigation)", () => {
    mockFlag = false;
    window.localStorage.setItem(PREVIEW_KEY, "on");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
  });

  it("localStorage `off` beats flag on", () => {
    mockFlag = true;
    window.localStorage.setItem(PREVIEW_KEY, "off");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(false);
  });

  it("URL `?tare=clear` drops the override; flag decides again", () => {
    mockFlag = true;
    window.localStorage.setItem(PREVIEW_KEY, "off");
    setSearch("?tare=clear");
    render(<TareAestheticGate>child</TareAestheticGate>);
    // Override cleared → flag (true) decides → class is present
    expect(document.body.classList.contains("tare-on")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("URL `?tare=` (empty value) also clears the override", () => {
    mockFlag = false;
    window.localStorage.setItem(PREVIEW_KEY, "on");
    setSearch("?tare=");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(false);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("malformed URL param is ignored (defers to flag)", () => {
    mockFlag = true;
    setSearch("?tare=banana");
    render(<TareAestheticGate>child</TareAestheticGate>);
    // Param wasn't `on`/`off`/`clear`/empty → no override applied →
    // flag (true) wins.
    expect(document.body.classList.contains("tare-on")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("flag transitions on → off remove the class when no override is set", () => {
    mockFlag = true;
    const { rerender } = render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
    mockFlag = false;
    act(() => {
      rerender(<TareAestheticGate>child</TareAestheticGate>);
    });
    expect(document.body.classList.contains("tare-on")).toBe(false);
  });
});
