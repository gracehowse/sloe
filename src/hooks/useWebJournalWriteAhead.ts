import { useCallback } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadJournalWriteQueue,
  saveJournalWriteQueue,
} from "../lib/nutrition/journalWriteQueueStorage.web.ts";
import { track } from "../lib/analytics/track.ts";
import { AnalyticsEvents } from "../lib/analytics/events.ts";
import {
  ackWrittenIds,
  queueRowsAsByDayFallback,
  withUpsertTimeout,
  writeAheadEnqueue,
  UPSERT_TIMEOUT,
  DEFAULT_UPSERT_TIMEOUT_MS,
  type JournalWriteQueueIO,
} from "../lib/nutrition/journalWriteAhead.ts";
import {
  flushJournalWriteQueue,
  reconcileQueueAfterFlush,
  type SessionRefresher,
} from "../lib/nutrition/flushJournalWriteQueue.ts";
import type { JournalWriteQueue } from "../lib/nutrition/journalWriteQueue.ts";

/**
 * ENG-1466 — web port of `apps/mobile/hooks/useJournalWriteAhead.ts`
 * (ENG-1447). Same rationale: every `nutrition_entries` insert was
 * optimistic-first, fire-and-forget-persist second — the durable
 * localStorage queue only gained a row AFTER the network insert rejected,
 * the insert itself had no timeout (a hung fetch held the loss window open
 * indefinitely), and a successful direct write never acked the queue. A
 * user could commit a log, close the tab / lose the network before the
 * round-trip resolved, and reload to find the meal only reappearing once
 * the next flush happened to succeed — with no visible error in between.
 *
 * This hook wires the shared, platform-agnostic primitives in
 * `src/lib/nutrition/journalWriteAhead.ts` to the web `localStorage` queue
 * (`journalWriteQueueStorage.web.ts` — the SAME queue/key `useNutritionJournalState`
 * already uses for its failure-path retry queue; write-ahead changes WHEN a
 * row enters the queue, not which queue it enters) + the browser Supabase
 * client + a real `supabase.auth.refreshSession()`-backed `SessionRefresher`
 * for the 42501 re-verify pass.
 */
const QUEUE_IO: JournalWriteQueueIO = {
  load: loadJournalWriteQueue,
  save: saveJournalWriteQueue,
};

export type WebWriteAheadResult = {
  /** True if the network upsert (or its post-refresh retry) confirmed. */
  persisted: boolean;
  /** True if the upsert hit the ~10s timeout specifically (still queued either way). */
  timedOut: boolean;
  /**
   * Web-only addition (no mobile equivalent needed — mobile has no
   * "missing table" fallback concept). Surfaces the raw upsert error
   * message so callers can still special-case a missing-table response
   * (`looksLikeMissingTableError`) and flip `dbNutritionEnabled` off,
   * instead of leaving a never-writable row parked in the retry queue
   * forever. `undefined` on success or timeout.
   */
  errorMessage?: string;
};

/**
 * ENG-1466 — user-facing copy for an un-drainable write-ahead queue.
 * Mirrors the mobile `JOURNAL_SYNC_DROPPED_ALERT` copy/voice rules: calm,
 * actionable, never names Supabase/Postgres/RLS.
 */
export const JOURNAL_SYNC_DROPPED_TOAST = {
  title: "Some logs couldn't sync",
  body:
    "A saved log couldn't reach the server after several tries and was removed from the retry queue. Check your connection, then re-add it if it's missing from your journal.",
} as const;

/**
 * Surface a poison-row eviction or terminal queue drop instead of letting it
 * vanish silently (web parity with mobile's `reportDroppedJournalWrites`).
 * Fires ONE toast per flush pass (not one per dropped row) plus a PostHog
 * capture so drop-rate is visible on a dashboard, not just a toast the user
 * may dismiss without reporting.
 */
export function reportDroppedJournalWrites(args: {
  droppedPoisonIds: readonly string[];
  dropQueue: boolean;
}): void {
  const droppedCount = args.dropQueue ? -1 : args.droppedPoisonIds.length;
  if (droppedCount === 0) return;
  console.warn(
    "[journalWriteAhead] queue drop:",
    args.dropQueue ? "terminal (session/RLS denial)" : `${args.droppedPoisonIds.length} poison row(s)`,
  );
  track(AnalyticsEvents.journal_write_queue_drop, {
    droppedCount,
    dropQueue: args.dropQueue,
    platform: "web",
  });
  toast.error(JOURNAL_SYNC_DROPPED_TOAST.title, {
    description: JOURNAL_SYNC_DROPPED_TOAST.body,
  });
}

/**
 * Build the web `SessionRefresher` for `flushJournalWriteQueue`'s 42501
 * re-verify-and-retry pass (mirrors mobile's `makeSessionRefresher`). A
 * stale-but-refreshable JWT can surface as `42501` (not just as an "expired"
 * message) depending on the PostgREST/RLS path taken, so a single re-verify
 * pass prevents a merely-stale session from evicting rows that would have
 * written fine a moment later.
 */
function makeSessionRefresher(supabase: SupabaseClient): SessionRefresher {
  return async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return { refreshed: !error && Boolean(data?.session) };
  };
}

/**
 * ENG-1466 — thin web delegate for the shared write-ahead journal
 * primitives, mirroring `apps/mobile/hooks/useJournalWriteAhead.ts` so the
 * two platforms cannot silently diverge on ordering. All retry/timeout/ack
 * state lives here (not in `useNutritionJournalState.ts`), matching the
 * mobile screen-budget rationale of keeping the context/screen file a thin
 * consumer.
 */
export function useWebJournalWriteAhead(supabase: SupabaseClient) {
  /**
   * Write-ahead a batch of `nutrition_entries` rows for `dayKey`: enqueue
   * first, then attempt the upsert under a bounded timeout. Returns whether
   * the write actually confirmed so callers can chain FK-dependent
   * follow-ups only after a real success.
   *
   * `opts.onEnqueued` fires the instant step 1 (the durable localStorage
   * write) resolves — BEFORE the network attempt starts. This is the
   * correct moment for a "commit confirmed" UI beat: the row is
   * unconditionally safe on-device from here on, whether the upsert below
   * succeeds, times out, or the tab is closed a moment later.
   */
  const writeAhead = useCallback(
    async (
      dayKey: string,
      rows: ReadonlyArray<Record<string, unknown>>,
      opts?: { timeoutMs?: number; onEnqueued?: () => void },
    ): Promise<WebWriteAheadResult> => {
      if (rows.length === 0) return { persisted: true, timedOut: false };
      // Step 1 — durable BEFORE the network attempt.
      await writeAheadEnqueue(QUEUE_IO, dayKey, rows);
      opts?.onEnqueued?.();

      // Step 2 — bounded upsert.
      const outcome = await withUpsertTimeout(
        supabase.from("nutrition_entries").upsert(rows, { onConflict: "id" }),
        opts?.timeoutMs ?? DEFAULT_UPSERT_TIMEOUT_MS,
      );

      if (outcome === UPSERT_TIMEOUT) {
        console.warn("[journalWriteAhead] upsert timed out — row(s) stay queued");
        toast.warning("Saved on this device — we'll sync when you're back online.");
        return { persisted: false, timedOut: true };
      }

      const { error } = outcome as { error: { message?: string } | null };
      if (error) {
        console.error("[journalWriteAhead] upsert failed:", error.message);
        toast.warning("Saved on this device — we'll sync when you're back online.");
        return { persisted: false, timedOut: false, errorMessage: error.message ?? "unknown error" };
      }

      // Step 3 — ack exactly the confirmed ids.
      const ids = rows.map((r) => String(r.id));
      await ackWrittenIds(QUEUE_IO, ids);
      return { persisted: true, timedOut: false };
    },
    [supabase],
  );

  /** Drain the durable queue: retry every still-queued row, with a single
   *  session re-verify-and-retry pass on a 42501 before a terminal denial
   *  is allowed to drop rows. Surfaces poison evictions and terminal drops
   *  to the caller instead of swallowing them. */
  const flushQueue = useCallback(async (): Promise<{
    flushedIds: string[];
    droppedPoisonIds: string[];
    dropQueue: boolean;
  }> => {
    const queue = await loadJournalWriteQueue();
    if (queue.entries.length === 0) {
      return { flushedIds: [], droppedPoisonIds: [], dropQueue: false };
    }
    const result = await flushJournalWriteQueue(
      supabase,
      queue,
      makeSessionRefresher(supabase),
    );
    const latest = await loadJournalWriteQueue();
    await saveJournalWriteQueue(reconcileQueueAfterFlush(queue, latest, result));
    return {
      flushedIds: result.flushedIds,
      droppedPoisonIds: result.droppedPoisonIds,
      dropQueue: result.dropQueue,
    };
  }, [supabase]);

  /** Cold-start / merge-time visibility: queued-but-unflushed rows as a
   *  `ByDay`-shaped map of raw rows, for the caller to map through its own
   *  row→meal function and merge alongside the server snapshot. */
  const loadQueuedByDay = useCallback(async (): Promise<
    Record<string, Record<string, unknown>[]>
  > => {
    const queue: JournalWriteQueue = await loadJournalWriteQueue();
    return queueRowsAsByDayFallback(queue);
  }, []);

  return { writeAhead, flushQueue, loadQueuedByDay };
}
