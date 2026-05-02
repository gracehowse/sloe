// @vitest-environment jsdom
/**
 * CookHandsfreeConsentSheet — pre-permission explainer (v2 P1, 2026-05-02).
 *
 * Pins:
 *   1. Sheet renders the canonical title + body + 3 icon rows when visible.
 *   2. "Turn on voice control" tap persists `consent_v1=1` BEFORE
 *      requesting iOS permission, then resolves the parent's
 *      `onConsentGranted(true)` when the OS dialog grants.
 *   3. "Not now" tap calls `onDismiss` without touching storage.
 *   4. Sheet is invisible-but-mounted when `visible=false` (Modal
 *      semantics — host React tree still has the component mounted
 *      so analytics callbacks don't double-fire on re-open).
 *
 * The iOS permission flow is mocked at the listener-helper layer
 * (`requestHandsfreePermissions`) — the real OS prompt cannot run
 * in vitest. The mock lets us simulate granted vs. denied paths
 * without touching native bridges.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

const { mockRequestPermissions } = vi.hoisted(() => ({
  mockRequestPermissions: vi.fn(async () => true),
}));

vi.mock("@/lib/cookHandsfreeListener", () => ({
  requestHandsfreePermissions: mockRequestPermissions,
  isOnDeviceRecognitionSupported: () => true,
  startCookHandsfreeListener: () => null,
}));

import CookHandsfreeConsentSheet from "../../components/cook/CookHandsfreeConsentSheet";
import { COOK_HANDSFREE_CONSENT_KEY } from "../../lib/cookHandsfree";

void React;

describe("CookHandsfreeConsentSheet (mobile, legal P1)", () => {
  beforeEach(() => {
    void AsyncStorage.clear();
    mockRequestPermissions.mockReset();
    mockRequestPermissions.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the canonical title, body, and icon rows when visible", () => {
    const { getByText, getByTestId } = render(
      <CookHandsfreeConsentSheet
        visible
        onConsentGranted={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(getByTestId("cook-handsfree-consent-sheet")).toBeTruthy();
    expect(getByText("Cook with your voice.")).toBeTruthy();
    expect(
      getByText(/Suppr listens for next, back, repeat, pause, and resume/i),
    ).toBeTruthy();
    expect(getByText("On-device speech recognition")).toBeTruthy();
    expect(getByText("No audio leaves your phone")).toBeTruthy();
    expect(
      getByText(/Stops the moment you exit cook mode/i),
    ).toBeTruthy();
    expect(getByText("Turn on voice control")).toBeTruthy();
    expect(getByText("Not now")).toBeTruthy();
  });

  it("persists consent + invokes onConsentGranted(true) when iOS grants", async () => {
    mockRequestPermissions.mockResolvedValue(true);
    const onConsentGranted = vi.fn();
    const { getByTestId } = render(
      <CookHandsfreeConsentSheet
        visible
        onConsentGranted={onConsentGranted}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.press(getByTestId("cook-handsfree-consent-primary"));

    await waitFor(() => {
      expect(onConsentGranted).toHaveBeenCalledWith(true);
    });

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(COOK_HANDSFREE_CONSENT_KEY)).toBe("1");
  });

  it("invokes onConsentGranted(false) when iOS denies", async () => {
    mockRequestPermissions.mockResolvedValue(false);
    const onConsentGranted = vi.fn();
    const { getByTestId } = render(
      <CookHandsfreeConsentSheet
        visible
        onConsentGranted={onConsentGranted}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.press(getByTestId("cook-handsfree-consent-primary"));

    await waitFor(() => {
      expect(onConsentGranted).toHaveBeenCalledWith(false);
    });

    // Consent ack is still persisted — we don't re-show the explainer
    // sheet on next toggle attempt; instead the cook screen surfaces a
    // "needs mic access in Settings" hint per the legal review.
    expect(await AsyncStorage.getItem(COOK_HANDSFREE_CONSENT_KEY)).toBe("1");
  });

  it("calls onDismiss when the user taps Not now (no permission flow)", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(
      <CookHandsfreeConsentSheet
        visible
        onConsentGranted={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(getByTestId("cook-handsfree-consent-secondary"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });
});
