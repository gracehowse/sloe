/**
 * Shared React binding for the recipe-import queue (ENG —
 * "Import-progress staged state-machine + queue UX", 2026-06-08).
 *
 * Wraps the {@link recipeImportScheduler} singleton in `useSyncExternalStore`
 * so any component on EITHER platform re-renders when a job's stage, queue
 * position, or terminal state changes. Web imports this directly
 * (`@/lib/recipes/useImportQueue`); mobile imports the same module via
 * `@suppr/shared/recipes/useImportQueue` (Metro maps `@suppr/shared/*` →
 * `src/lib/*`, and the metro config prefers the mobile React copy for shared
 * hooks — same mechanism `src/lib/useOdometer.ts` already relies on).
 *
 * Analytics: stage-change + cancel/retry events are emitted HERE via an
 * injected `track` (web `@/lib/analytics/track`, mobile
 * `@/lib/analytics`) so the event names + payload shapes are identical
 * across platforms — the contract lives in one file, not two.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { AnalyticsEvents, type AnalyticsEventName } from "../analytics/events";
import {
  ACTIVE_STAGES,
  batchSummaryLabel,
  type ImportJobView,
} from "./importProgressMachine";
import {
  recipeImportScheduler,
  type EnqueueSpec,
  type RecipeImportScheduler,
} from "./recipeImportScheduler";

export type { ImportJobView } from "./importProgressMachine";
export type { EnqueueSpec, ImportRunner, ImportRunnerControls, ImportRunnerResult } from "./recipeImportScheduler";
export { ImportRunnerError } from "./recipeImportScheduler";

/** Analytics signature both platforms' `track` satisfy verbatim
 *  (web `@/lib/analytics/track`, mobile `@/lib/analytics`): the event arg is
 *  the canonical `AnalyticsEventName`, never a free string. */
export type TrackFn = (event: AnalyticsEventName, properties?: Record<string, unknown>) => void;

export type ImportQueuePlatform = "web" | "mobile";

export interface UseImportQueueResult {
  /** All jobs: queued + active + recent, in enqueue order. */
  jobs: ReadonlyArray<ImportJobView>;
  /** Jobs occupying a slot or waiting for one (queued/confirming/extracting/organizing). */
  inFlight: ReadonlyArray<ImportJobView>;
  /** Terminal jobs (done/cancelled/failed) for the "recent" list. */
  recent: ReadonlyArray<ImportJobView>;
  /** Count occupying a slot right now. */
  activeCount: number;
  /** Count waiting for a slot. */
  queuedCount: number;
  /** Count in the failed terminal stage (still listed). */
  failedCount: number;
  /** Calm batch summary for the drawer header ("Importing 2 · 1 in queue"). */
  summary: string;
  /** True when any job is queued or active — drives drawer visibility. */
  hasActivity: boolean;
  /** Enqueue an import. Idempotent by id; returns false if a live dup. */
  enqueue: (spec: EnqueueSpec) => boolean;
  /** Cancel a job (aborts the in-flight fetch if active). */
  cancel: (id: string) => void;
  /** Retry a failed + retryable job under the same id. */
  retry: (id: string) => boolean;
  /** Dismiss one terminal job from the recent list. */
  dismiss: (id: string) => void;
  /** Clear all terminal jobs from the recent list. */
  clearFinished: () => void;
}

const EMPTY: ReadonlyArray<ImportJobView> = Object.freeze([]);

/**
 * Subscribe to the import queue.
 *
 * @param platform   "web" | "mobile" — stamped onto every emitted event.
 * @param track      analytics emit fn; pass `undefined` to disable analytics
 *                   (e.g. in a test, or before consent). Stage-change +
 *                   job-action events fire through it.
 * @param scheduler  the scheduler to bind to. Defaults to the app-wide
 *                   singleton; tests + Storybook inject an isolated instance.
 */
export function useImportQueue(
  platform: ImportQueuePlatform,
  track?: TrackFn,
  scheduler: RecipeImportScheduler = recipeImportScheduler,
): UseImportQueueResult {
  const jobs = useSyncExternalStore(
    scheduler.subscribe,
    scheduler.getSnapshot,
    scheduler.getSnapshot,
  );

  // Stage-change analytics — installed as the scheduler's single stage-change
  // listener (NOT a snapshot diff). The listener fires SYNCHRONOUSLY on every
  // transition, so fast intermediate stages (confirming→extracting→organizing
  // landing in one microtask) aren't lost to React batching, which a
  // render-snapshot diff would drop. The scheduler keeps a single slot, so even
  // if two drawers mount only one emits — no double-counting.
  useEffect(() => {
    if (!track) return;
    return scheduler.setStageChangeListener((job, previous) => {
      track(AnalyticsEvents.recipe_import_stage_changed, {
        stage: job.stage,
        previousStage: previous,
        kind: job.kind,
        platform,
        ...(job.stage === "queued" && job.queuePosition != null
          ? { queuePosition: job.queuePosition }
          : {}),
        ...(job.stage === "failed" && job.errorCode ? { errorCode: job.errorCode } : {}),
        elapsedMs: Math.max(0, (job.finishedAt ?? Date.now()) - job.enqueuedAt),
      });
    });
  }, [track, platform, scheduler]);

  const enqueue = useCallback(
    (spec: EnqueueSpec): boolean => {
      const added = scheduler.enqueue(spec);
      if (added && track) {
        track(AnalyticsEvents.recipe_import_enqueued, {
          kind: spec.kind,
          platform,
          activeCount: scheduler.activeCount(),
          queuedCount: scheduler.queuedCount(),
        });
      }
      return added;
    },
    [track, platform, scheduler],
  );

  const cancel = useCallback(
    (id: string) => {
      const job = scheduler.getSnapshot().find((j) => j.id === id);
      scheduler.cancel(id);
      if (job && track) {
        track(AnalyticsEvents.recipe_import_job_action, {
          action: "cancel",
          kind: job.kind,
          platform,
          stage: job.stage,
        });
      }
    },
    [track, platform, scheduler],
  );

  const retry = useCallback(
    (id: string): boolean => {
      const job = scheduler.getSnapshot().find((j) => j.id === id);
      const ok = scheduler.retry(id);
      if (ok && job && track) {
        track(AnalyticsEvents.recipe_import_job_action, {
          action: "retry",
          kind: job.kind,
          platform,
          ...(job.errorCode ? { errorCode: job.errorCode } : {}),
          stage: job.stage,
        });
      }
      return ok;
    },
    [track, platform, scheduler],
  );

  const dismiss = useCallback((id: string) => scheduler.dismiss(id), [scheduler]);
  const clearFinished = useCallback(() => scheduler.clearFinished(), [scheduler]);

  const derived = useMemo(() => {
    const inFlight = jobs.filter((j) => j.stage === "queued" || ACTIVE_STAGES.has(j.stage));
    const recent = jobs.filter(
      (j) => j.stage === "done" || j.stage === "cancelled" || j.stage === "failed",
    );
    const activeCount = jobs.reduce((n, j) => (ACTIVE_STAGES.has(j.stage) ? n + 1 : n), 0);
    const queuedCount = jobs.reduce((n, j) => (j.stage === "queued" ? n + 1 : n), 0);
    const failedCount = jobs.reduce((n, j) => (j.stage === "failed" ? n + 1 : n), 0);
    return {
      inFlight: inFlight.length ? inFlight : EMPTY,
      recent: recent.length ? recent : EMPTY,
      activeCount,
      queuedCount,
      failedCount,
      summary: batchSummaryLabel(activeCount, queuedCount, failedCount),
      hasActivity: activeCount > 0 || queuedCount > 0,
    };
  }, [jobs]);

  return {
    jobs,
    ...derived,
    enqueue,
    cancel,
    retry,
    dismiss,
    clearFinished,
  };
}
