// @vitest-environment jsdom
/**
 * ENG-1662 — anatomy owner primitives (web).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";

import { CountBadge, formatCountBadge } from "../../src/app/components/ui/count-badge";
import { IconButton } from "../../src/app/components/ui/icon-button";
import { SupprNotice } from "../../src/app/components/ui/suppr-notice";
import { SupprRadio } from "../../src/app/components/ui/suppr-radio";
import { SheetGrabberBar } from "../../src/app/components/ui/sheet-shell";
import { CHIP_HEIGHT_PX } from "../../src/app/components/ui/chip-geometry";

describe("anatomy owner primitives (web)", () => {
  it("CountBadge caps at 999+", () => {
    expect(formatCountBadge(1200)).toBe("999+");
    render(<CountBadge count={2} active />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("IconButton renders", () => {
    render(
      <IconButton icon={Bell} aria-label="Notifications" onClick={() => {}} />,
    );
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("SupprNotice renders tone + variant attrs", () => {
    render(
      <SupprNotice tone="primary" variant="block" data-testid="notice">
        Hello
      </SupprNotice>,
    );
    const node = screen.getByTestId("notice");
    expect(node).toHaveAttribute("data-tone", "primary");
    expect(node).toHaveAttribute("data-variant", "block");
  });

  it("SupprRadio reflects checked state", () => {
    render(<SupprRadio checked data-testid="radio" />);
    expect(screen.getByTestId("radio")).toHaveAttribute("data-checked", "true");
  });

  it("SheetGrabberBar renders", () => {
    render(<SheetGrabberBar data-testid="grabber" />);
    expect(screen.getByTestId("grabber")).toBeInTheDocument();
  });

  it("chip geometry height is 22px", () => {
    expect(CHIP_HEIGHT_PX).toBe(22);
  });
});
