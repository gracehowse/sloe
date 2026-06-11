"use client";

/**
 * Web persistent import-queue drawer (ENG — "Import-progress staged
 * state-machine + queue UX", 2026-06-08).
 *
 * A calm, non-blocking floating panel (bottom-right) that lists every
 * in-flight + recent recipe import with live per-stage progress, queue
 * position, and per-recipe cancel/retry — the web half of the Julienne
 * staged-progress borrow. The queue logic + stage copy are shared with
 * mobile (`@/lib/recipes/useImportQueue`); only this presentation is
 * web-specific.
 *
 * It is intentionally NOT a modal: the user can keep pasting/importing
 * more URLs while it's open (the multi-recipe behaviour the whole queue
 * exists for). Gated by the `import-progress-v2` flag at the call site;
 * this component renders nothing when there is no activity.
 *
 * Retry/cancel copy reuses `importErrorCopy` so the failure messaging is
 * identical to the inline import errors users already see.
 */
import { useMemo, useState } from "react";
import { Icons } from "../ui/icons";
import { cn } from "../ui/utils";
import { IMPORT_ERROR_COPY } from "../../../lib/recipes/importErrorCopy";
import {
  DISPLAY_STAGES,
  queuePositionLabel,
  stageLabel,
  type ImportJobView,
  type ImportStage,
} from "../../../lib/recipes/importProgressMachine";
import type { UseImportQueueResult } from "../../../lib/recipes/useImportQueue";

type Props = {
  queue: UseImportQueueResult;
  /** Navigate to a finished recipe (deep-link). Optional — falls back to no-op. */
  onOpenRecipe?: (recipeId: string) => void;
};

/** Index of a stage on the display rail, or -1 if it's not a rail stage. */
function railIndex(stage: ImportStage): number {
  return (DISPLAY_STAGES as readonly ImportStage[]).indexOf(stage);
}

export function RecipeImportQueueDrawer({ queue, onOpenRecipe }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { inFlight, recent, summary, hasActivity, activeCount, queuedCount } = queue;

  // Hide entirely when nothing is happening AND there's no recent history.
  if (!hasActivity && recent.length === 0) return null;

  return (
    <aside
      data-testid="import-queue-drawer"
      aria-live="polite"
      aria-label="Recipe imports"
      className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              hasActivity ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {hasActivity ? (
              <Icons.refresh className="size-3.5 animate-spin" />
            ) : (
              <Icons.import className="size-3.5" />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground" data-testid="import-queue-summary">
              {summary}
            </p>
            {hasActivity ? (
              <p className="text-[11px] text-muted-foreground">
                {activeCount} importing{queuedCount > 0 ? ` · ${queuedCount} waiting` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {recent.length > 0 && !hasActivity ? (
            <button
              type="button"
              onClick={queue.clearFinished}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand imports" : "Collapse imports"}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <Icons.down className={cn("size-4 transition-transform", collapsed ? "rotate-180" : "")} />
          </button>
        </div>
      </header>

      {!collapsed ? (
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          <ul className="flex flex-col gap-1.5">
            {inFlight.map((job) => (
              <ImportJobRow key={job.id} job={job} queue={queue} />
            ))}
            {recent.map((job) => (
              <ImportJobRow key={job.id} job={job} queue={queue} onOpenRecipe={onOpenRecipe} />
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function ImportJobRow({
  job,
  queue,
  onOpenRecipe,
}: {
  job: ImportJobView;
  queue: UseImportQueueResult;
  onOpenRecipe?: (recipeId: string) => void;
}) {
  const isFailed = job.stage === "failed";
  const isDone = job.stage === "done";
  const isCancelled = job.stage === "cancelled";
  const isQueued = job.stage === "queued";

  const failureMessage = useMemo(
    () => (isFailed && job.errorCode ? IMPORT_ERROR_COPY[job.errorCode] : null),
    [isFailed, job.errorCode],
  );

  const clickable = isDone && job.recipeId != null && onOpenRecipe != null;

  return (
    <li
      data-testid="import-queue-row"
      data-stage={job.stage}
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isFailed
          ? "border-destructive/30 bg-destructive/5"
          : isCancelled
            ? "border-border bg-muted/30"
            : "border-border bg-background",
        clickable ? "cursor-pointer hover:bg-muted/40" : "",
      )}
      onClick={clickable ? () => onOpenRecipe!(job.recipeId!) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={job.title}>
            {job.title}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-[11px]",
              // Base sage fails AA as text (theme.css:136) — caught by the storybook
              // axe gate after the §1 inversion put this on white cards.
              isFailed ? "text-destructive" : isDone ? "text-[var(--accent-success-solid)]" : "text-muted-foreground",
            )}
            data-testid="import-queue-row-status"
          >
            {isQueued && job.queuePosition != null
              ? queuePositionLabel(job.queuePosition)
              : isFailed
                ? (failureMessage ?? stageLabel(job.stage, job.kind))
                : stageLabel(job.stage, job.kind)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isDone ? (
            <span
              role="img"
              className="flex size-6 items-center justify-center rounded-full bg-[var(--success)] text-white"
              aria-label="Imported"
            >
              <Icons.check className="size-3.5" />
            </span>
          ) : null}
          {job.canRetry ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                queue.retry(job.id);
              }}
              aria-label={`Retry importing ${job.title}`}
              data-testid="import-queue-retry"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icons.refresh className="size-3.5" />
            </button>
          ) : null}
          {!isDone && !isCancelled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                queue.cancel(job.id);
              }}
              aria-label={`Cancel importing ${job.title}`}
              data-testid="import-queue-cancel"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icons.close className="size-3.5" />
            </button>
          ) : null}
          {isFailed || isCancelled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                queue.dismiss(job.id);
              }}
              aria-label={`Dismiss ${job.title}`}
              data-testid="import-queue-dismiss"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icons.close className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Stage rail — only while active (not queued/terminal). */}
      {!isQueued && !isDone && !isFailed && !isCancelled ? (
        <StageRail stage={job.stage} />
      ) : null}
    </li>
  );
}

/** A compact 3-segment rail showing confirming → extracting → organizing. */
function StageRail({ stage }: { stage: ImportStage }) {
  const current = railIndex(stage);
  // Rail shows the three working stages (exclude the terminal "done" pip).
  const segments = DISPLAY_STAGES.filter((s) => s !== "done");
  return (
    <div className="mt-2 flex items-center gap-1" aria-hidden>
      {segments.map((s) => {
        const idx = railIndex(s);
        const reached = idx <= current;
        const active = idx === current;
        return (
          <span
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              active
                ? "bg-primary"
                : reached
                  ? "bg-primary/60"
                  : "bg-border",
              active ? "animate-pulse" : "",
            )}
          />
        );
      })}
    </div>
  );
}
