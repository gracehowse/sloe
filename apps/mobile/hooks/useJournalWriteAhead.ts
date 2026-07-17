import { useCallback } from "react";
import { Alert } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadJournalWriteQueue,
  saveJournalWriteQueue,
} from "@/lib/journalWriteQueueStorage";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  ackWrittenIds,
  queueRowsAsByDayFallback,
  withUpsertTimeout,
  writeAheadEnqueue,
  UPSERT_TIMEOUT,
  DEFAULT_UPSERT_TIMEOUT_MS,
  type JournalWriteQueueIO,
} from "@suppr/nutrition-core/journalWriteAhead";
import {
  flushJournalWriteQueue,
  reconcileQueueAfterFlush,
  type SessionRefresher,
} from "@suppr/nutrition-core/flushJournalWriteQueue";
import type { JournalWriteQueue } from "@suppr/nutrition-core/journalWriteQueue";

/**
 * ENG-1447 part 4 — user-facing copy for an un-drainable write-ahead queue.
 * Kept local (not the recipe-import `importErrorCopy` register, which is a
 * distinct domain with its own `ImportErrorCode` union) since this is the
 * only journal-sync-failure surface today. Follows the same voice rules:
 * calm, actionable, never names Supabase/Postgres/RLS.
 */
export const JOURNAL_SYNC_DROPPED_ALERT = {
  title: "Some logs couldn't sync",
  body:
    "A saved log couldn't reach the server after several tries and was removed from the retry queue. Check your connection, then re-add it if it's missing from your journal.",
} as const;

/**
 * Surface a poison-row eviction or terminal queue drop instead of letting it
 * vanish silently (ENG-1447 part 4 — `droppedPoisonIds` / `dropQueue` were
 * computed by `flushJournalWriteQueue` but no caller ever read them before
 * this fix). Fires ONE alert per flush pass (not one per dropped row) plus a
 * PostHog capture so drop-rate is visible on a dashboard, not just in a
 * device Alert the user may dismiss without reporting.
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
    platform: "ios",
  });
  Alert.alert(JOURNAL_SYNC_DROPPED_ALERT.title, JOURNAL_SYNC_DROPPED_ALERT.body);
}

/**
 * ENG-1447 — thin mobile delegate for the shared write-ahead journal
 * primitives. `TodayScreen.tsx` is a pinned only-shrink screen-budget file
 * (`scripts/screen-line-budget.json`), so every stateful/retry-shaped piece
 * of this fix lives here + in `src/lib/nutrition/journalWriteAhead.ts` — the
 * screen's call sites only call `writeAhead(...)`.
 *
 * Sequencing this hook guarantees for every caller:
 *   1. Rows are enqueued to the durable AsyncStorage queue BEFORE the
 *      network upsert is attempted (write-ahead) — a kill between "tapped
 *      log" and "network resolved" always leaves the row recoverable.
 *   2. The upsert races a ~10s timeout; a hung fetch is treated exactly
 *      like a rejected upsert (row stays queued, offline alert shown) —
 *      the loss window can never be held open indefinitely.
 *   3. On success, exactly the confirmed ids are acked (removed) from the
 *      queue — no more permanently-orphaned entries from a direct write
 *      that raced ahead of the next full-queue flush.
 */
const QUEUE_IO: JournalWriteQueueIO = {
  load: loadJournalWriteQueue,
  save: saveJournalWriteQueue,
};

export type WriteAheadResult = {
  /** True if the network upsert (or its post-refresh retry) confirmed. */
  persisted: boolean;
  /** True if the upsert hit the ~10s timeout specifically (still queued either way). */
  timedOut: boolean;
};

/**
 * Build the mobile `SessionRefresher` for `flushJournalWriteQueue`'s 42501
 * re-verify-and-retry pass (ENG-1447 part 4). `refreshed: true` only when
 * `refreshSession()` actually returned a live session — a thrown/failed
 * refresh must fall through to the terminal-drop path, not spin forever.
 */
function makeSessionRefresher(supabase: SupabaseClient): SessionRefresher {
  return async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return { refreshed: !error && Boolean(data?.session) };
  };
}

export function useJournalWriteAhead(supabase: SupabaseClient) {
  /**
   * Write-ahead a batch of `nutrition_entries` rows for `dayKey`: enqueue
   * first, then attempt the upsert under a bounded timeout. Returns whether
   * the write actually confirmed so callers can chain FK-dependent
   * follow-ups (e.g. ingredient-snapshot writes) only after a real success.
   *
   * `opts.onEnqueued` fires the instant step 1 (the durable AsyncStorage
   * write) resolves — BEFORE the network attempt starts. This is the
   * correct moment for a "commit confirmed" UI beat (e.g. the log-confirm
   * haptic): the row is unconditionally safe on-device from here on,
   * whether the upsert below succeeds, times out, or the app is killed a
   * moment later. Firing the haptic any earlier (e.g. straight after the
   * optimistic `setByDay`, before enqueue) would assert durability the app
   * had not yet actually achieved — the ENG-1447 copy/duplicate bug.
   */
  const writeAhead = useCallback(
    async (
      dayKey: string,
      rows: ReadonlyArray<Record<string, unknown>>,
      opts?: {
        timeoutMs?: number;
        onEnqueued?: () => void;
        // ENG-1522 — a range caller (writes to N days independently) suppresses
        // this per-day Alert and shows one consolidated message itself.
        suppressFailureAlert?: boolean;
      },
    ): Promise<WriteAheadResult> => {
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
        if (!opts?.suppressFailureAlert) {
          Alert.alert(
            "Saved on this device",
            "We'll sync this log when you're back online.",
          );
        }
        return { persisted: false, timedOut: true };
      }

      const { error } = outcome as { error: { message?: string } | null };
      if (error) {
        console.error("[journalWriteAhead] upsert failed:", error.message);
        if (!opts?.suppressFailureAlert) {
          Alert.alert(
            "Saved on this device",
            "We'll sync this log when you're back online.",
          );
        }
        return { persisted: false, timedOut: false };
      }

      // Step 3 — ack exactly the confirmed ids.
      const ids = rows.map((r) => String(r.id));
      await ackWrittenIds(QUEUE_IO, ids);
      return { persisted: true, timedOut: false };
    },
    [supabase],
  );

  /** Drain the durable queue: retry every still-queued row, with a single
   *  session re-verify-and-retry pass on a 42501 (ENG-1447 part 4) before
   *  a terminal denial is allowed to drop rows. Surfaces poison evictions
   *  and terminal drops to the caller instead of swallowing them. */
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
