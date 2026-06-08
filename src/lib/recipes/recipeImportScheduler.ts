/**
 * Recipe-import scheduler (ENG — "Import-progress staged state-machine +
 * queue UX", 2026-06-08).
 *
 * A framework-agnostic, slot-based concurrency engine that runs N recipe
 * imports across M concurrent slots, surfacing live queue position and
 * per-job cancel/retry. Shared verbatim by web + mobile via
 * `@suppr/shared/recipes/recipeImportScheduler`; the platforms wrap it in a
 * thin `useSyncExternalStore` adapter and render `ImportJobView[]` however
 * they like.
 *
 * Design rules (each maps to a real failure mode from the audit):
 *
 *  • **Slots release in `finally`.** A thrown runner must never leak a slot
 *    (the `persist_path_guardrails` bug class). Every code path that occupies
 *    a slot releases it exactly once.
 *  • **Cancel is real.** Each job owns an `AbortController`; cancelling aborts
 *    the in-flight fetch the runner is awaiting, not just the label.
 *  • **Enqueue is idempotent by id.** Re-enqueuing a live id is a no-op, so a
 *    React re-render or a duplicate share-intent can't double-run a job
 *    (mirrors the existing `importInFlightRef` guard, generalised).
 *  • **Transitions are validated** against `importProgressMachine` — an
 *    illegal transition throws in dev and is a no-op in prod, so the UI can
 *    never show an impossible stage.
 *  • **No React, no fetch, no platform globals.** The runner is injected, so
 *    the engine unit-tests deterministically with a fake runner + fake clock.
 */
import {
  ACTIVE_STAGES,
  canTransition,
  isRetryableError,
  isTerminalStage,
  type ImportJobKind,
  type ImportJobView,
  type ImportStage,
} from "./importProgressMachine";
import type { ImportErrorCode } from "./importErrorCopy";

// Re-export so call sites can import the job types from one place.
export type { ImportJobView, ImportJobKind, ImportStage } from "./importProgressMachine";
export type { ImportErrorCode } from "./importErrorCopy";

/**
 * Handle passed to a job runner so it can advance the displayed stage and
 * read its own abort signal. The runner is responsible ONLY for the
 * acquisition+extraction work; the scheduler owns queue/slot/terminal state.
 */
export interface ImportRunnerControls {
  /** Move the job to the next displayed stage (validated). No-op if terminal. */
  setStage: (stage: Extract<ImportStage, "confirming" | "extracting" | "organizing">) => void;
  /** Attach the recipe title once known (e.g. after the response parses). */
  setTitle: (title: string) => void;
  /** The job's abort signal — pass to `fetch`. Aborts on cancel. */
  signal: AbortSignal;
  /** True once the user has cancelled — runners can short-circuit between legs. */
  isCancelled: () => boolean;
}

/** What a runner resolves to on success. */
export interface ImportRunnerResult {
  /** Display title (falls back to the seed title if omitted). */
  title?: string;
  /** Saved recipe id, when the runner persisted (enables deep-linking). */
  recipeId?: string | null;
}

/** A runner: performs one import. Throws `ImportRunnerError` on failure. */
export type ImportRunner = (controls: ImportRunnerControls) => Promise<ImportRunnerResult>;

/**
 * Error a runner throws to fail a job with a stable, user-facing code.
 * Carrying the `ImportErrorCode` lets the drawer reuse `importErrorCopy`
 * and decide whether to offer Retry (`isRetryableError`).
 */
export class ImportRunnerError extends Error {
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ImportRunnerError";
    this.code = code;
  }
}

/** Spec to enqueue one job. */
export interface EnqueueSpec {
  /** Stable id; re-enqueuing a live id is a no-op (idempotent). */
  id: string;
  kind: ImportJobKind;
  /** Seed title shown before the recipe title is known (e.g. host or "TikTok recipe"). */
  title: string;
  /** The work. Receives controls; throws `ImportRunnerError` to fail. */
  run: ImportRunner;
}

/** Stage-change listener — fired SYNCHRONOUSLY on every transition (including
 *  fast intermediate ones React would batch away), so analytics never misses
 *  a stage. */
export type StageChangeListener = (job: ImportJobView, previous: ImportStage) => void;

/** Lifecycle hook fired by the scheduler so the consumer can emit analytics. */
export interface SchedulerEvents {
  /** Fired whenever a job's stage changes (including terminal). */
  onStageChange?: StageChangeListener;
}

interface InternalJob {
  id: string;
  kind: ImportJobKind;
  seedTitle: string;
  title: string;
  stage: ImportStage;
  errorCode: ImportErrorCode | null;
  enqueuedAt: number;
  finishedAt: number | null;
  recipeId: string | null;
  run: ImportRunner;
  controller: AbortController | null;
  /** True once cancel has been requested (latched before the slot is freed). */
  cancelRequested: boolean;
}

const DEFAULT_CONCURRENCY = 2;
/** Cap on how many terminal jobs we keep listed in the drawer before pruning oldest. */
const DEFAULT_HISTORY_LIMIT = 12;

export interface SchedulerOptions {
  /** Max jobs running at once. Default 2 (matches Julienne's slot feel). */
  concurrency?: number;
  /** Max terminal (done/failed/cancelled) jobs retained for the recent list. */
  historyLimit?: number;
  /** Injected clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
  events?: SchedulerEvents;
}

/**
 * The scheduler. One instance per app (a module singleton is exported
 * below); the class is exported too so tests can spin up isolated instances
 * with a fake clock + fake concurrency.
 */
export class RecipeImportScheduler {
  private readonly concurrency: number;
  private readonly historyLimit: number;
  private readonly now: () => number;
  private readonly events: SchedulerEvents;

  /** Insertion-ordered job map (Map preserves order — drives queue position). */
  private readonly jobs = new Map<string, InternalJob>();
  private readonly listeners = new Set<() => void>();
  /** Single-slot analytics listener (set by the binding hook). Fired on EVERY
   *  transition synchronously, so fast intermediate stages aren't lost to
   *  React batching the way a snapshot-diff would. */
  private stageChangeListener: StageChangeListener | null = null;
  /** Cached immutable snapshot for `useSyncExternalStore` referential stability. */
  private snapshot: ReadonlyArray<ImportJobView> = [];

  constructor(opts: SchedulerOptions = {}) {
    this.concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
    this.historyLimit = Math.max(1, opts.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    this.now = opts.now ?? Date.now;
    this.events = opts.events ?? {};
    this.rebuildSnapshot();
  }

  // ── Public store API (consumed by useSyncExternalStore on both platforms) ──

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Stable, referentially-cached snapshot of all jobs (queued + active + recent). */
  getSnapshot = (): ReadonlyArray<ImportJobView> => this.snapshot;

  /**
   * Install the single analytics stage-change listener. Returns an unsubscribe
   * that clears it ONLY if it's still the same listener (so a remount doesn't
   * clear a newer mount's listener). One slot by design: exactly one consumer
   * should emit stage analytics, so multiple drawer mounts can't double-fire.
   */
  setStageChangeListener = (listener: StageChangeListener | null): (() => void) => {
    this.stageChangeListener = listener;
    return () => {
      if (this.stageChangeListener === listener) this.stageChangeListener = null;
    };
  };

  /** Count of jobs currently occupying a slot. */
  activeCount(): number {
    let n = 0;
    for (const j of this.jobs.values()) if (ACTIVE_STAGES.has(j.stage)) n += 1;
    return n;
  }

  /** Count of jobs waiting for a slot. */
  queuedCount(): number {
    let n = 0;
    for (const j of this.jobs.values()) if (j.stage === "queued") n += 1;
    return n;
  }

  /** Count of failed terminal jobs still listed. */
  failedCount(): number {
    let n = 0;
    for (const j of this.jobs.values()) if (j.stage === "failed") n += 1;
    return n;
  }

  /**
   * 1-based position of a queued job among the queue, or null when not
   * queued. O(n) but n is tiny (a handful of imports).
   */
  getQueuePosition(id: string): number | null {
    const target = this.jobs.get(id);
    if (!target || target.stage !== "queued") return null;
    let pos = 0;
    for (const j of this.jobs.values()) {
      if (j.stage === "queued") {
        pos += 1;
        if (j.id === id) return pos;
      }
    }
    return null;
  }

  // ── Mutation API ──

  /**
   * Enqueue a job. Idempotent by id: if a job with the same id is currently
   * live (queued or active), this is a no-op and returns false. A terminal
   * job with the same id is replaced (allows retry-with-same-id). Returns
   * true when a new job was actually enqueued.
   */
  enqueue(spec: EnqueueSpec): boolean {
    const existing = this.jobs.get(spec.id);
    if (existing && !isTerminalStage(existing.stage)) {
      // Live duplicate — ignore (re-render / duplicate share intent).
      return false;
    }
    if (existing) {
      // Terminal job being re-run under the same id: drop it so the new one
      // re-appends at the end (fresh queue position + ordering).
      this.jobs.delete(spec.id);
    }
    const job: InternalJob = {
      id: spec.id,
      kind: spec.kind,
      seedTitle: spec.title,
      title: spec.title,
      stage: "queued",
      errorCode: null,
      enqueuedAt: this.now(),
      finishedAt: null,
      recipeId: null,
      run: spec.run,
      controller: null,
      cancelRequested: false,
    };
    this.jobs.set(spec.id, job);
    this.pruneHistory();
    this.commit();
    this.pump();
    return true;
  }

  /**
   * Cancel a job. If queued, it goes straight to `cancelled`. If active, its
   * abort signal fires (the runner's fetch aborts) and the runner's rejection
   * is mapped to `cancelled` (not `failed`). No-op if already terminal.
   */
  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (!job || isTerminalStage(job.stage)) return;
    job.cancelRequested = true;
    if (job.stage === "queued") {
      this.transition(job, "cancelled");
      this.commit();
      // A freed-up notional slot may let the next queued job start.
      this.pump();
      return;
    }
    // Active: abort the in-flight work. The runner's finally will free the
    // slot and the catch will route to `cancelled` because cancelRequested
    // is latched.
    job.controller?.abort();
  }

  /**
   * Retry a failed job by re-running its original runner under the same id.
   * Only valid for failed + retryable jobs; otherwise a no-op. Returns true
   * when a retry was actually enqueued.
   */
  retry(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.stage !== "failed" || !isRetryableError(job.errorCode)) {
      return false;
    }
    return this.enqueue({ id: job.id, kind: job.kind, title: job.seedTitle, run: job.run });
  }

  /** Remove a single terminal job from the list (drawer "dismiss"). No-op if live. */
  dismiss(id: string): void {
    const job = this.jobs.get(id);
    if (!job || !isTerminalStage(job.stage)) return;
    this.jobs.delete(id);
    this.commit();
  }

  /** Remove all terminal jobs (drawer "Clear"). Live jobs are untouched. */
  clearFinished(): void {
    let changed = false;
    for (const [id, j] of this.jobs) {
      if (isTerminalStage(j.stage)) {
        this.jobs.delete(id);
        changed = true;
      }
    }
    if (changed) this.commit();
  }

  // ── Internals ──

  /** Start as many queued jobs as free slots allow (FIFO by insertion order). */
  private pump(): void {
    while (this.activeCount() < this.concurrency) {
      const next = this.firstQueued();
      if (!next) break;
      this.start(next);
    }
  }

  private firstQueued(): InternalJob | null {
    for (const j of this.jobs.values()) if (j.stage === "queued") return j;
    return null;
  }

  /** Move a queued job into `confirming` and kick off its runner. */
  private start(job: InternalJob): void {
    // A cancel could have landed between enqueue and pump.
    if (job.cancelRequested) {
      this.transition(job, "cancelled");
      this.commit();
      return;
    }
    job.controller = new AbortController();
    this.transition(job, "confirming");
    this.commit();

    const controls: ImportRunnerControls = {
      setStage: (stage) => {
        // Ignore stage pushes after a terminal landing (e.g. a late
        // setStage from a runner that already resolved/aborted).
        if (isTerminalStage(job.stage)) return;
        this.transition(job, stage);
        this.commit();
      },
      setTitle: (title) => {
        const t = title.trim();
        if (!t) return;
        job.title = t;
        this.commit();
      },
      signal: job.controller.signal,
      isCancelled: () => job.cancelRequested,
    };

    // Fire the runner. All terminal handling (success/cancel/fail) plus the
    // slot release happens here so a thrown runner can never leak a slot.
    void this.runJob(job, controls);
  }

  private async runJob(job: InternalJob, controls: ImportRunnerControls): Promise<void> {
    try {
      const result = await job.run(controls);
      if (job.cancelRequested) {
        this.finishCancelled(job);
        return;
      }
      if (result.title) job.title = result.title.trim() || job.title;
      job.recipeId = result.recipeId ?? null;
      this.finishDone(job);
    } catch (err) {
      if (job.cancelRequested || isAbortError(err)) {
        this.finishCancelled(job);
        return;
      }
      const code: ImportErrorCode =
        err instanceof ImportRunnerError ? err.code : "import_failed";
      this.finishFailed(job, code);
    } finally {
      // Slot is implicitly freed because the job is now terminal (terminal
      // stages are excluded from activeCount). Pump the next queued job.
      job.controller = null;
      this.pump();
    }
  }

  private finishDone(job: InternalJob): void {
    if (isTerminalStage(job.stage)) return;
    // A scheduler-owned terminal landing: `done` is reachable from any
    // active stage. The forward-only graph guard (`transition`) only
    // constrains *runner-driven* stage pushes (confirming→extracting→…);
    // a fast runner that resolves without manually walking every display
    // stage must still be allowed to finish. So we force the landing,
    // exactly as cancel/fail do. `finishedAt` is set first so the
    // synchronous stage-change listener sees a complete view.
    job.finishedAt = this.now();
    this.forceTransition(job, "done");
    this.pruneHistory();
    this.commit();
  }

  private finishCancelled(job: InternalJob): void {
    if (job.stage === "cancelled") return;
    // Force terminal even if mid-stage (cancel is reachable from any active stage).
    job.finishedAt = this.now();
    this.forceTransition(job, "cancelled");
    this.pruneHistory();
    this.commit();
  }

  private finishFailed(job: InternalJob, code: ImportErrorCode): void {
    if (isTerminalStage(job.stage)) return;
    // Set the error code + finish time BEFORE the transition so the
    // synchronous stage-change listener (analytics) sees a complete view
    // (errorCode populated, canRetry resolved).
    job.errorCode = code;
    job.finishedAt = this.now();
    this.forceTransition(job, "failed");
    this.pruneHistory();
    this.commit();
  }

  /** Validated transition. In dev, an illegal move throws; in prod it's a no-op. */
  private transition(job: InternalJob, to: ImportStage): void {
    if (job.stage === to) return;
    if (!canTransition(job.stage, to)) {
      if (process.env.NODE_ENV !== "production") {
        throw new Error(
          `[recipeImportScheduler] illegal transition ${job.stage} → ${to} for job ${job.id}`,
        );
      }
      return;
    }
    this.applyTransition(job, to);
  }

  /** Terminal landings (cancel/fail) bypass the forward-only graph guard but
   *  still refuse to overwrite an existing terminal stage. */
  private forceTransition(job: InternalJob, to: ImportStage): void {
    if (isTerminalStage(job.stage)) return;
    this.applyTransition(job, to);
  }

  private applyTransition(job: InternalJob, to: ImportStage): void {
    const previous = job.stage;
    job.stage = to;
    const view = this.viewOf(job);
    this.events.onStageChange?.(view, previous);
    this.stageChangeListener?.(view, previous);
  }

  /** Keep at most `historyLimit` terminal jobs; prune the oldest finished. */
  private pruneHistory(): void {
    const terminal = [...this.jobs.values()].filter((j) => isTerminalStage(j.stage));
    if (terminal.length <= this.historyLimit) return;
    terminal
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
      .slice(0, terminal.length - this.historyLimit)
      .forEach((j) => this.jobs.delete(j.id));
  }

  private viewOf(job: InternalJob): ImportJobView {
    return {
      id: job.id,
      kind: job.kind,
      stage: job.stage,
      title: job.title,
      queuePosition: this.getQueuePosition(job.id),
      errorCode: job.errorCode,
      enqueuedAt: job.enqueuedAt,
      finishedAt: job.finishedAt,
      canRetry: job.stage === "failed" && isRetryableError(job.errorCode),
      recipeId: job.recipeId,
    };
  }

  private rebuildSnapshot(): void {
    this.snapshot = [...this.jobs.values()].map((j) => this.viewOf(j));
  }

  /** Rebuild the snapshot + notify subscribers (one place so every mutation is observed). */
  private commit(): void {
    this.rebuildSnapshot();
    for (const l of this.listeners) l();
  }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || /aborted/i.test(err.message))
  );
}

/**
 * App-wide singleton. Both platforms import THIS instance so a queued import
 * survives navigation between the import screen and the drawer. Tests should
 * construct their own `new RecipeImportScheduler(...)` for isolation.
 */
export const recipeImportScheduler = new RecipeImportScheduler();
