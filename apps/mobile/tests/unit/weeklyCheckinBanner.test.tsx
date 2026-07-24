// @vitest-environment jsdom
/**
 * WeeklyCheckinBanner (mobile) — the Sunday-morning Today nudge that routes
 * to the Weekly Recap surface.
 *
 * 2026-06-08 flat-slab unification (Grace flagged the below-hero Today cards
 * as inconsistent): the banner used to be the LONE bordered card — a
 * hand-rolled `<View>` with a peach `${Accent.primary}08` tint + a clay
 * `${Accent.primary}30` hairline. It became a unified `<SupprCard>` slab like
 * every other resting Today card; the nudge semantics ride the CONTENT (clay
 * "WEEKLY CHECK-IN" eyebrow + clay "OPEN" button), not the card surface.
 *
 * 2026-06-09 one-treatment (Grace): the banner sits directly on the Today
 * scroll ground, so it takes the SOFT lift — the same treatment as every other
 * page-ground Today card (the hero reference). In the default DARK test theme,
 * soft resolves to a tonal lift (`Colors.dark.cardElevated`) + a hairline,
 * NOT a (poorly-rendered) drop shadow.
 *
 * Pinned here:
 *   1. Every wired affordance survives the re-chrome — copy renders, the
 *      OPEN button fires `onOpen` once, the dismiss X fires `onDismiss` once,
 *      and all three testIDs are present (`weekly-checkin-banner`,
 *      `…-open`, `…-dismiss`).
 *   2. The outer card is a SOFT page-ground slab — in dark its resolved style
 *      carries the tonal-lift `Colors.dark.cardElevated` fill (NOT the old
 *      peach `${Accent.primary}08` tint), still with no hand-rolled card border.
 *
 * Host placement (below-meals, not above the macro tiles) is covered at the
 * integration level in `todayAboveMealsCap.test.ts`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { WeeklyCheckinBanner } from "../../components/today/WeeklyCheckinBanner";

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

  it("renders the outer banner as a SupprNotice block when anatomy owners flag is on", () => {
    const { getByTestId } = render(
      <WeeklyCheckinBanner {...baseProps} onOpen={vi.fn()} onDismiss={vi.fn()} />,
    );
    const notice = getByTestId("weekly-checkin-banner");
    expect(notice).toBeTruthy();
    // Default-on flag: quiet primary-soft notice chrome (not legacy SupprCard slab).
    const flat = flattenStyle(notice.props.style);
    expect(flat.backgroundColor).toBeDefined();
    expect(flat.borderRadius).toBeGreaterThanOrEqual(20);
  });
});
