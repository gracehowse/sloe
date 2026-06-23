// @vitest-environment jsdom
/**
 * Render + upload behaviour test for `<MfpCsvImportCard>` (web).
 *
 * Pins the two-phase (preview → confirm) MFP-refugee import (ENG-1234):
 *   1. Idle — "Choose CSV file" button is the visible affordance.
 *   2. Preview — picking a file uploads to `?mode=preview` (no write) and
 *      the parsed sample is shown with an Import CTA; `mfp_csv_import_started`
 *      + `mfp_csv_import_previewed` fire.
 *   3. Commit — confirming uploads to `?mode=commit`; success copy appears
 *      and `mfp_csv_import_completed` fires with the result payload.
 *   4. Error — a failed preview surfaces the route's message verbatim and
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
  // functional behaviour (idle/preview/commit/error), not elevation.
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SAMPLE = [
  {
    date: "2024-08-12",
    meal: "breakfast",
    name: "Oats",
    calories: 420,
    protein: 14,
    carbs: 68,
    fat: 10,
  },
  {
    date: "2024-08-12",
    meal: "lunch",
    name: "Salad",
    calories: 540,
    protein: 52,
    carbs: 42,
    fat: 18,
  },
];

describe("MfpCsvImportCard (web)", () => {
  it("renders the idle state with the choose-file affordance", () => {
    render(<MfpCsvImportCard surface="onboarding" />);
    expect(screen.getByText("Import from another app")).toBeInTheDocument();
    expect(screen.getByTestId("mfp-csv-choose-file")).toBeInTheDocument();
  });

  it("previews the parsed sample, then commits on confirm (with analytics)", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("mode=preview")) {
        return jsonResponse({
          ok: true,
          mode: "preview",
          source: "mfp",
          total: 5,
          unmatched: 0,
          truncated: false,
          sample: SAMPLE,
        });
      }
      // commit
      return jsonResponse({
        ok: true,
        mode: "commit",
        imported: 5,
        unmatched: 0,
        truncated: false,
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<MfpCsvImportCard surface="onboarding" />);
    pickFile(new File(["Date,Food\n2024-08-12,Eggs"], "mfp.csv", { type: "text/csv" }));

    // Preview surfaces the sample BEFORE any commit.
    await waitFor(() =>
      expect(screen.getByTestId("mfp-csv-preview")).toBeInTheDocument(),
    );
    expect(screen.getByText("Oats")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();

    // started + previewed fired; NOT completed yet.
    expect(
      trackMock.mock.calls.filter(
        (c) => c[0] === AnalyticsEvents.mfp_csv_import_started,
      ),
    ).toHaveLength(1);
    const previewedCalls = trackMock.mock.calls.filter(
      (c) => c[0] === AnalyticsEvents.mfp_csv_import_previewed,
    );
    expect(previewedCalls).toHaveLength(1);
    expect(previewedCalls[0][1]).toMatchObject({
      total: 5,
      source: "mfp",
      surface: "onboarding",
      platform: "web",
    });
    expect(
      trackMock.mock.calls.filter(
        (c) => c[0] === AnalyticsEvents.mfp_csv_import_completed,
      ),
    ).toHaveLength(0);

    // Confirm → commit.
    fireEvent.click(screen.getByTestId("mfp-csv-confirm-import"));
    await waitFor(() =>
      expect(screen.getByText(/Imported 5 meals/)).toBeInTheDocument(),
    );

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

    // Two round-trips: preview then commit, both bearer-authed.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("mode=preview");
    expect(String(fetchMock.mock.calls[1][0])).toContain("mode=commit");
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    expect(headers.get("authorization")).toBe("Bearer test-token");
  });

  it("surfaces a 422 preview error and fires the failed event", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          ok: false,
          error: "no_rows",
          message:
            "We couldn't find a Date/Food column. Re-export from MyFitnessPal with the standard CSV format.",
        },
        422,
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
      phase: "preview",
      surface: "settings",
      platform: "web",
    });

    // Never reached commit — the preview failed.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("mode=preview");
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
