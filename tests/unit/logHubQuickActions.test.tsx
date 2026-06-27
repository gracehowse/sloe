/**
 * logHubQuickActions (web) — render harness for the ENG-1247 LogHub
 * quick-action row (Log usual / Copy yesterday / Duplicate day).
 *
 * Mounts the real `<LogSheet>` and exercises the `quickActions` prop:
 *  - the row renders ONLY the actions whose handlers are present (no dead
 *    buttons): 0 saved meals hides "Log usual"; absent copy-yesterday /
 *    duplicate-day entries hide those buttons;
 *  - the "Log usual" label reflects the resolved meal name;
 *  - tapping each button fires the host handler;
 *  - when `quickActions` is wired, the standalone copy-yesterday row
 *    (testID `copy-yesterday-row`) does NOT double-render.
 *
 * The pure "Log usual" SELECTION logic is covered platform-agnostically in
 * `tests/unit/savedMealsLogic.test.ts#selectUsualSavedMeal`; this file
 * covers the web UI wiring only.
 *
 * Mirror of `apps/mobile/tests/unit/logHubQuickActions.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LogSheet, type LogSheetProps } from "../../src/app/components/suppr/log-sheet";

// LogSheet mounts <FoodSearchPanel>, which debounces + fans out via fetch.
// The quick-action tests never touch the network — stub fetch to a no-op
// (same as logSheetSlotSelector).
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

describe("LogSheet LogHub quick actions (web) — render", () => {
  it("renders no quick-action row when neither copyYesterday nor quickActions is wired", () => {
    open();
    expect(screen.queryByTestId("loghub-quick-actions")).toBeNull();
    expect(screen.queryByTestId("copy-yesterday-row")).toBeNull();
  });

  it("renders all three buttons when every action is resolvable", () => {
    open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        copyYesterday: { count: 4, onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(screen.getByTestId("loghub-quick-actions")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("labels the Log usual button with the resolved meal name", () => {
    open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
      },
    });
    expect(
      screen.getByRole("button", { name: "Log Usual breakfast" }),
    ).toBeTruthy();
  });

  it("hides Log usual when the user has no saved meals (logUsual omitted)", () => {
    open({
      quickActions: {
        copyYesterday: { count: 2, onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(screen.queryByTestId("loghub-quick-log-usual")).toBeNull();
    expect(screen.getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("hides Copy yesterday when that action is omitted (yesterday empty)", () => {
    open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(screen.queryByTestId("loghub-quick-copy-yesterday")).toBeNull();
    expect(screen.getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("hides Duplicate day when that action is omitted (today empty)", () => {
    open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        copyYesterday: { count: 3, onTap: () => {} },
      },
    });
    expect(screen.queryByTestId("loghub-quick-duplicate-day")).toBeNull();
    expect(screen.getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(screen.getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
  });

  it("renders nothing when quickActions is wired but every entry is absent", () => {
    open({ quickActions: {} });
    expect(screen.queryByTestId("loghub-quick-actions")).toBeNull();
  });

  it("fires each handler on click", () => {
    const onLogUsual = vi.fn();
    const onCopy = vi.fn();
    const onDuplicate = vi.fn();
    open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: onLogUsual },
        copyYesterday: { count: 4, onTap: onCopy },
        duplicateDay: { onTap: onDuplicate },
      },
    });
    fireEvent.click(screen.getByTestId("loghub-quick-log-usual"));
    fireEvent.click(screen.getByTestId("loghub-quick-copy-yesterday"));
    fireEvent.click(screen.getByTestId("loghub-quick-duplicate-day"));
    expect(onLogUsual).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("does NOT double-render the standalone copy-yesterday row when quickActions is wired", () => {
    open({
      // Both props passed — quickActions must win, the legacy row stays hidden.
      copyYesterday: { count: 5, onTap: () => {} },
      quickActions: {
        copyYesterday: { count: 5, onTap: () => {} },
      },
    });
    expect(screen.getByTestId("loghub-quick-actions")).toBeTruthy();
    expect(screen.queryByTestId("copy-yesterday-row")).toBeNull();
  });

  it("renders the legacy standalone copy-yesterday row when only copyYesterday is wired (flag-off path)", () => {
    open({ copyYesterday: { count: 5, onTap: () => {} } });
    expect(screen.getByTestId("copy-yesterday-row")).toBeTruthy();
    expect(screen.queryByTestId("loghub-quick-actions")).toBeNull();
  });
});
