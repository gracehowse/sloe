// @vitest-environment jsdom
/**
 * Web `<DayStrip>` — selected-day indicator (design_consistency_v1,
 * 2026-07-24). Web twin of `apps/mobile/tests/unit/dayStripMinimalIndicator`.
 *
 * The whole-app design critique found the strip had NO selection state (only
 * ink weight distinguished the selected day) and that the dot conflated "has
 * data" with "is selected". The fix gives each channel one meaning:
 *   RING   → selection only — a 1px plum outline tight around the numeral (the
 *            rounded-outline idiom Progress already uses), never a fill. Both
 *            the 2026-06-24 plum-filled cell and the 2026-06-10 soft-tint pill
 *            stay retired.
 *   NUMBER → temporal tone only (selected ink / today accent / future tint /
 *            default secondary).
 *   DOT    → has data only. One colour (sage); no `onAccent` kind.
 * Future days step to the tertiary ink TINT rather than the old blanket
 * `opacity: .42` cell fade, which read as "disabled" on a navigable day.
 *
 * Web + mobile share the `dayStripIndicator` decision so the two platforms
 * can't drift; this test pins the rendered web result.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { DayStrip } from "../../src/app/components/DayStrip";
import {
  addDaysLocal,
  dateKeyFromDate,
} from "../../src/lib/nutrition/journalNavigation.ts";

void React;

// jsdom has no ResizeObserver; the web DayStrip creates one to measure the
// pager. Stub it so the mount effect doesn't throw. The day tiles render
// unconditionally (not gated on measured width), so a no-op stub is enough.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

function renderStrip(opts?: { loggedKeys?: string[]; selectedDateKey?: string }) {
  const todayKey = dateKeyFromDate(new Date());
  return render(
    <DayStrip
      selectedDateKey={opts?.selectedDateKey ?? todayKey}
      weekStartDay="monday"
      loggedDays={new Set(opts?.loggedKeys ?? [])}
      onSelectDateKey={vi.fn()}
      onOpenCalendar={vi.fn()}
    />,
  );
}

/** The one tile the user has selected (`aria-current="date"`). */
function selectedTile(container: HTMLElement): HTMLButtonElement {
  const tiles = container.querySelectorAll<HTMLButtonElement>(
    'button[aria-current="date"]',
  );
  expect(tiles).toHaveLength(1);
  return tiles[0]!;
}

describe("web DayStrip — the selected day is contained by a ring", () => {
  it("renders minimal dot test-ids (the redesigned path is live)", () => {
    const { container } = renderStrip();
    const dots = container.querySelectorAll('[data-testid^="daystrip-dot-minimal-"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it("draws exactly one plum ring, tight around the numeral", () => {
    const { container } = renderStrip();
    const rings = container.querySelectorAll('[data-testid="daystrip-selected-ring"]');
    expect(rings).toHaveLength(1);
    expect(rings[0]!.className).toContain("border-primary");
    // Rounded-outline idiom, matching Progress's marked day (6px == Radius.md).
    expect(rings[0]!.className).toContain("rounded-md");
    // …and it lives inside the selected tile, not on the whole cell.
    expect(selectedTile(container).contains(rings[0]!)).toBe(true);
  });

  it("keeps the border slot occupied on unselected days (no layout shift)", () => {
    const { container } = renderStrip();
    const numerals = Array.from(
      container.querySelectorAll<HTMLElement>("button > div.relative"),
    );
    expect(numerals.length).toBeGreaterThan(1);
    for (const n of numerals) {
      const tokens = n.className.split(/\s+/);
      // Every numeral box carries the 1px border; only the selected one is plum.
      expect(tokens).toContain("border");
      expect(
        tokens.includes("border-primary") || tokens.includes("border-transparent"),
      ).toBe(true);
    }
  });

  it("fills NO day cell — the ring contains, it never floods (2026-07-24)", () => {
    const { container } = renderStrip();
    // No tile may carry the solid plum fill (`bg-primary` without a suffix)…
    const filled = Array.from(container.querySelectorAll("button")).filter(
      (b) =>
        /\bbg-primary\b/.test(b.className) &&
        !b.className.includes("bg-primary-soft"),
    );
    expect(filled.length).toBe(0);
    // …nor the white on-accent number that fill used to require…
    expect(container.innerHTML).not.toContain("text-primary-foreground");
    // …nor the retired soft-tint pill.
    expect(container.innerHTML).not.toContain("bg-primary-soft");
  });

  it("today (selected) renders the faint 'none' dot when unlogged", () => {
    const { container } = renderStrip();
    const none = container.querySelectorAll('[data-testid="daystrip-dot-minimal-none"]');
    expect(none.length).toBeGreaterThanOrEqual(1);
  });

  it("a logged non-selected day renders a sage dot, not a check icon", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { container } = renderStrip({ loggedKeys: [dateKeyFromDate(yesterday)] });
    const sage = container.querySelectorAll('[data-testid="daystrip-dot-minimal-sage"]');
    expect(sage.length).toBeGreaterThanOrEqual(1);
  });

  it("the SELECTED logged day keeps the sage dot — the dot means DATA only", () => {
    const todayKey = dateKeyFromDate(new Date());
    const { container } = renderStrip({ loggedKeys: [todayKey] });
    // The retired `onAccent` kind conflated "logged" with "selected".
    expect(
      container.querySelectorAll('[data-testid="daystrip-dot-minimal-onAccent"]'),
    ).toHaveLength(0);
    expect(
      selectedTile(container).getAttribute("data-testid"),
    ).toBe("daystrip-dot-minimal-sage");
  });

  it("future days take a tertiary TINT, never the disabled-looking opacity fade", () => {
    // Selecting today+8 puts the whole visible panel in the future whatever
    // weekday the suite runs on: the earliest day in that week is today+2 at
    // worst, and today+30 is still inside the journal range. Calendar-agnostic
    // by construction (CI hygiene: no day-of-week-sensitive fixtures).
    const target = addDaysLocal(new Date(), 8);
    const { container } = renderStrip({ selectedDateKey: dateKeyFromDate(target) });
    const panel = selectedTile(container).parentElement!;
    const futureTiles = Array.from(
      panel.querySelectorAll<HTMLButtonElement>("button:not([aria-current])"),
    );
    expect(futureTiles).toHaveLength(6);
    for (const tile of futureTiles) {
      // Navigable, so never dimmed like a genuinely out-of-range day…
      expect(tile.className).not.toContain("opacity-[0.42]");
      expect(tile.disabled).toBe(false);
      // …and "not yet" is carried by a lighter ink TINT on the numeral.
      const numeral = tile.querySelector("span.tabular-nums");
      expect(numeral?.className).toContain("text-foreground-tertiary");
    }
  });

  it("no day tile anywhere carries the retired blanket future fade", () => {
    const { container } = renderStrip();
    expect(container.innerHTML).not.toContain("opacity-[0.42]");
  });

  it("day tiles ship hover + focus-visible states, not just a resting look", () => {
    const { container } = renderStrip();
    const tile = selectedTile(container);
    expect(tile.className).toContain("hover:bg-muted");
    expect(tile.className).toContain("focus-visible:ring-primary");
  });

  it("exposes the week chevrons (prototype `.day-nav`)", () => {
    const { container } = renderStrip();
    expect(container.querySelector('button[aria-label="Previous week"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Next week"]')).not.toBeNull();
  });
});
