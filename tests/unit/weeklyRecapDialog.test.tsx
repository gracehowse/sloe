// @vitest-environment jsdom
/**
 * WeeklyRecapDialog — the recap destination (ENG-1225 #20). Pins that, when
 * open, it hosts the shareable card and both Save + Share actions.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyRecapDialog } from "../../src/app/components/suppr/weekly-recap-dialog";

void React;

const props = {
  open: true,
  onOpenChange: () => {},
  weekLabel: "16–22 Jun",
  onTargetDays: 5,
  dailyCalories: [1980, 2120, 1850, 2460, 1920, 2050, null] as (number | null)[],
  targetCalories: 2100,
  narrative: "A steady, consistent week.",
};

describe("WeeklyRecapDialog", () => {
  it("hosts the recap card + Save and Share actions when open", () => {
    const { queryByTestId } = render(<WeeklyRecapDialog {...props} />);
    expect(queryByTestId("weekly-recap-card")).not.toBeNull();
    expect(queryByTestId("recap-save")).not.toBeNull();
    expect(queryByTestId("recap-share")).not.toBeNull();
  });

  it("renders nothing visible when closed", () => {
    const { queryByTestId } = render(<WeeklyRecapDialog {...props} open={false} />);
    expect(queryByTestId("weekly-recap-card")).toBeNull();
  });
});
