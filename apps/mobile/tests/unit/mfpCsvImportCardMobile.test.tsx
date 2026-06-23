// @vitest-environment jsdom
/**
 * Render + upload behaviour test for `<MobileMfpCsvImportCard>`.
 *
 * Pins the two-phase (preview → confirm) MFP-refugee import (ENG-1234),
 * matching the web counterpart, with two mobile-specific contracts:
 *
 *   - The picker invocation path uses `expo-document-picker.getDocumentAsync`.
 *     Cancelled picks are no-ops; an asset triggers a preview upload via
 *     `authedFetch` to `${getSupprApiBase()}/api/imports/mfp-csv?mode=preview`,
 *     and confirming uploads the same asset to `?mode=commit`.
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

import { MobileMfpCsvImportCard } from "../../components/imports/MfpCsvImportCard";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

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

const CSV_ASSET = {
  canceled: false,
  assets: [{ uri: "file:///mock/mfp.csv", name: "mfp.csv", mimeType: "text/csv" }],
};

const SAMPLE = [
  { date: "2024-08-12", meal: "breakfast", name: "Oats", calories: 420, protein: 14, carbs: 68, fat: 10 },
  { date: "2024-08-12", meal: "lunch", name: "Salad", calories: 540, protein: 52, carbs: 42, fat: 18 },
];

/** authedFetch stub that branches on the `?mode=` query. */
function mockUpload(
  preview: { ok: boolean; status: number; body: unknown },
  commit?: { ok: boolean; status: number; body: unknown },
) {
  authedFetchMock.mockImplementation(async (url: string) => {
    const cfg = String(url).includes("mode=commit") ? commit! : preview;
    return { ok: cfg.ok, status: cfg.status, json: async () => cfg.body };
  });
}

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
    expect(screen.getByText("Import from another app")).toBeTruthy();
    expect(screen.getByTestId("mfp-csv-choose-file")).toBeTruthy();
  });

  it("previews the parsed sample, then commits on confirm (with analytics)", async () => {
    documentPickerMock.mockResolvedValue(CSV_ASSET);
    mockUpload(
      {
        ok: true,
        status: 200,
        body: {
          ok: true,
          mode: "preview",
          source: "mfp",
          total: 7,
          unmatched: 0,
          truncated: false,
          sample: SAMPLE,
        },
      },
      {
        ok: true,
        status: 200,
        body: { ok: true, mode: "commit", imported: 7, unmatched: 0, truncated: false },
      },
    );

    render(<MobileMfpCsvImportCard surface="onboarding" />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    // Preview surfaces the sample before any commit.
    await waitFor(() => expect(screen.getByTestId("mfp-csv-preview")).toBeTruthy());
    expect(screen.getByText("Oats")).toBeTruthy();
    expect(screen.getByText("Salad")).toBeTruthy();

    const started = trackMock.mock.calls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_started,
    );
    expect(started?.[1]).toMatchObject({ surface: "onboarding", platform: "ios" });
    const previewed = trackMock.mock.calls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_previewed,
    );
    expect(previewed?.[1]).toMatchObject({ total: 7, source: "mfp", platform: "ios" });

    // Confirm → commit.
    fireEvent.press(screen.getByTestId("mfp-csv-confirm-import"));
    await waitFor(() => expect(screen.getByText(/Imported 7 meals/)).toBeTruthy());

    const completed = trackMock.mock.calls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_completed,
    );
    expect(completed?.[1]).toMatchObject({
      imported: 7,
      unmatched: 0,
      truncated: false,
      surface: "onboarding",
      platform: "ios",
    });

    // Two round-trips: preview then commit.
    expect(authedFetchMock).toHaveBeenCalledTimes(2);
    expect(String(authedFetchMock.mock.calls[0][0])).toContain("mode=preview");
    expect(String(authedFetchMock.mock.calls[1][0])).toContain("mode=commit");
    const [, init] = authedFetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  it("surfaces a preview parse error and fires the failed event", async () => {
    documentPickerMock.mockResolvedValue(CSV_ASSET);
    mockUpload({
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: "no_rows",
        message: "We couldn't find a Date/Food column in this CSV.",
      },
    });

    render(<MobileMfpCsvImportCard surface="settings" />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    await waitFor(() =>
      expect(screen.getByText(/We couldn't find a Date\/Food column/)).toBeTruthy(),
    );

    const failed = trackMock.mock.calls.find(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_failed,
    );
    expect(failed?.[1]).toMatchObject({
      error: "no_rows",
      status: 422,
      phase: "preview",
      surface: "settings",
      platform: "ios",
    });

    // Never reached commit.
    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    expect(String(authedFetchMock.mock.calls[0][0])).toContain("mode=preview");
    expect(screen.getByTestId("mfp-csv-retry")).toBeTruthy();
  });

  it("does nothing when the user cancels the picker", async () => {
    documentPickerMock.mockResolvedValue({ canceled: true, assets: null });

    render(<MobileMfpCsvImportCard />);
    fireEvent.press(screen.getByTestId("mfp-csv-choose-file"));

    await Promise.resolve();
    await Promise.resolve();

    expect(authedFetchMock).not.toHaveBeenCalled();
    expect(
      trackMock.mock.calls.find(
        (c) => c[0] === AnalyticsEvents.mfp_csv_import_started,
      ),
    ).toBeUndefined();
  });
});
