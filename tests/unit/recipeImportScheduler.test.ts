/**
 * Unit tests for the recipe-import scheduler (ENG —
 * "Import-progress staged state-machine + queue UX", 2026-06-08).
 *
 * These protect the load-bearing concurrency behaviour the queue UX
 * depends on:
 *   • slot-based concurrency (only N run at once; the rest queue)
 *   • live, 1-based queue position
 *   • cancel aborts the in-flight fetch AND frees the slot
 *   • a thrown runner NEVER leaks a slot (the bug class we explicitly guard)
 *   • idempotent enqueue (a re-render / duplicate share intent can't double-run)
 *   • retry re-runs a failed + retryable job; refuses non-retryable
 *
 * The runner is injected, so every path is deterministic — no real fetch,
 * no real timers beyond a microtask flush.
 */
import { describe, it, expect, vi } from "vitest";
import {
  RecipeImportScheduler,
  ImportRunnerError,
  type ImportRunner,
  type ImportRunnerControls,
} from "@/lib/recipes/recipeImportScheduler";

/** Resolve all pending microtasks (lets runner promises settle). */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

type DeferredResult = { title?: string; recipeId?: string | null };

/** A controllable runner: exposes a `resolve`/`reject` you fire from the test,
 *  plus a `started` promise that settles once the scheduler invokes it. */
function deferredRunner() {
  let resolve!: (v: DeferredResult) => void;
  let reject!: (e: unknown) => void;
  let controls: ImportRunnerControls | null = null;
  let markStarted!: () => void;
  const started = new Promise<void>((s) => {
    markStarted = s;
  });
  const run: ImportRunner = (c) =>
    new Promise<DeferredResult>((res, rej) => {
      controls = c;
      resolve = res;
      reject = rej;
      markStarted();
    });
  return {
    run,
    started,
    resolve: (v: DeferredResult = {}) => resolve(v),
    reject: (e: unknown) => reject(e),
    controls: () => controls,
  };
}

describe("RecipeImportScheduler — slot concurrency", () => {
  it("runs at most `concurrency` jobs and queues the rest", async () => {
    const s = new RecipeImportScheduler({ concurrency: 2 });
    const r1 = deferredRunner();
    const r2 = deferredRunner();
    const r3 = deferredRunner();

    s.enqueue({ id: "a", kind: "url", title: "A", run: r1.run });
    s.enqueue({ id: "b", kind: "url", title: "B", run: r2.run });
    s.enqueue({ id: "c", kind: "url", title: "C", run: r3.run });
    await flush();

    expect(s.activeCount()).toBe(2);
    expect(s.queuedCount()).toBe(1);
    const snap = s.getSnapshot();
    expect(snap.find((j) => j.id === "a")!.stage).toBe("confirming");
    expect(snap.find((j) => j.id === "b")!.stage).toBe("confirming");
    expect(snap.find((j) => j.id === "c")!.stage).toBe("queued");
    expect(snap.find((j) => j.id === "c")!.queuePosition).toBe(1);
  });

  it("starts the next queued job when an active one finishes (frees its slot)", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r1 = deferredRunner();
    const r2 = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "A", run: r1.run });
    s.enqueue({ id: "b", kind: "url", title: "B", run: r2.run });
    await flush();

    expect(s.getSnapshot().find((j) => j.id === "b")!.stage).toBe("queued");
    r1.resolve({ title: "A done" });
    await flush();

    expect(s.getSnapshot().find((j) => j.id === "a")!.stage).toBe("done");
    expect(s.getSnapshot().find((j) => j.id === "b")!.stage).toBe("confirming");
  });

  it("reports 1-based queue positions and shifts them as jobs start", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r1 = deferredRunner();
    const r2 = deferredRunner();
    const r3 = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "A", run: r1.run });
    s.enqueue({ id: "b", kind: "url", title: "B", run: r2.run });
    s.enqueue({ id: "c", kind: "url", title: "C", run: r3.run });
    await flush();

    expect(s.getQueuePosition("b")).toBe(1);
    expect(s.getQueuePosition("c")).toBe(2);
    expect(s.getQueuePosition("a")).toBeNull(); // a is active, not queued

    r1.resolve();
    await flush();
    // b starts → c moves up to #1
    expect(s.getQueuePosition("b")).toBeNull();
    expect(s.getQueuePosition("c")).toBe(1);
  });
});

describe("RecipeImportScheduler — stage advancement via controls", () => {
  it("lets the runner advance confirming → extracting → organizing → done", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r = deferredRunner();
    s.enqueue({ id: "a", kind: "image", title: "Photo", run: r.run });
    await flush();
    await r.started;

    const c = r.controls()!;
    expect(s.getSnapshot()[0].stage).toBe("confirming");
    c.setStage("extracting");
    expect(s.getSnapshot()[0].stage).toBe("extracting");
    c.setStage("organizing");
    expect(s.getSnapshot()[0].stage).toBe("organizing");
    c.setTitle("Banana bread");
    expect(s.getSnapshot()[0].title).toBe("Banana bread");

    r.resolve({ recipeId: "rec-1" });
    await flush();
    const done = s.getSnapshot()[0];
    expect(done.stage).toBe("done");
    expect(done.recipeId).toBe("rec-1");
    expect(done.finishedAt).not.toBeNull();
  });

  it("prefers the resolved title over a mid-flight setTitle", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "seed", run: r.run });
    await flush();
    await r.started;
    r.controls()!.setTitle("interim");
    r.resolve({ title: "Final title" });
    await flush();
    expect(s.getSnapshot()[0].title).toBe("Final title");
  });
});

describe("RecipeImportScheduler — cancel", () => {
  it("cancels a queued job straight to cancelled and frees a notional slot", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r1 = deferredRunner();
    const r2 = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "A", run: r1.run });
    s.enqueue({ id: "b", kind: "url", title: "B", run: r2.run });
    await flush();

    s.cancel("b");
    expect(s.getSnapshot().find((j) => j.id === "b")!.stage).toBe("cancelled");
    expect(s.queuedCount()).toBe(0);
  });

  it("cancelling an active job aborts its signal and lands on cancelled (not failed)", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    let abortFired = false;
    const run: ImportRunner = (c) =>
      new Promise((_res, rej) => {
        c.signal.addEventListener("abort", () => {
          abortFired = true;
          rej(new DOMException("Aborted", "AbortError"));
        });
      });
    s.enqueue({ id: "a", kind: "url", title: "A", run });
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("confirming");

    s.cancel("a");
    await flush();
    expect(abortFired).toBe(true);
    expect(s.getSnapshot()[0].stage).toBe("cancelled");
  });

  it("a runner that resolves AFTER cancel is treated as cancelled, not done", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "A", run: r.run });
    await flush();
    await r.started;
    s.cancel("a"); // abort requested
    r.resolve({ title: "raced through" }); // runner ignored the abort
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("cancelled");
  });
});

describe("RecipeImportScheduler — failure never leaks a slot", () => {
  it("a thrown ImportRunnerError fails the job, frees the slot, starts the next", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r2 = deferredRunner();
    s.enqueue({
      id: "a",
      kind: "url",
      title: "A",
      run: async () => {
        throw new ImportRunnerError("timeout", "boom");
      },
    });
    s.enqueue({ id: "b", kind: "url", title: "B", run: r2.run });
    await flush();

    const a = s.getSnapshot().find((j) => j.id === "a")!;
    expect(a.stage).toBe("failed");
    expect(a.errorCode).toBe("timeout");
    expect(a.canRetry).toBe(true);
    // Slot freed → b started.
    expect(s.getSnapshot().find((j) => j.id === "b")!.stage).toBe("confirming");
    expect(s.activeCount()).toBe(1);
  });

  it("a non-ImportRunnerError throw maps to import_failed", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    s.enqueue({
      id: "a",
      kind: "url",
      title: "A",
      run: async () => {
        throw new Error("unexpected");
      },
    });
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("failed");
    expect(s.getSnapshot()[0].errorCode).toBe("import_failed");
  });
});

describe("RecipeImportScheduler — idempotent enqueue", () => {
  it("ignores a re-enqueue of a live id (no double-run)", async () => {
    const s = new RecipeImportScheduler({ concurrency: 2 });
    const r = deferredRunner();
    const runs = vi.fn(r.run);
    expect(s.enqueue({ id: "a", kind: "url", title: "A", run: runs })).toBe(true);
    await flush();
    // Same id while active → no-op.
    expect(s.enqueue({ id: "a", kind: "url", title: "A again", run: runs })).toBe(false);
    expect(s.getSnapshot().filter((j) => j.id === "a")).toHaveLength(1);
  });

  it("allows re-enqueue of a terminal id (re-appends fresh)", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    s.enqueue({
      id: "a",
      kind: "url",
      title: "A",
      run: async () => {
        throw new ImportRunnerError("timeout");
      },
    });
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("failed");
    const r2 = deferredRunner();
    expect(s.enqueue({ id: "a", kind: "url", title: "A retry", run: r2.run })).toBe(true);
    await flush();
    expect(s.getSnapshot().filter((j) => j.id === "a")).toHaveLength(1);
    expect(s.getSnapshot()[0].stage).toBe("confirming");
  });
});

describe("RecipeImportScheduler — retry", () => {
  it("retries a failed + retryable job under the same id", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    let attempt = 0;
    const run: ImportRunner = async () => {
      attempt += 1;
      if (attempt === 1) throw new ImportRunnerError("ai_unavailable");
      return { title: "succeeded on retry" };
    };
    s.enqueue({ id: "a", kind: "url", title: "A", run });
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("failed");

    expect(s.retry("a")).toBe(true);
    await flush();
    expect(s.getSnapshot()[0].stage).toBe("done");
    expect(s.getSnapshot()[0].title).toBe("succeeded on retry");
    expect(attempt).toBe(2);
  });

  it("refuses to retry a non-retryable failure", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    s.enqueue({
      id: "a",
      kind: "url",
      title: "A",
      run: async () => {
        throw new ImportRunnerError("invalid_url");
      },
    });
    await flush();
    expect(s.getSnapshot()[0].canRetry).toBe(false);
    expect(s.retry("a")).toBe(false);
    expect(s.getSnapshot()[0].stage).toBe("failed");
  });

  it("refuses to retry a non-terminal or unknown job", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const r = deferredRunner();
    s.enqueue({ id: "a", kind: "url", title: "A", run: r.run });
    await flush();
    expect(s.retry("a")).toBe(false); // active, not failed
    expect(s.retry("missing")).toBe(false);
  });
});

describe("RecipeImportScheduler — recent list housekeeping", () => {
  it("dismiss removes one terminal job; live jobs are untouched", async () => {
    const s = new RecipeImportScheduler({ concurrency: 2 });
    s.enqueue({
      id: "a",
      kind: "url",
      title: "A",
      run: async () => ({ title: "A" }),
    });
    const r = deferredRunner();
    s.enqueue({ id: "b", kind: "url", title: "B", run: r.run });
    await flush();
    expect(s.getSnapshot().find((j) => j.id === "a")!.stage).toBe("done");

    s.dismiss("a");
    expect(s.getSnapshot().find((j) => j.id === "a")).toBeUndefined();
    // Active b survives a dismiss attempt.
    s.dismiss("b");
    expect(s.getSnapshot().find((j) => j.id === "b")).toBeDefined();
  });

  it("clearFinished removes all terminal jobs only", async () => {
    const s = new RecipeImportScheduler({ concurrency: 2 });
    s.enqueue({ id: "a", kind: "url", title: "A", run: async () => ({}) });
    s.enqueue({
      id: "b",
      kind: "url",
      title: "B",
      run: async () => {
        throw new ImportRunnerError("timeout");
      },
    });
    const r = deferredRunner();
    s.enqueue({ id: "c", kind: "url", title: "C", run: r.run });
    await flush();

    s.clearFinished();
    const ids = s.getSnapshot().map((j) => j.id);
    expect(ids).toEqual(["c"]); // only the active job remains
  });

  it("prunes oldest terminal jobs beyond historyLimit", async () => {
    const now = vi.fn();
    let t = 1000;
    now.mockImplementation(() => (t += 100));
    const s = new RecipeImportScheduler({ concurrency: 3, historyLimit: 2, now });
    for (const id of ["a", "b", "c"]) {
      s.enqueue({ id, kind: "url", title: id, run: async () => ({}) });
    }
    await flush();
    // 3 done jobs, limit 2 → oldest (a) pruned.
    const ids = s.getSnapshot().map((j) => j.id);
    expect(ids).not.toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });
});

describe("RecipeImportScheduler — store subscription", () => {
  it("notifies subscribers on every mutation and yields a stable snapshot", async () => {
    const s = new RecipeImportScheduler({ concurrency: 1 });
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    const before = s.getSnapshot();
    s.enqueue({ id: "a", kind: "url", title: "A", run: async () => ({}) });
    expect(listener).toHaveBeenCalled();
    expect(s.getSnapshot()).not.toBe(before); // new immutable snapshot
    await flush();
    unsub();
    const calls = listener.mock.calls.length;
    s.enqueue({ id: "b", kind: "url", title: "B", run: async () => ({}) });
    expect(listener.mock.calls.length).toBe(calls); // unsubscribed
  });
});
