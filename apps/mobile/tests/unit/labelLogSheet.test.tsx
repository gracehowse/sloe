import * as React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

void React;

vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  launchCameraAsync: vi.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///nutrition-label.jpg", mimeType: "image/jpeg" }],
  })),
}));

const trackMock = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primarySolid: "#3B2A4D",
    warningSoft: "rgba(201, 137, 44, 0.12)",
  }),
}));

vi.mock("@/components/ui/SupprCard", () => ({ SHEET_RADIUS: 24 }));

import LabelLogSheet from "../../components/LabelLogSheet";

const colors = {
  text: "#221B26",
  textSecondary: "#655C6E",
  card: "#FFFFFF",
  cardBorder: "#EAE7F0",
  background: "#F7F6FA",
  inputBg: "#FFFFFF",
};

describe("LabelLogSheet", () => {
  beforeEach(() => {
    trackMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          name: "Cereal bar",
          servingSizeG: 40,
          calories: 300,
          protein: 10,
          carbs: 50,
          fat: 8,
          confidence: "medium",
          implausible: false,
        }),
      })),
    );
  });

  it("captures, reviews, corrects, and commits the label values", async () => {
    const onCommit = vi.fn(async () => undefined);
    const view = render(
      <LabelLogSheet
        visible
        onClose={() => {}}
        activeSlot="Snacks"
        accessToken="token"
        apiBase="https://test.local"
        onCommit={onCommit}
        colors={colors}
      />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("label-log-capture"));
    });
    await waitFor(() => expect(view.getByText("Check the label")).toBeTruthy());
    expect(view.getByTestId("label-log-calories").props.value).toBe("120");

    fireEvent.changeText(view.getByTestId("label-log-name"), "Corrected cereal bar");
    fireEvent.changeText(view.getByTestId("label-log-calories"), "125");
    await act(async () => {
      fireEvent.press(view.getByTestId("label-log-commit"));
    });

    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Corrected cereal bar",
        servingSizeG: 40,
        calories: 125,
        protein: 4,
        carbs: 20,
        fat: 3.2,
        confidence: "medium",
      }),
    );
  });

  it("surfaces an inline error when camera permission is denied", async () => {
    const picker = await import("expo-image-picker");
    vi.mocked(picker.requestCameraPermissionsAsync).mockResolvedValueOnce({
      status: "denied",
      granted: false,
    } as never);
    const view = render(
      <LabelLogSheet
        visible
        onClose={() => {}}
        activeSlot="Snacks"
        apiBase="https://test.local"
        onCommit={() => {}}
        colors={colors}
      />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId("label-log-capture"));
    });
    expect(view.getByText(/Camera access is required/)).toBeTruthy();
  });
});
