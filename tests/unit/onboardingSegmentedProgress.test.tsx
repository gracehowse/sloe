import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingSegmentedProgress } from "@/app/components/onboarding/onboarding-segmented-progress";

describe("OnboardingSegmentedProgress (ENG-895)", () => {
  it("renders one segment per step and fills completed segments", () => {
    render(<OnboardingSegmentedProgress value={3} total={12} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "12");
    const filled = bar.querySelectorAll('[data-filled="true"]');
    const empty = bar.querySelectorAll('[data-filled="false"]');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(9);
  });
});
