/**
 * logFab — web canonical Log FAB primitive.
 *
 * Authority: D-2026-04-27-15 (canonical FAB).
 * Source: src/app/components/suppr/log-fab.tsx
 *
 * Pins:
 *   - placement (right-18, bottom-100, 56pt circle, primary tint).
 *   - mobile-web only by default (md:hidden); desktop hides the FAB.
 *   - accessibility label "Log a meal".
 *   - default tap surfaces the placeholder alert; custom onPress
 *     overrides.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LogFab } from "../../src/app/components/suppr/log-fab";

describe("LogFab (web)", () => {
  it("renders by default with the canonical accessibility label", () => {
    render(<LogFab />);
    expect(screen.getByRole("button", { name: "Log a meal" })).toBeDefined();
  });

  it("returns null when visible=false", () => {
    render(<LogFab visible={false} />);
    expect(screen.queryByRole("button", { name: "Log a meal" })).toBeNull();
  });

  it("hides itself on desktop by default (md:hidden)", () => {
    render(<LogFab />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).toMatch(/md:hidden/);
  });

  it("shows on desktop when showOnDesktop=true", () => {
    render(<LogFab showOnDesktop />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).not.toMatch(/md:hidden/);
  });

  it("uses the canonical position classes (right-[18px] bottom-[100px])", () => {
    render(<LogFab />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).toMatch(/right-\[18px\]/);
    expect(btn.className).toMatch(/bottom-\[100px\]/);
  });

  it("calls the supplied onPress instead of surfacing the placeholder alert", () => {
    const onPress = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<LogFab onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Log a meal" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("falls back to the placeholder alert when no onPress is provided", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<LogFab />);
    fireEvent.click(screen.getByRole("button", { name: "Log a meal" }));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[0]).toContain("Phase 3");
    alertSpy.mockRestore();
  });
});
