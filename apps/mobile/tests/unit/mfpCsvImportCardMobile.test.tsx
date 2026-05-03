// @vitest-environment jsdom
/**
 * Render + upload behaviour test for `<MobileMfpCsvImportCard>`.
 *
 * Pins the same four UI states the web counterpart locks
 * (idle / uploading / success / error) plus the same analytics
 * payloads, with two mobile-specific contracts:
 *
 *   - The picker invocation path uses `expo-document-picker.getDocumentAsync`.
 *     Cancelled picks are no-ops; an asset triggers an upload via
 *     `authedFetch` to `${getSupprApiBase()}/api/imports/mfp-csv`.
 *   - Multipart payload uses the React Native `{ uri, name, type }`
 *     file shape (RN's FormData accepts this in lieu of the web `Blob`
 *     flavour).
 *
 * Mirrors `tests/unit/mfpCsvImportCardWeb.test.tsx`.
 */
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

void React;

// Theme colours stub.
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

// Hoisted spies — `vi.mock` factories are evaluated before top-level
// `const` initialisers, so plain module-scope spies are unreachable.
const { authedFetchMock, documentPickerMock, trackMock } = vi.hoisted(() => ({
  authedFetchMock: vi.fn(),
  documentPickerMock: vi.fn(),
  trackMock: vi.fn(),
}));

vi.mock("@/lib/authedFetch", () => ({
  authedFetch: (...args: unknown[]) => authedFetchMock(...args),
}));

vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => "https://suppr-club.com",
  getSupprWebBase: () => "https://suppr-club.com",
}));

vi.mock("@/lib/analytics", () => ({
  track: trackMock,
}));

vi.mock("expo-document-picker", () => ({
  __esModule: true,
  default: { getDocumentAsync: (...a: unknown[]) => documentPickerMock(...a) },
  getDocumentAsync: (...a: unknown[]) => documentPickerMock(...a),
}));

import { MobileMfpCsvImportCard } from "../../components/imports/MfpCsvImportCard";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";

beforeEach(() => {
  authedFetchMock.mockReset();
  documentPickerMock.mockReset();
  trackMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MobileMfpCsvImportCard", () => {
  it("renders the idle state with the choose-file affordance", () => {
    render(<MobileMfpCsvImportCard surface="onboarding" />);
    expect(screen.getByText("Import from MyFitnessPal")).toBeTruthy();
    expect(screen.getByTestId("mfp-csv-choose-file")).toBeTruthy();
  });

  it("uploads a picked asset and surfaces success copy + analytics", async () => {
    documentPickerMock.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///mock/mfp.csv",
          name: "mfp.csv",
          mimeType: "text/csv",
        },
      ],
    });
    authedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        imported: 7,
        unmatched: 0,
        truncated: false,
      }),
    });

    render(<MobileMfpCsvImportCard surface="onboarding" />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    await waitFor(() =>
      expect(
        screen.getByText(/Imported 7 meals from MyFitnessPal/),
      ).toBeTruthy(),
    );

    // Verify the upload fired with the right URL + method.
    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = authedFetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://suppr-club.com/api/imports/mfp-csv");
    expect(init.method).toBe("POST");

    // Started + completed events both fired with platform: "ios".
    const trackCalls = trackMock.mock.calls;
    const started = trackCalls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_started,
    );
    expect(started?.[1]).toMatchObject({
      surface: "onboarding",
      platform: "ios",
    });
    const completed = trackCalls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_completed,
    );
    expect(completed?.[1]).toMatchObject({
      imported: 7,
      unmatched: 0,
      truncated: false,
      surface: "onboarding",
      platform: "ios",
    });
  });

  it("surfaces a 429 rate-limit message and fires the failed event", async () => {
    documentPickerMock.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///mock/mfp.csv",
          name: "mfp.csv",
          mimeType: "text/csv",
        },
      ],
    });
    authedFetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        error: "rate_limited",
        message: "MFP imports are limited to 5 per day. Try again tomorrow.",
      }),
    });

    render(<MobileMfpCsvImportCard surface="settings" />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    await waitFor(() =>
      expect(
        screen.getByText(/MFP imports are limited to 5 per day/),
      ).toBeTruthy(),
    );

    const trackCalls = trackMock.mock.calls;
    const failed = trackCalls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_failed,
    );
    expect(failed?.[1]).toMatchObject({
      error: "rate_limited",
      status: 429,
      surface: "settings",
      platform: "ios",
    });

    // Try-again affordance rendered.
    expect(screen.getByTestId("mfp-csv-retry")).toBeTruthy();
  });

  it("does nothing when the user cancels the picker", async () => {
    documentPickerMock.mockResolvedValue({ canceled: true, assets: null });

    render(<MobileMfpCsvImportCard />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    // Wait a microtask so the dynamic import + handler resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(authedFetchMock).not.toHaveBeenCalled();
    // No started event either — the picker cancel happens before
    // the upload kicks off.
    const trackCalls = trackMock.mock.calls;
    expect(
      trackCalls.find((c) => c[0] === AnalyticsEvents.mfp_csv_import_started),
    ).toBeUndefined();
  });
});
