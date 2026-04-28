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
 *   - tap calls supplied onPress (Phase 3 placeholder removed
 *     2026-04-28; the unified <LogSheet> is wired by NutritionTracker).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LogFab } from "../../src/app/components/suppr/log-fab";

const noop = () => {};

describe("LogFab (web)", () => {
  it("renders by default with the canonical accessibility label", () => {
    render(<LogFab onPress={noop} />);
    expect(screen.getByRole("button", { name: "Log a meal" })).toBeDefined();
  });

  it("returns null when visible=false", () => {
    render(<LogFab visible={false} onPress={noop} />);
    expect(screen.queryByRole("button", { name: "Log a meal" })).toBeNull();
  });

  it("hides itself on desktop by default (md:hidden)", () => {
    render(<LogFab onPress={noop} />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).toMatch(/md:hidden/);
  });

  it("shows on desktop when showOnDesktop=true", () => {
    render(<LogFab showOnDesktop onPress={noop} />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).not.toMatch(/md:hidden/);
  });

  it("uses the canonical position classes (right-[18px] bottom-[100px])", () => {
    render(<LogFab onPress={noop} />);
    const btn = screen.getByRole("button", { name: "Log a meal" });
    expect(btn.className).toMatch(/right-\[18px\]/);
    expect(btn.className).toMatch(/bottom-\[100px\]/);
  });

  it("calls the supplied onPress on click", () => {
    const onPress = vi.fn();
    render(<LogFab onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Log a meal" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
