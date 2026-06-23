/**
 * `useCsvImportFlow` — the shared two-phase (preview → confirm) state
 * machine behind the MFP-refugee CSV import card on BOTH platforms.
 *
 * Why a shared headless hook (ENG-1234):
 *   - Web (`src/app/components/imports/MfpCsvImportCard.tsx`) and mobile
 *     (`apps/mobile/components/imports/MfpCsvImportCard.tsx`) must drive
 *     the EXACT same flow — upload to preview, show the parsed sample,
 *     confirm, then commit — or the MFP-refugee trust moment diverges
 *     across platforms. Keeping the state machine + analytics here means
 *     the two cards are pure rendering, and the mobile card stays under
 *     its line-budget pin instead of duplicating ~120 lines of flow.
 *   - It is platform-agnostic on purpose: NO `next`, NO DOM, NO
 *     react-native. It depends on `react` only. Each card injects its own
 *     `track` fn, its own `AnalyticsEvents.*` strings (web imports them
 *     via `@/lib/analytics/events`, mobile via
 *     `@suppr/shared/analytics/events` — same literals, different import
 *     path), and an `uploader` that knows how to build the right
 *     multipart body and call the right base URL. This avoids the `@/`
 *     alias resolving to different roots on the two platforms.
 *
 * Flow:
 *   idle
 *     ── startPreview(fileName, uploader) ──▶ previewing
 *          ├─ ok   ──▶ preview   (source, total, unmatched, truncated, sample)
 *          └─ fail ──▶ error
 *   preview
 *     ── confirm() ──▶ preview{committing:true}  (sample stays on screen)
 *          ├─ ok   ──▶ success  (imported, unmatched, truncated)
 *          └─ fail ──▶ error
 *     ── reset() ───▶ idle
 *
 * The `uploader` is stored from `startPreview` and reused by `confirm()`,
 * so the same picked file is re-sent for the commit round-trip. The
 * server re-parses on commit — the client never hands macros to insert.
 */
import { useCallback, useRef, useState } from "react";

/** One parsed-but-not-yet-committed row, as the route's preview returns it. */
export type CsvSampleRow = {
  date: string;
  meal: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

/** Shape of the route's JSON for either mode (loosely typed — the hook
 *  only reads the fields it needs and tolerates extras). */
type CsvImportJson = {
  ok?: boolean;
  error?: string;
  message?: string;
  source?: string;
  total?: number;
  imported?: number;
  unmatched?: number;
  truncated?: boolean;
  sample?: CsvSampleRow[];
};

/** What an injected uploader resolves to. `httpOk` mirrors `res.ok`;
 *  `status` is the HTTP status (0 for a network/client error). */
export type CsvUploadResult = {
  httpOk: boolean;
  status: number;
  json: CsvImportJson;
};

/** `(mode) => upload the in-flight file and resolve the parsed result`. */
export type CsvUploader = (mode: "preview" | "commit") => Promise<CsvUploadResult>;

export type CsvImportFlowState =
  | { kind: "idle" }
  | { kind: "previewing"; fileName: string }
  | {
      kind: "preview";
      fileName: string;
      source: string;
      /** Rows that WILL import (have calories). */
      total: number;
      /** Rows skipped (missing calories). */
      unmatched: number;
      /** Input had more than the row cap. */
      truncated: boolean;
      sample: CsvSampleRow[];
      /** True once `confirm()` is in flight — the sample stays on screen
       *  with a busy CTA rather than blanking to a spinner. */
      committing: boolean;
    }
  | { kind: "success"; imported: number; unmatched: number; truncated: boolean }
  | { kind: "error"; message: string };

export type CsvImportFlowEvents = {
  started: string;
  previewed: string;
  completed: string;
  failed: string;
};

export type UseCsvImportFlowOptions = {
  surface: "onboarding" | "settings";
  platform: "web" | "ios";
  track: (event: string, props: Record<string, unknown>) => void;
  events: CsvImportFlowEvents;
};

/** Default copy for the failure state, by HTTP status, so both cards read
 *  identically. The route's own `message` (when present) always wins. */
function fallbackErrorMessage(status: number): string {
  if (status === 429) return "Too many imports today. Try again tomorrow.";
  if (status === 413) return "File is too large. Split your export and try again.";
  if (status === 401) return "Sign in to import your history.";
  return "Import failed. Try again or pick a different file.";
}

export function useCsvImportFlow({
  surface,
  platform,
  track,
  events,
}: UseCsvImportFlowOptions) {
  const [state, setState] = useState<CsvImportFlowState>({ kind: "idle" });
  // The uploader + filename captured at preview time, reused by confirm().
  const uploaderRef = useRef<CsvUploader | null>(null);
  const fileNameRef = useRef<string>("");

  const fail = useCallback(
    (
      result: { status: number; json: CsvImportJson } | { status: number; message: string },
      phase: "preview" | "commit",
    ) => {
      const message =
        "message" in result
          ? result.message
          : result.json.message || fallbackErrorMessage(result.status);
      const errorCode =
        "json" in result ? result.json.error ?? "unknown" : "fetch_failed";
      setState({ kind: "error", message });
      track(events.failed, {
        error: errorCode,
        status: result.status,
        phase,
        surface,
        platform,
      });
    },
    [events.failed, platform, surface, track],
  );

  /** Phase 1 — upload the picked file to preview (no DB write). */
  const startPreview = useCallback(
    async (fileName: string, uploader: CsvUploader) => {
      uploaderRef.current = uploader;
      fileNameRef.current = fileName;
      track(events.started, { surface, platform });
      setState({ kind: "previewing", fileName });
      try {
        const { httpOk, status, json } = await uploader("preview");
        if (!httpOk || !json.ok) {
          fail({ status, json }, "preview");
          return;
        }
        setState({
          kind: "preview",
          fileName,
          source: json.source ?? "unknown",
          total: json.total ?? 0,
          unmatched: json.unmatched ?? 0,
          truncated: json.truncated ?? false,
          sample: json.sample ?? [],
          committing: false,
        });
        track(events.previewed, {
          total: json.total ?? 0,
          unmatched: json.unmatched ?? 0,
          truncated: json.truncated ?? false,
          source: json.source ?? "unknown",
          surface,
          platform,
        });
      } catch {
        fail({ status: 0, message: "Import failed." }, "preview");
      }
    },
    [events.previewed, events.started, fail, platform, surface, track],
  );

  /** Phase 2 — commit the previewed file (insert). */
  const confirm = useCallback(async () => {
    const uploader = uploaderRef.current;
    if (!uploader) return;
    // Keep the sample on screen; just flip the CTA to a busy state.
    setState((s) => (s.kind === "preview" ? { ...s, committing: true } : s));
    try {
      const { httpOk, status, json } = await uploader("commit");
      if (!httpOk || !json.ok) {
        fail({ status, json }, "commit");
        return;
      }
      const imported = json.imported ?? 0;
      const unmatched = json.unmatched ?? 0;
      const truncated = json.truncated ?? false;
      setState({ kind: "success", imported, unmatched, truncated });
      track(events.completed, {
        imported,
        unmatched,
        truncated,
        surface,
        platform,
      });
    } catch {
      fail({ status: 0, message: "Import failed." }, "commit");
    }
  }, [events.completed, fail, platform, surface, track]);

  /** Back to idle (cancel a preview, or after success/error to re-pick). */
  const reset = useCallback(() => {
    uploaderRef.current = null;
    fileNameRef.current = "";
    setState({ kind: "idle" });
  }, []);

  return { state, startPreview, confirm, reset };
}
