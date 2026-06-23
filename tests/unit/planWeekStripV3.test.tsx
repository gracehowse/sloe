// @vitest-environment jsdom
/**
 * PlanWeekStripV3 (ENG-1225 Block 2) — WEB parity twin. Pins the 7-cell day
 * row, the selected-day `aria-selected` state, and day selection firing.
 * Mirrors `apps/mobile/tests/unit/planWeekStripV3.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PlanWeekStripV3,
  type PlanWeekStripDay,
} from "../../src/app/components/plan/PlanWeekStripV3";

void React;

const days: PlanWeekStripDay[] = [
  { key: "16", dayLetter: "M", dateNum: 16, status: "full", isToday: false },
  { key: "17", dayLetter: "T", dateNum: 17, status: "full", isToday: false },
  { key: "18", dayLetter: "W", dateNum: 18, status: "part", isToday: false },
  { key: "19", dayLetter: "T", dateNum: 19, status: "empty", isToday: true },
  { key: "20", dayLetter: "F", dateNum: 20, status: "full", isToday: false },
  { key: "21", dayLetter: "S", dateNum: 21, status: "part", isToday: false },
  { key: "22", dayLetter: "S", dateNum: 22, status: "empty", isToday: false },
];

describe("PlanWeekStripV3 (web)", () => {
  it("renders all 7 day cells", () => {
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={() => {}} />,
    );
    for (const d of days) {
      expect(getByLabelText(`${d.dayLetter} ${d.dateNum}`)).not.toBeNull();
    }
  });

  it("marks the selected day's tab as selected", () => {
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={() => {}} />,
    );
    expect(getByLabelText("T 19").getAttribute("aria-selected")).toBe("true");
    expect(getByLabelText("M 16").getAttribute("aria-selected")).toBe("false");
  });

  it("fires onSelectDay with the tapped day's key", () => {
    const onSelectDay = vi.fn();
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={onSelectDay} />,
    );
    fireEvent.click(getByLabelText("F 20"));
    expect(onSelectDay).toHaveBeenCalledWith("20");
  });
});
