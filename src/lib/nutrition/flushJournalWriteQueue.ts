import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bumpJournalQueueAttempts,
  emptyJournalWriteQueue,
  journalQueueUpsertRows,
  removeJournalQueuedIds,
  MAX_JOURNAL_FLUSH_ATTEMPTS,
  type JournalQueuedUpsert,
  type JournalWriteQueue,
} from "./journalWriteQueue";

export type FlushJournalWriteQueueResult = {
  /** Ids that wrote successfully on this flush. */
  flushedIds: string[];
  /** Ids evicted as poison (failed every retry up to the attempt cap). */
  droppedPoisonIds: string[];
  /** Post-flush queue for the SENT snapshot — survivors with bumped attempts. */
  remaining: JournalWriteQueue;
  /** True when the whole sent batch hit a terminal RLS/permission denial. */
  dropQueue: boolean;
  lastError: string | null;
};

/**
 * ENG-1447 — optional session re-verification hook. `flushJournalWriteQueue`
 * calls this at most once per flush, only on a 42501/permission-denied
 * response, before treating it as terminal. A stale-but-refreshable JWT can
 * surface as `42501` (not just as an "expired" message) depending on the
 * PostgREST/RLS path taken, so a single re-verify-and-retry pass prevents a
 * merely-stale session from evicting rows that would have written fine a
 * moment later. Callers pass their platform's `supabase.auth.refreshSession`
 * (or equivalent); omitting it preserves the pre-ENG-1447 terminal-drop
 * behaviour.
 */
export type SessionRefresher = () => Promise<{ refreshed: boolean }>;

function isPermissionDenied(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  // 42501 = insufficient_privilege (RLS). An expired-but-refreshable JWT is
  // explicitly NOT in here — supabase-js refreshes it, so that error is
  // transient and the queue must be kept, not dropped.
  return error.code === "42501" || msg.includes("permission denied");
}

/** Retry queued nutrition_entries upserts. Returns ids that succeeded. */
export async function flushJournalWriteQueue(
  supabase: SupabaseClient,
  queue: JournalWriteQueue,
  refreshSession?: SessionRefresher,
): Promise<FlushJournalWriteQueueResult> {
  const rows = journalQueueUpsertRows(queue);
  if (rows.length === 0) {
    return {
      flushedIds: [],
      droppedPoisonIds: [],
      remaining: queue,
      dropQueue: false,
      lastError: null,
    };
  }

  const { error } = await supabase.from("nutrition_entries").upsert(rows, { onConflict: "id" });

  if (!error) {
    const flushedIds = rows.map((r) => String(r.id));
    return {
      flushedIds,
      droppedPoisonIds: [],
      // Remove only the ids we actually sent — never blanket-empty, or a row
      // enqueued during this flush's round-trip would be lost.
      remaining: removeJournalQueuedIds(queue, flushedIds),
      dropQueue: false,
      lastError: null,
    };
  }

  const msg = error.message ?? "unknown error";

  // Terminal RLS / permission denial — these rows will never write under the
  // current policy, so drop them rather than spin forever. ENG-1447: a 42501
  // can also be a merely-stale (refreshable) session, so give the caller ONE
  // chance to re-verify + retry before treating it as terminal.
  if (isPermissionDenied(error as { message?: string; code?: string })) {
    if (refreshSession) {
      const { refreshed } = await refreshSession().catch(() => ({ refreshed: false }));
      if (refreshed) {
        const retry = await supabase.from("nutrition_entries").upsert(rows, { onConflict: "id" });
        if (!retry.error) {
          const flushedIds = rows.map((r) => String(r.id));
          return {
            flushedIds,
            droppedPoisonIds: [],
            remaining: removeJournalQueuedIds(queue, flushedIds),
            dropQueue: false,
            lastError: null,
          };
        }
        // Still denied after a real session refresh — genuinely terminal.
        if (isPermissionDenied(retry.error as { message?: string; code?: string })) {
          return {
            flushedIds: [],
            droppedPoisonIds: [],
            remaining: emptyJournalWriteQueue(),
            dropQueue: true,
            lastError: retry.error.message ?? msg,
          };
        }
        // Retry failed for a different (transient) reason — fall through to
        // the normal bump-and-retry path below rather than dropping.
      } else {
        return {
          flushedIds: [],
          droppedPoisonIds: [],
          remaining: emptyJournalWriteQueue(),
          dropQueue: true,
          lastError: msg,
        };
      }
    } else {
      return {
        flushedIds: [],
        droppedPoisonIds: [],
        remaining: emptyJournalWriteQueue(),
        dropQueue: true,
        lastError: msg,
      };
    }
  }

  // Transient (network / 5xx / expired JWT) OR a single poison row failing the
  // whole bulk upsert. Bump attempts and keep retrying in bulk until an entry
  // hits the cap; then isolate row-by-row to drain the good rows and evict the
  // poison so it can't wedge the queue indefinitely.
  const bumped = bumpJournalQueueAttempts(queue);
  const anyExhausted = bumped.entries.some((e) => (e.attempts ?? 0) >= MAX_JOURNAL_FLUSH_ATTEMPTS);
  if (!anyExhausted) {
    return {
      flushedIds: [],
      droppedPoisonIds: [],
      remaining: bumped,
      dropQueue: false,
      lastError: msg,
    };
  }

  const flushedIds: string[] = [];
  const droppedPoisonIds: string[] = [];
  const survivors: JournalQueuedUpsert[] = [];
  for (const entry of bumped.entries) {
    const id = String(entry.row.id);
    const { error: rowErr } = await supabase
      .from("nutrition_entries")
      .upsert([entry.row], { onConflict: "id" });
    if (!rowErr) {
      flushedIds.push(id);
      continue;
    }
    if (
      isPermissionDenied(rowErr as { message?: string; code?: string }) ||
      (entry.attempts ?? 0) >= MAX_JOURNAL_FLUSH_ATTEMPTS
    ) {
      // Genuinely un-writable: terminal RLS on this row, or it has exhausted its
      // retry budget. Evict it so the rest of the queue can drain.
      droppedPoisonIds.push(id);
      continue;
    }
    survivors.push(entry);
  }

  return {
    flushedIds,
    droppedPoisonIds,
    remaining: { version: 1, entries: survivors },
    dropQueue: false,
    lastError: msg,
  };
}

/**
 * Reconcile the stored queue after a flush. Callers re-load the queue (to
 * capture anything enqueued during the flush round-trip) and pass it here with
 * the snapshot that was sent, so concurrent enqueues are never clobbered.
 */
export function reconcileQueueAfterFlush(
  sent: JournalWriteQueue,
  latest: JournalWriteQueue,
  result: FlushJournalWriteQueueResult,
): JournalWriteQueue {
  const sentIds = new Set(sent.entries.map((e) => String(e.row.id)));
  if (result.dropQueue) {
    // Terminal RLS denial for the sent snapshot — drop those ids but keep any
    // rows enqueued mid-flight (they age out via their own attempt cap).
    return {
      version: 1,
      entries: latest.entries.filter((e) => !sentIds.has(String(e.row.id))),
    };
  }
  // Survivors (with bumped attempts) are authoritative for the sent ids; overlay
  // any genuinely new rows that were enqueued during the flush round-trip.
  const byId = new Map(result.remaining.entries.map((e) => [String(e.row.id), e]));
  for (const e of latest.entries) {
    const id = String(e.row.id);
    if (sentIds.has(id)) continue;
    byId.set(id, e);
  }
  return { version: 1, entries: [...byId.values()] };
}

/** Remove specific ids from the queue after a direct write succeeded. */
export function ackJournalQueuedIds(
  queue: JournalWriteQueue,
  ids: readonly string[],
): JournalWriteQueue {
  return removeJournalQueuedIds(queue, ids);
}
