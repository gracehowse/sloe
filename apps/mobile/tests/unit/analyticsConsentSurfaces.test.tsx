// @vitest-environment jsdom
/**
 * ENG-1286 — the two mobile consent surfaces (launch blocker):
 *
 *  1. `AnalyticsConsentPrompt` — the first-open ask (tabs shell,
 *     mirror of the web CookieConsent strip): renders ONLY while the
 *     stored choice is unset, Accept/Decline persist the choice and
 *     dismiss, both buttons carry equal prominence (side-by-side,
 *     same size).
 *  2. `AnalyticsConsentRow` — the Settings "Usage analytics & replay"
 *     toggle: reflects the stored choice live and writes flips
 *     through the same `setAnalyticsConsent` path the prompt uses.
 *
 * Both import the REAL `lib/analyticsConsent` (pure module — no
 * posthog-react-native), so these tests exercise the real storage +
 * pub/sub logic through the in-memory AsyncStorage shim.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

vi.mock("@/lib/supprWeb", () => ({ getSupprWebBase: () => "https://getsloe.com" }));
const PALETTE = {
  background: "#FFFFFF",
  card: "#F6F5F2",
  cardBorder: "#E8E5E0",
  border: "#E8E5E0",
  inputBg: "#EFEDE8",
  text: "#221B26",
  textSecondary: "#6B6470",
  textTertiary: "#9B93A3",
};
vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primary: "#5B3B6E",
    primaryLight: "#7B5B8E",
    primarySolid: "#4A2B5E",
    primaryForeground: "#FFFFFF",
    success: "#5E7C5A",
  }),
  // `useThemeColors` reads `useTheme().colors` under the hood.
  useTheme: () => ({ colors: PALETTE }),
}));

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  __resetAnalyticsConsentForTests,
  getAnalyticsConsent,
  primeAnalyticsConsent,
} from "@/lib/analyticsConsent";
import { AnalyticsConsentPrompt } from "../../components/consent/AnalyticsConsentPrompt";
import { AnalyticsConsentRow } from "../../components/settings/AnalyticsConsentRow";

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetAnalyticsConsentForTests();
});
afterEach(async () => {
  await AsyncStorage.clear();
  __resetAnalyticsConsentForTests();
});

describe("AnalyticsConsentPrompt (first-open ask)", () => {
  it("renders the ask when consent is unset, with equal-prominence Allow / No thanks", async () => {
    const { findByTestId, getByText } = render(<AnalyticsConsentPrompt />);
    await findByTestId("analytics-consent-prompt");
    expect(getByText("Help improve Sloe")).toBeTruthy();
    expect(
      getByText(
        /Anonymous usage analytics and masked session replay\. You can change this anytime in Settings\./,
      ),
    ).toBeTruthy();
    // Equal prominence: both choices present as side-by-side buttons.
    expect(getByText("Allow")).toBeTruthy();
    expect(getByText("No thanks")).toBeTruthy();
  });

  it("Allow persists 'accepted' and dismisses", async () => {
    const { findByTestId, queryByTestId } = render(<AnalyticsConsentPrompt />);
    fireEvent.press(await findByTestId("analytics-consent-accept"));
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
        "accepted",
      );
    });
    expect(getAnalyticsConsent()).toBe("accepted");
    await waitFor(() => {
      expect(queryByTestId("analytics-consent-prompt")).toBeNull();
    });
  });

  it("No thanks persists 'declined' and dismisses", async () => {
    const { findByTestId, queryByTestId } = render(<AnalyticsConsentPrompt />);
    fireEvent.press(await findByTestId("analytics-consent-decline"));
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
        "declined",
      );
    });
    expect(getAnalyticsConsent()).toBe("declined");
    await waitFor(() => {
      expect(queryByTestId("analytics-consent-prompt")).toBeNull();
    });
  });

  it("renders nothing when a choice is already stored (never re-asks)", async () => {
    await AsyncStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "declined");
    await primeAnalyticsConsent();
    const { queryByTestId } = render(<AnalyticsConsentPrompt />);
    // Give the hydration tick a chance to run, then assert it stayed hidden.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(queryByTestId("analytics-consent-prompt")).toBeNull();
  });

  it("hydrates from storage even when the module wasn't primed (no flash-then-dismiss)", async () => {
    await AsyncStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "accepted");
    // NOT primed — simulates a mount racing the provider's prime.
    const { queryByTestId } = render(<AnalyticsConsentPrompt />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(queryByTestId("analytics-consent-prompt")).toBeNull();
  });
});

describe("AnalyticsConsentRow (Settings toggle)", () => {
  it("reflects a stored 'accepted' as ON", async () => {
    await AsyncStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "accepted");
    await primeAnalyticsConsent();
    const { getByTestId, getByText } = render(<AnalyticsConsentRow />);
    expect(getByText("Usage analytics & replay")).toBeTruthy();
    await waitFor(() => {
      expect(
        getByTestId("settings-analytics-consent-toggle").props.value,
      ).toBe(true);
    });
  });

  it("is OFF when consent is unset or declined", async () => {
    const { getByTestId } = render(<AnalyticsConsentRow />);
    expect(getByTestId("settings-analytics-consent-toggle").props.value).toBe(
      false,
    );
  });

  it("toggling ON persists 'accepted'; toggling OFF persists 'declined'", async () => {
    const { getByTestId } = render(<AnalyticsConsentRow />);
    const toggle = getByTestId("settings-analytics-consent-toggle");
    fireEvent(toggle, "valueChange", true);
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
        "accepted",
      );
    });
    fireEvent(toggle, "valueChange", false);
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
        "declined",
      );
    });
  });

  it("stays in sync with the prompt across instances (same stored state)", async () => {
    const row = render(<AnalyticsConsentRow />);
    const prompt = render(<AnalyticsConsentPrompt />);
    fireEvent.press(await prompt.findByTestId("analytics-consent-accept"));
    await waitFor(() => {
      expect(
        row.getByTestId("settings-analytics-consent-toggle").props.value,
      ).toBe(true);
    });
  });
});
