/**
 * logSheetSlotSelector (web) — render harness for the ENG-773 log-time
 * meal-slot selector.
 *
 * 2026-05-08 build-47 follow-up — Grace TF (open feedback):
 *
 *   "items keep getting added to fields by time of day rather than for
 *   the meal i am trying to add them to for example i clikc + for
 *   breakfast but its the afternoon it adds it as snack"
 *
 * The source-grep suites (`logSheetSlotHonouredWeb.test.ts`,
 * `logSheetWebMobileParity.test.ts`) pin the wiring statically. This
 * file mounts the real `<LogSheet>` and exercises the rendered
 * selector: the 4 slot radios appear only when the host wires the
 * `slot` prop (the flag-gated path), the active slot announces
 * `aria-checked`, and tapping a slot calls `onChange` with that slot.
 *
 * Mirror of `apps/mobile/tests/unit/logSheetSlotSelector.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
} from "../../src/app/components/suppr/log-sheet";

// LogSheet mounts <FoodSearchPanel>, which debounces + fans out to
// USDA / OFF / Edamam via fetch. The selector tests never touch the
// network — stub fetch to a permanent no-op (same as logSheetPhase3).
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      open
      onOpenChange={() => {}}
      search={{ onOpen: () => {} }}
      barcode={{ onOpen: () => {} }}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{ onStart: () => {} }}
      photo={{ onCapture: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet slot selector (web) — render", () => {
  it("renders no slot row when the host omits the `slot` prop (flag OFF path)", () => {
    open();
    expect(screen.queryByTestId("log-sheet-slot-row")).toBeNull();
    for (const s of SLOTS) {
      expect(
        screen.queryByTestId(`log-sheet-slot-${s.toLowerCase()}`),
      ).toBeNull();
    }
  });

  it("renders all four slot radios inside a labelled radiogroup when wired", () => {
    open({
      slot: { current: "Breakfast", options: SLOTS, onChange: () => {} },
    });
    const group = screen.getByRole("radiogroup", { name: "Meal to log to" });
    expect(group).toBeDefined();
    for (const s of SLOTS) {
      expect(
        screen.getByTestId(`log-sheet-slot-${s.toLowerCase()}`),
      ).toBeDefined();
    }
    // Exactly four radios in the group.
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("marks only the current slot aria-checked", () => {
    open({ slot: { current: "Lunch", options: SLOTS, onChange: () => {} } });
    expect(
      screen.getByRole("radio", { name: "Lunch", checked: true }),
    ).toBeDefined();
    for (const s of SLOTS.filter((x) => x !== "Lunch")) {
      expect(
        screen.getByRole("radio", { name: s, checked: false }),
      ).toBeDefined();
    }
  });

  it("calls onChange with the tapped slot (not the current one)", () => {
    const onChange = vi.fn();
    open({ slot: { current: "Breakfast", options: SLOTS, onChange } });
    fireEvent.click(screen.getByTestId("log-sheet-slot-dinner"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("Dinner");
  });

  it("re-tapping the already-current slot still forwards that slot", () => {
    // The host owns idempotency — the control fires onChange on every
    // tap so a deliberate re-select of the active slot is observable.
    const onChange = vi.fn();
    open({ slot: { current: "Snacks", options: SLOTS, onChange } });
    fireEvent.click(screen.getByTestId("log-sheet-slot-snacks"));
    expect(onChange).toHaveBeenCalledWith("Snacks");
  });
});
