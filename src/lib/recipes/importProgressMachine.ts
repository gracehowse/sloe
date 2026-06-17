/**
 * Import-progress staged state machine (ENG — "Import-progress staged
 * state-machine + queue UX", 2026-06-08).
 *
 * The single source of truth for the *user-visible* stages of one recipe
 * import, shared verbatim by web (`RecipeImportProgress`) and mobile
 * (`ImportProgressDrawer` / `ImportLoadingSkeleton`). Only the
 * presentation differs per platform; the stage set, the labels, and the
 * legal transitions live here so the two platforms can never drift.
 *
 * ── Honesty contract (why these stages and not Julienne's six) ──
 *
 * Julienne surfaces `confirming → extracting → organizing → generating →
 * translating`, but their client genuinely observes those boundaries — it
 * orchestrates per-platform acquisition client-side and calls a *separate*
 * server extraction step it can await independently. Sloe's extraction
 * runs as ONE atomic server POST (`/api/recipe-import` &c.); the client
 * cannot observe sub-stages inside that call, and this ticket explicitly
 * does NOT touch the extraction backend (a separate Supadata ticket
 * covers streaming). So we map ONLY to boundaries the client really
 * controls, and never fake sub-second checkmarks for work we can't see:
 *
 *   queued      — waiting for a concurrency slot (real: the scheduler is
 *                 holding it back behind the slot limit).
 *   confirming  — client validates the input + dispatches the request
 *                 (real, fast: we own this).
 *   extracting  — the server round-trip is in flight (real, the long leg:
 *                 honest-indeterminate; we show elapsed/slow-load copy
 *                 rather than fake progress because we cannot see inside).
 *   organizing  — the response came back; the client is normalising,
 *                 classifying meal type, and structuring ingredients
 *                 (real, fast: we own this).
 *   done        — the recipe is ready to review/save (terminal-success).
 *   cancelled   — the user aborted (terminal).
 *   failed      — the import errored (terminal; carries an `ImportErrorCode`
 *                 so the UI reuses `importErrorCopy`).
 *
 * "generating" (Julienne's hero-image stage) is intentionally absent here
 * because on Sloe hero-image generation is fire-and-forget AFTER save
 * (`/api/recipe-import/image-hero`) — it never blocks the import and so is
 * not a blocking stage. Folding it in as a fake blocking step would be the
 * exact theatre we're avoiding.
 *
 * The machine is pure and framework-agnostic (no React, no fetch) so it is
 * unit-tested in isolation and bundles cleanly into the RN tree via
 * `@suppr/shared/recipes/importProgressMachine`.
 */
import type { ImportErrorCode } from "./importErrorCopy";

/** Every user-visible stage of a single import job. */
export type ImportStage =
  | "queued"
  | "confirming"
  | "extracting"
  | "organizing"
  | "done"
  | "cancelled"
  | "failed";

/** The modality a job is importing from — drives stage copy + analytics. */
export type ImportJobKind = "url" | "caption" | "image";

/** Stages from which no further transition is allowed. */
export const TERMINAL_STAGES: ReadonlySet<ImportStage> = new Set<ImportStage>([
  "done",
  "cancelled",
  "failed",
]);

/** Stages where the job is actively occupying a concurrency slot (i.e. not
 *  merely waiting in the queue and not finished). */
export const ACTIVE_STAGES: ReadonlySet<ImportStage> = new Set<ImportStage>([
  "confirming",
  "extracting",
  "organizing",
]);

/**
 * Allowed forward transitions. Each key lists the stages it may move to.
 * `cancelled` / `failed` are reachable from every non-terminal stage so a
 * user can cancel mid-flight and any leg can error out. The happy path is
 * `queued → confirming → extracting → organizing → done`.
 */
const ALLOWED: Record<ImportStage, ReadonlySet<ImportStage>> = {
  queued: new Set(["confirming", "cancelled", "failed"]),
  confirming: new Set(["extracting", "cancelled", "failed"]),
  extracting: new Set(["organizing", "cancelled", "failed"]),
  organizing: new Set(["done", "cancelled", "failed"]),
  done: new Set(),
  cancelled: new Set(),
  failed: new Set(),
};

/** True when `to` is a legal next stage from `from`. */
export function canTransition(from: ImportStage, to: ImportStage): boolean {
  return ALLOWED[from].has(to);
}

/** True when the stage is terminal (no further transition allowed). */
export function isTerminalStage(stage: ImportStage): boolean {
  return TERMINAL_STAGES.has(stage);
}

/** True when the job is occupying a concurrency slot (not queued, not done). */
export function isActiveStage(stage: ImportStage): boolean {
  return ACTIVE_STAGES.has(stage);
}

/**
 * Ordered list of the *displayed* progress stages a job walks through on
 * the happy path. Used by the stepper UI to render the rail and to compute
 * "step N of M". Terminal-error/cancel are not part of the rail (they
 * replace it). `queued` is excluded from the rail too — it's a pre-state
 * shown as a queue-position chip, not a step.
 */
export const DISPLAY_STAGES: ReadonlyArray<
  Extract<ImportStage, "confirming" | "extracting" | "organizing" | "done">
> = ["confirming", "extracting", "organizing", "done"];

/**
 * Human-readable label for a stage. Kept calm + neutral (Sloe voice — no
 * celebration, no "!"). `kind` tailors the `extracting` copy to the source
 * so the user understands what's happening to *their* link/photo. Shared
 * verbatim across platforms so web ↔ mobile copy can never drift.
 */
export function stageLabel(stage: ImportStage, kind: ImportJobKind = "url"): string {
  switch (stage) {
    case "queued":
      return "In queue";
    case "confirming":
      return "Confirming recipe type";
    case "extracting":
      return kind === "image"
        ? "Reading the photo"
        : kind === "caption"
          ? "Reading the post"
          : "Extracting recipe details";
    case "organizing":
      return "Organizing ingredients and steps";
    case "done":
      return "Ready to review";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Couldn't import";
  }
}

/**
 * A short status line for the persistent drawer header summarising the
 * whole batch, mirroring Julienne's "Creating 2, 1 in queue" /
 * "Your recipes are all done!" — but in Sloe's calmer register.
 *
 * @param active   count of jobs currently occupying a slot (confirming/extracting/organizing)
 * @param queued   count of jobs waiting for a slot
 * @param failed   count of jobs in the `failed` terminal stage (still listed)
 */
export function batchSummaryLabel(active: number, queued: number, failed: number): string {
  if (active === 0 && queued === 0) {
    return failed > 0 ? "Some imports need another try" : "All imports done";
  }
  const parts: string[] = [];
  if (active > 0) parts.push(`Importing ${active}`);
  if (queued > 0) parts.push(`${queued} in queue`);
  return parts.join(" · ");
}

/** Queue-position chip copy. `position` is 1-based among queued jobs. */
export function queuePositionLabel(position: number): string {
  return `In queue (#${position}) — starts when a slot opens`;
}

/**
 * Immutable snapshot of one import job as the UI consumes it. The scheduler
 * (`recipeImportScheduler.ts`) owns mutation; presenters only read this.
 */
export interface ImportJobView {
  /** Stable per-job id (also the dedupe key in the scheduler). */
  id: string;
  /** Source modality. */
  kind: ImportJobKind;
  /** Current stage. */
  stage: ImportStage;
  /** Best human label for the job (recipe title once known, else source hint). */
  title: string;
  /** 1-based queue position when `stage === "queued"`, else null. */
  queuePosition: number | null;
  /** Stable error code when `stage === "failed"`, else null. Feeds `importErrorCopy`. */
  errorCode: ImportErrorCode | null;
  /** Epoch ms the job was enqueued (for "recent" ordering + elapsed copy). */
  enqueuedAt: number;
  /** Epoch ms the job reached a terminal stage, else null. */
  finishedAt: number | null;
  /** True when the job may be retried (failed + retryable error). */
  canRetry: boolean;
  /** The saved recipe id once `done` + persisted, else null (deep-link target). */
  recipeId: string | null;
}

/**
 * Error codes for which an automatic / one-tap retry is sensible (transient
 * or user-fixable-by-retrying). Permanent input errors (`invalid_url`,
 * `pro_required`, `caption_too_short`, …) are NOT retryable — retrying the
 * same input just fails again, so the UI should not offer Retry for them.
 */
const RETRYABLE_ERRORS: ReadonlySet<ImportErrorCode> = new Set<ImportErrorCode>([
  "rate_limited",
  "ai_rate_limited",
  "ai_unavailable",
  "ai_request_failed",
  "ai_capacity_reached",
  "openai_http_error",
  "fetch_failed",
  "timeout",
  "save_failed",
  "service_unavailable",
  "import_failed",
  "network_error",
  "unknown",
]);

/** True when a failed job should offer a one-tap Retry for this error code. */
export function isRetryableError(code: ImportErrorCode | null | undefined): boolean {
  if (!code) return false;
  return RETRYABLE_ERRORS.has(code);
}

/**
 * Deterministic job id for a URL/caption import so the scheduler's
 * id-idempotency dedupes duplicate *concurrent* imports of the same source
 * (the iOS share sheet + clipboard + deep link can all deliver the same URL
 * near-simultaneously — the original `importInFlightRef` guarded this for the
 * inline path; the queue path reproduces it via a stable id). A terminal job
 * with the same id is replaced, so an intentional re-import after the first
 * completes still works. Shared so web + mobile derive the SAME id.
 */
export function importJobIdForUrl(kind: ImportJobKind, url: string): string {
  return `import:${kind}:${url.trim().toLowerCase()}`;
}

/**
 * Deterministic job id for ONE photo in a bulk/multi-photo recipe import
 * (ENG-735 — bulk photo import as the primary import path). Each selected
 * photo becomes one `image` job in the shared scheduler, so the user sees a
 * row-per-photo in the queue drawer with its own progress / cancel / retry.
 *
 * The `localRef` is a per-photo stable handle the picker already gives us —
 * the asset URI on mobile or the file name+size on web. It is ONLY used to
 * dedupe a double-enqueue of the SAME picked photo (a re-render or a
 * duplicate share intent) the way `importJobIdForUrl` dedupes a URL; it is
 * never sent anywhere or persisted. Picking the same image file twice on
 * purpose still re-imports because a terminal job with the same id is
 * replaced (scheduler `enqueue` semantics). Shared so web + mobile derive the
 * SAME id shape and the queue cannot drift between platforms.
 */
export function importJobIdForImage(localRef: string): string {
  return `import:image:${localRef.trim().toLowerCase()}`;
}
