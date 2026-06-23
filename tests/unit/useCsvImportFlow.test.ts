// @vitest-environment jsdom
/**
 * Unit tests for `useCsvImportFlow` — the shared two-phase (preview →
 * confirm) state machine behind the MFP-refugee CSV import card on both
 * platforms (ENG-1234). Drives the hook directly so the state transitions
 * + analytics are pinned independently of either platform's rendering.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  useCsvImportFlow,
  type CsvUploadResult,
} from "../../src/lib/imports/useCsvImportFlow";

const EVENTS = {
  started: "started",
  previewed: "previewed",
  completed: "completed",
  failed: "failed",
};

function setup(track = vi.fn()) {
  const { result } = renderHook(() =>
    useCsvImportFlow({
      surface: "onboarding",
      platform: "web",
      track,
      events: EVENTS,
    }),
  );
  return { result, track };
}

const PREVIEW_OK: CsvUploadResult = {
  httpOk: true,
  status: 200,
  json: {
    ok: true,
    mode: "preview",
    source: "mfp",
    total: 5,
    unmatched: 1,
    truncated: false,
    sample: [
      { date: "2024-08-12", meal: "breakfast", name: "Oats", calories: 420, protein: 14, carbs: 68, fat: 10 },
    ],
  },
};

const COMMIT_OK: CsvUploadResult = {
  httpOk: true,
  status: 200,
  json: { ok: true, mode: "commit", imported: 5, unmatched: 1, truncated: false },
};

describe("useCsvImportFlow", () => {
  it("runs preview → confirm → success and fires the funnel events", async () => {
    const { result, track } = setup();
    const uploader = vi.fn(async (mode: "preview" | "commit") =>
      mode === "preview" ? PREVIEW_OK : COMMIT_OK,
    );

    await act(async () => {
      await result.current.startPreview("mfp.csv", uploader);
    });

    expect(result.current.state.kind).toBe("preview");
    if (result.current.state.kind === "preview") {
      expect(result.current.state.total).toBe(5);
      expect(result.current.state.unmatched).toBe(1);
      expect(result.current.state.sample).toHaveLength(1);
      expect(result.current.state.committing).toBe(false);
    }
    expect(track).toHaveBeenCalledWith("started", expect.objectContaining({ platform: "web" }));
    expect(track).toHaveBeenCalledWith(
      "previewed",
      expect.objectContaining({ total: 5, source: "mfp" }),
    );

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.state.kind).toBe("success");
    if (result.current.state.kind === "success") {
      expect(result.current.state.imported).toBe(5);
    }
    expect(track).toHaveBeenCalledWith(
      "completed",
      expect.objectContaining({ imported: 5, unmatched: 1 }),
    );
    expect(uploader).toHaveBeenCalledTimes(2);
  });

  it("surfaces a preview failure as an error (phase: preview)", async () => {
    const { result, track } = setup();
    const uploader = vi.fn(async (): Promise<CsvUploadResult> => ({
      httpOk: false,
      status: 422,
      json: { ok: false, error: "no_rows", message: "No usable rows." },
    }));

    await act(async () => {
      await result.current.startPreview("mfp.csv", uploader);
    });

    expect(result.current.state).toMatchObject({
      kind: "error",
      message: "No usable rows.",
    });
    expect(track).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({ error: "no_rows", status: 422, phase: "preview" }),
    );
  });

  it("surfaces a commit failure as an error (phase: commit)", async () => {
    const { result, track } = setup();
    const uploader = vi.fn(async (mode: "preview" | "commit"): Promise<CsvUploadResult> =>
      mode === "preview"
        ? PREVIEW_OK
        : {
            httpOk: false,
            status: 429,
            json: { ok: false, error: "rate_limited", message: "Too many." },
          },
    );

    await act(async () => {
      await result.current.startPreview("mfp.csv", uploader);
    });
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.state).toMatchObject({
      kind: "error",
      message: "Too many.",
    });
    expect(track).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({ error: "rate_limited", status: 429, phase: "commit" }),
    );
  });

  it("treats a thrown uploader as a generic error", async () => {
    const { result } = setup();
    const uploader = vi.fn(async () => {
      throw new Error("network down");
    });

    await act(async () => {
      await result.current.startPreview("mfp.csv", uploader);
    });

    expect(result.current.state.kind).toBe("error");
  });

  it("reset() returns to idle and drops the stored uploader", async () => {
    const { result } = setup();
    const uploader = vi.fn(async () => PREVIEW_OK);

    await act(async () => {
      await result.current.startPreview("mfp.csv", uploader);
    });
    expect(result.current.state.kind).toBe("preview");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state.kind).toBe("idle");

    // confirm() after reset is a no-op (uploader was cleared).
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.state.kind).toBe("idle");
  });

  void waitFor;
});
