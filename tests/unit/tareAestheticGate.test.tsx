/**
 * TareAestheticGate (web) — preview override + flag resolution.
 *
 * Mirror of `apps/mobile/tests/unit/tareAesthetic.test.tsx`.
 *
 * Resolution order on `<TareAestheticGate>`:
 *   1. URL param `?tare=on` / `?tare=off` / `?tare=clear` (or empty)
 *   2. localStorage `suppr.tare-preview`
 *   3. PostHog flag `tare-aesthetic-v1`
 *
 * Pinned here because the gate is what Grace uses to preview every
 * visible-change increment per-device before ramp. If precedence
 * drifts the preview lies.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { TareAestheticGate } from "../../app/tare-aesthetic-gate";

const PREVIEW_KEY = "suppr.tare-preview";

let mockFlag: boolean | undefined = false;
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => mockFlag,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
}));

function setSearch(search: string): void {
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

  it("URL `?tare=on` beats flag off + persists to localStorage", () => {
    mockFlag = false;
    setSearch("?tare=on");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
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

  it("malformed URL param defers to flag", () => {
    mockFlag = true;
    setSearch("?tare=banana");
    render(<TareAestheticGate>child</TareAestheticGate>);
    expect(document.body.classList.contains("tare-on")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("flag on → off rerender removes the class when no override set", () => {
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
