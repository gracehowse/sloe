/**
 * Unit tests for the shared `useImportQueue` React binding (ENG —
 * "Import-progress staged state-machine + queue UX", 2026-06-08).
 *
 * The hook is the ONE place stage-change + job-action analytics are
 * emitted, so both platforms fire identical event names + payloads. These
 * tests pin that contract (the event taxonomy in `events.ts`) and the
 * derived view state (inFlight / recent / summary / hasActivity) the
 * drawers render from. An isolated scheduler is injected so the singleton
 * isn't polluted across tests.
 */
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useImportQueue } from "@/lib/recipes/useImportQueue";
import {
  RecipeImportScheduler,
  ImportRunnerError,
  type ImportRunner,
  type ImportRunnerControls,
} from "@/lib/recipes/recipeImportScheduler";
import { AnalyticsEvents } from "@/lib/analytics/events";

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function deferredRunner() {
  let resolve!: (v: { title?: string; recipeId?: string | null }) => void;
  let controls: ImportRunnerControls | null = null;
  let markStarted!: () => void;
  const started = new Promise<void>((s) => {
    markStarted = s;
  });
  const run: ImportRunner = (c) =>
    new Promise((res) => {
      controls = c;
      resolve = res;
      markStarted();
    });
  return { run, started, resolve: (v = {}) => resolve(v), controls: () => controls };
}

describe("useImportQueue — derived state", () => {
  it("splits jobs into inFlight + recent and tracks counts", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 1 });
    const r = deferredRunner();
    const { result } = renderHook(() => useImportQueue("web", undefined, scheduler));

    expect(result.current.hasActivity).toBe(false);

    act(() => {
      result.current.enqueue({ id: "a", kind: "url", title: "A", run: r.run });
      result.current.enqueue({
        id: "b",
        kind: "url",
        title: "B",
        run: async () => ({ title: "B done" }),
      });
    });
    await act(async () => {
      await flush();
    });

    await waitFor(() => expect(result.current.hasActivity).toBe(true));
    // a active, b queued behind it (concurrency 1).
    expect(result.current.activeCount).toBe(1);
    expect(result.current.queuedCount).toBe(1);
    expect(result.current.inFlight).toHaveLength(2);
    expect(result.current.summary).toBe("Importing 1 · 1 in queue");
  });
});

describe("useImportQueue — analytics contract", () => {
  it("emits recipe_import_enqueued on enqueue with post-enqueue counts", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 2 });
    const track = vi.fn();
    const r = deferredRunner();
    const { result } = renderHook(() => useImportQueue("web", track, scheduler));

    act(() => {
      result.current.enqueue({ id: "a", kind: "url", title: "A", run: r.run });
    });
    await act(async () => {
      await flush();
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvents.recipe_import_enqueued,
      expect.objectContaining({ kind: "url", platform: "web", activeCount: 1, queuedCount: 0 }),
    );
  });

  it("emits recipe_import_stage_changed for each transition with platform + kind", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 1 });
    const track = vi.fn();
    const { result } = renderHook(() => useImportQueue("mobile", track, scheduler));

    act(() => {
      result.current.enqueue({
        id: "a",
        kind: "caption",
        title: "Reel",
        run: async (c) => {
          c.setStage("extracting");
          c.setStage("organizing");
          return { title: "Done" };
        },
      });
    });
    await act(async () => {
      await flush();
    });

    const stages = track.mock.calls
      .filter((c) => c[0] === AnalyticsEvents.recipe_import_stage_changed)
      .map((c) => (c[1] as { stage: string }).stage);
    // confirming → extracting → organizing → done all observed.
    expect(stages).toContain("confirming");
    expect(stages).toContain("extracting");
    expect(stages).toContain("organizing");
    expect(stages).toContain("done");
    for (const call of track.mock.calls.filter(
      (c) => c[0] === AnalyticsEvents.recipe_import_stage_changed,
    )) {
      expect(call[1]).toMatchObject({ kind: "caption", platform: "mobile" });
      expect(typeof (call[1] as { elapsedMs: number }).elapsedMs).toBe("number");
    }
  });

  it("includes errorCode on a failed stage-change event", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 1 });
    const track = vi.fn();
    const { result } = renderHook(() => useImportQueue("web", track, scheduler));

    act(() => {
      result.current.enqueue({
        id: "a",
        kind: "url",
        title: "A",
        run: async () => {
          throw new ImportRunnerError("timeout");
        },
      });
    });
    await act(async () => {
      await flush();
    });

    const failed = track.mock.calls.find(
      (c) =>
        c[0] === AnalyticsEvents.recipe_import_stage_changed &&
        (c[1] as { stage: string }).stage === "failed",
    );
    expect(failed).toBeDefined();
    expect(failed![1]).toMatchObject({ stage: "failed", errorCode: "timeout" });
  });

  it("emits recipe_import_job_action on cancel + retry", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 1 });
    const track = vi.fn();
    const r = deferredRunner();
    const { result } = renderHook(() => useImportQueue("mobile", track, scheduler));

    act(() => {
      result.current.enqueue({ id: "a", kind: "url", title: "A", run: r.run });
    });
    await act(async () => {
      await flush();
    });
    act(() => {
      result.current.cancel("a");
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvents.recipe_import_job_action,
      expect.objectContaining({ action: "cancel", kind: "url", platform: "mobile" }),
    );
  });

  it("does NOT emit analytics when track is undefined", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 1 });
    // No track passed — must not throw, must not attempt to emit.
    const { result } = renderHook(() => useImportQueue("web", undefined, scheduler));
    act(() => {
      result.current.enqueue({
        id: "a",
        kind: "url",
        title: "A",
        run: async () => ({ title: "ok" }),
      });
    });
    await act(async () => {
      await flush();
    });
    expect(result.current.recent.some((j) => j.stage === "done")).toBe(true);
  });
});
