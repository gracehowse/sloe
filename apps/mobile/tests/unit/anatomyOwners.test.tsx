// @vitest-environment jsdom
/**
 * ENG-1662 — anatomy owner primitives (mobile).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Bell } from "lucide-react-native";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
  isFeatureDisabled: vi.fn(() => false),
}));

import { CountBadge, formatCountBadge } from "../../components/ui/CountBadge";
import { IconButton } from "../../components/ui/IconButton";
import { SupprNotice } from "../../components/ui/SupprNotice";
import { SupprRadio } from "../../components/ui/SupprRadio";
import { SheetGrabberBar } from "../../components/ui/SheetShell";
import { CHIP_HEIGHT } from "../../components/ui/chipGeometry";
import { IconButtonSize, SheetGrabber, StepperCircleSize } from "@/constants/theme";

void React;

describe("anatomy owner tokens (ENG-1662)", () => {
  it("IconButtonSize matches census 28/36/40", () => {
    expect(IconButtonSize.sm).toBe(28);
    expect(IconButtonSize.md).toBe(36);
    expect(IconButtonSize.lg).toBe(40);
  });

  it("SheetGrabber is 36×4", () => {
    expect(SheetGrabber.width).toBe(36);
    expect(SheetGrabber.height).toBe(4);
  });

  it("StepperCircleSize is sm/md/lg 32/40/44", () => {
    expect(StepperCircleSize.sm).toBe(32);
    expect(StepperCircleSize.md).toBe(40);
    expect(StepperCircleSize.lg).toBe(44);
  });
});

describe("CountBadge", () => {
  it("caps at 999+", () => {
    expect(formatCountBadge(1000)).toBe("999+");
  });

  it("renders active + inactive without throwing", () => {
    const { getByText, rerender } = render(<CountBadge count={3} active />);
    expect(getByText("3")).toBeTruthy();
    rerender(<CountBadge count={3} active={false} />);
    expect(getByText("3")).toBeTruthy();
  });

  it("returns null at 0", () => {
    const { toJSON } = render(<CountBadge count={0} />);
    expect(toJSON()).toBeNull();
  });
});

describe("IconButton", () => {
  it("renders with required a11y label", () => {
    const { getByLabelText } = render(
      <IconButton icon={Bell} onPress={() => {}} accessibilityLabel="Notifications" testID="bell" />,
    );
    expect(getByLabelText("Notifications")).toBeTruthy();
  });
});

describe("SupprNotice", () => {
  it("renders block + pill variants", () => {
    const { getByText } = render(
      <>
        <SupprNotice tone="primary" variant="block" testID="block">
          <Text>Block notice</Text>
        </SupprNotice>
        <SupprNotice tone="offline" variant="pill">
          <Text>Offline</Text>
        </SupprNotice>
      </>,
    );
    expect(getByText("Block notice")).toBeTruthy();
    expect(getByText("Offline")).toBeTruthy();
  });
});

describe("SupprRadio", () => {
  it("renders checked and unchecked", () => {
    const { rerender, getByTestId } = render(<SupprRadio checked={false} testID="radio" />);
    expect(getByTestId("radio")).toBeTruthy();
    rerender(<SupprRadio checked testID="radio" />);
    expect(getByTestId("radio")).toBeTruthy();
  });
});

describe("SheetGrabberBar", () => {
  it("renders the canonical grabber", () => {
    const { getByTestId } = render(<SheetGrabberBar />);
    expect(getByTestId("sheet-grabber")).toBeTruthy();
  });
});

describe("chip geometry", () => {
  it("unifies trio height at 22pt", () => {
    expect(CHIP_HEIGHT).toBe(22);
  });
});
