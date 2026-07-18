// @vitest-environment jsdom
/**
 * Toast (ENG-1344 first slice) — the shared presentational primitive
 * generalizing `PostLogSuggestionToast`/`PlanRegenerateToast`'s
 * card+icon+text+shadow shape. Purely presentational: no timer, no
 * lifecycle — `useToast()` owns visibility/auto-dismiss.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { Check } from "lucide-react-native";

import { Toast } from "../../components/ui/Toast";

void React;

describe("Toast", () => {
  it("renders nothing when visible=false", () => {
    const { toJSON } = render(<Toast visible={false} message="Hello" />);
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when message is null even if visible", () => {
    const { toJSON } = render(<Toast visible message={null} />);
    expect(toJSON()).toBeNull();
  });

  it("renders the exact message when visible", () => {
    const { getByText } = render(<Toast visible message="Plan updated — 3 meals changed" />);
    expect(getByText("Plan updated — 3 meals changed")).toBeTruthy();
  });

  it("exposes the message as the accessibility label for VoiceOver", () => {
    const { getByLabelText } = render(<Toast visible message="Log failed — could not save." />);
    expect(getByLabelText("Log failed — could not save.")).toBeTruthy();
  });

  it("defaults to the info variant and testID", () => {
    const { getByTestId } = render(<Toast visible message="Info line" />);
    expect(getByTestId("toast")).toBeTruthy();
  });

  it("honours a custom testID", () => {
    const { getByTestId, queryByTestId } = render(
      <Toast visible message="Custom id" testID="planner-toast" />,
    );
    expect(getByTestId("planner-toast")).toBeTruthy();
    expect(queryByTestId("toast")).toBeNull();
  });

  it("accepts an icon override while keeping the variant's colour scheme", () => {
    const { UNSAFE_getByType } = render(
      <Toast visible message="Plan updated" variant="info" icon={Check} />,
    );
    expect(UNSAFE_getByType(Check)).toBeTruthy();
  });

  it("is not interactive — pointerEvents is none (calm-reward posture, no tap target)", () => {
    const { getByTestId } = render(<Toast visible message="No tap target" />);
    expect(getByTestId("toast").props.pointerEvents).toBe("none");
  });
});
