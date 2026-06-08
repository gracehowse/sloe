// @vitest-environment jsdom
/**
 * WeeklyCheckinBanner (mobile) — the Sunday-morning Today nudge that routes
 * to the Weekly Recap surface.
 *
 * 2026-06-08 flat-slab unification (Grace flagged the below-hero Today cards
 * as inconsistent): the banner used to be the LONE bordered card — a
 * hand-rolled `<View>` with a peach `${Accent.primary}08` tint + a clay
 * `${Accent.primary}30` hairline. It is now a flat `<SupprCard lift="flat">`
 * cream slab like every other resting Today card; the nudge semantics ride
 * the CONTENT (clay "WEEKLY CHECK-IN" eyebrow + clay "OPEN" button), not the
 * card surface.
 *
 * Pinned here:
 *   1. Every wired affordance survives the re-chrome — copy renders, the
 *      OPEN button fires `onOpen` once, the dismiss X fires `onDismiss` once,
 *      and all three testIDs are present (`weekly-checkin-banner`,
 *      `…-open`, `…-dismiss`).
 *   2. The outer card is a borderless flat slab — its resolved style carries
 *      the cream `Colors.dark.card` fill (the test theme default) and draws
 *      NO border on the card surface (the regression that was fixed).
 *
 * Host placement (below-meals, not above the macro tiles) is covered at the
 * integration level in `todayAboveMealsCap.test.ts`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { WeeklyCheckinBanner } from "../../components/today/WeeklyCheckinBanner";
import { Colors } from "../../constants/theme";

void React;

/** Flatten a possibly-nested RN style prop into one object. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

const baseProps = {
  textColor: "#000",
  textSecondaryColor: "#555",
};

describe("WeeklyCheckinBanner (mobile)", () => {
  it("renders the calm eyebrow + ready + supporting copy", () => {
    const { getByText } = render(
      <WeeklyCheckinBanner {...baseProps} onOpen={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(getByText("WEEKLY CHECK-IN")).toBeTruthy();
    expect(getByText("Your weekly check-in is ready.")).toBeTruthy();
    expect(getByText(/See last week.+adjust your goal pace\./)).toBeTruthy();
  });

  it("fires onOpen exactly once when OPEN is pressed", () => {
    const onOpen = vi.fn();
    const { getByTestId } = render(
      <WeeklyCheckinBanner {...baseProps} onOpen={onOpen} onDismiss={vi.fn()} />,
    );
    fireEvent.press(getByTestId("weekly-checkin-banner-open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("fires onDismiss exactly once when the X is pressed", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(
      <WeeklyCheckinBanner {...baseProps} onOpen={vi.fn()} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId("weekly-checkin-banner-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the outer banner as a borderless flat slab (cream fill, no card border)", () => {
    const { getByTestId } = render(
      <WeeklyCheckinBanner {...baseProps} onOpen={vi.fn()} onDismiss={vi.fn()} />,
    );
    const outer = flattenStyle(getByTestId("weekly-checkin-banner").props.style);
    // Cream card fill (default test theme = dark) — the shared SupprCard slab,
    // NOT the old peach `${Accent.primary}08` tint.
    expect(outer.backgroundColor).toBe(Colors.dark.card);
    // Flat lift draws no border on the card surface (borderWidth lives on the
    // inner clip and is 0 for a flat, borderless slab).
    expect(outer.borderWidth ?? 0).toBe(0);
  });
});
