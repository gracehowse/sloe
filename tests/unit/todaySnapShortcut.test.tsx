/**
 * TodaySnapShortcut — web component pin.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" parity). The shortcut
 * surfaces PhotoLog as a one-tap entry point on Today. Tests pin:
 *   - Click fires the host callback.
 *   - Default a11y label is "Snap a meal".
 *   - When `locked`, label flips to "Snap a meal (Pro)" so the gate
 *     is announced before the user taps.
 *   - Lock badge renders only when `locked === true`.
 *   - Canonical `today-snap-shortcut` testID for cross-platform tests.
 */

import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

import { TodaySnapShortcut } from "../../src/app/components/suppr/today-snap-shortcut";

describe("TodaySnapShortcut (web)", () => {
  it("renders the canonical 'Snap a meal' label and supporting copy", () => {
    render(<TodaySnapShortcut onPress={() => {}} />);
    expect(screen.getByText("Snap a meal")).toBeDefined();
    expect(screen.getByText("One photo, full macros — no typing.")).toBeDefined();
  });

  it("fires onPress exactly once when clicked", () => {
    const onPress = vi.fn();
    render(<TodaySnapShortcut onPress={onPress} />);
    fireEvent.click(screen.getByTestId("today-snap-shortcut"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the default aria-label 'Snap a meal' when unlocked", () => {
    render(<TodaySnapShortcut onPress={() => {}} />);
    expect(screen.getByLabelText("Snap a meal")).toBeDefined();
  });

  it("flips the aria-label to 'Snap a meal (Pro)' when locked", () => {
    render(<TodaySnapShortcut onPress={() => {}} locked />);
    expect(screen.getByLabelText("Snap a meal (Pro)")).toBeDefined();
  });

  it("renders the lock badge only when locked", () => {
    const { rerender } = render(<TodaySnapShortcut onPress={() => {}} />);
    expect(screen.queryByTestId("today-snap-shortcut-lock")).toBeNull();
    rerender(<TodaySnapShortcut onPress={() => {}} locked />);
    expect(screen.queryByTestId("today-snap-shortcut-lock")).not.toBeNull();
  });

  it("supports a custom testID for downstream test suites", () => {
    render(<TodaySnapShortcut onPress={() => {}} testID="custom-snap-id" />);
    expect(screen.queryByTestId("custom-snap-id")).not.toBeNull();
    expect(screen.queryByTestId("today-snap-shortcut")).toBeNull();
  });
});
