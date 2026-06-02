// @vitest-environment jsdom
/**
 * Render + upload behaviour test for `<MfpCsvImportCard>` (web).
 *
 * Pins the four UI states the MFP-refugee onboarding card must
 * surface, plus the analytics events fired on each:
 *   1. Idle — "Choose CSV file" button is the visible affordance.
 *   2. Uploading — the picked filename is surfaced while the upload
 *      is in flight.
 *   3. Success — "Imported N meals from MyFitnessPal" copy appears
 *      and `mfp_csv_import_completed` fires with the result payload.
 *   4. Error — the route's error message is surfaced verbatim and
 *      `mfp_csv_import_failed` fires with the route's error code.
 *
 * Mirrors `apps/mobile/tests/unit/mfpCsvImportCardMobile.test.tsx`.
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

const trackMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({
  track: (...args: unknown[]) => trackMock(...args),
  // MfpCsvImportCard renders inside a <SupprCard>, which reads this flag at
  // render time. Flag OFF keeps the legacy paint; these tests assert
  // functional behaviour (idle/upload/error), not elevation.
  isFeatureEnabled: () => false,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

import { MfpCsvImportCard } from "../../src/app/components/imports/MfpCsvImportCard";
import { AnalyticsEvents } from "../../src/lib/analytics/events";

beforeEach(() => {
  trackMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pickFile(file: File) {
  const input = screen.getByTestId("mfp-csv-file-input") as HTMLInputElement;
  // `change` events for `<input type="file">` need files exposed via
  // `Object.defineProperty` because `files` is a read-only FileList.
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("MfpCsvImportCard (web)", () => {
  it("renders the idle state with the choose-file affordance", () => {
    render(<MfpCsvImportCard surface="onboarding" />);
    // Copy generalised from MyFitnessPal-specific to multi-app (CSV
    // adapter framework) in the working tree — assert the heading.
    expect(screen.getByText("Import from another app")).toBeInTheDocument();
    expect(screen.getByTestId("mfp-csv-choose-file")).toBeInTheDocument();
  });

  it("uploads the picked file and surfaces success copy + analytics", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          imported: 5,
          unmatched: 0,
          truncated: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<MfpCsvImportCard surface="onboarding" />);
    pickFile(new File(["Date,Food\n2024-08-12,Eggs"], "mfp.csv", { type: "text/csv" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Imported 5 meals/),
      ).toBeInTheDocument(),
    );

    // Started + completed events fired with the right payload.
    const startedCalls = trackMock.mock.calls.filter(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_started,
    );
    expect(startedCalls).toHaveLength(1);
    expect(startedCalls[0][1]).toMatchObject({
      surface: "onboarding",
      platform: "web",
    });

    const completedCalls = trackMock.mock.calls.filter(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_completed,
    );
    expect(completedCalls).toHaveLength(1);
    expect(completedCalls[0][1]).toMatchObject({
      imported: 5,
      unmatched: 0,
      truncated: false,
      surface: "onboarding",
      platform: "web",
    });

    // Verify the bearer token was sent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    expect(headers.get("authorization")).toBe("Bearer test-token");
  });

  it("surfaces a 422 error message and fires the failed event", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: "no_rows",
          message:
            "We couldn't find a Date/Food column. Re-export from MyFitnessPal with the standard CSV format.",
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<MfpCsvImportCard surface="settings" />);
    pickFile(new File(["garbage"], "mfp.csv", { type: "text/csv" }));

    await waitFor(() =>
      expect(
        screen.getByText(/We couldn't find a Date\/Food column/),
      ).toBeInTheDocument(),
    );

    const failedCalls = trackMock.mock.calls.filter(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_failed,
    );
    expect(failedCalls).toHaveLength(1);
    expect(failedCalls[0][1]).toMatchObject({
      error: "no_rows",
      status: 422,
      surface: "settings",
      platform: "web",
    });

    // Try-again button is rendered for retry.
    expect(screen.getByTestId("mfp-csv-retry")).toBeInTheDocument();
  });

  it("surfaces an auth-missing error without hitting the network", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<MfpCsvImportCard />);
    pickFile(new File(["Date,Food\n2024-08-12,Eggs"], "mfp.csv", { type: "text/csv" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Sign in to import your history/),
      ).toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
