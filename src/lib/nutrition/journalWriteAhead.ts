/**
 * ENG-1447 — write-ahead persistence for the nutrition journal.
 *
 * P0 fix for "relaunch silently reverts a committed food log": every log
 * entry point was optimistic-first, fire-and-forget-persist second — the
 * AsyncStorage/localStorage write queue only gained a row AFTER the network
 * upsert rejected, the upsert itself had no timeout (a hung fetch held the
 * loss window open indefinitely), queued rows were never hydrated back into
 * the in-memory journal on cold start, and a successful flush never merged
 * its rows back into state. A user could commit a log, background/kill the
 * app before the network round-trip resolved, and relaunch to find the meal
 * gone — with no visible error, because nothing ever surfaced the failure.
 *
 * This module is the single source of truth for the corrected sequencing:
 *
 *   1. Enqueue the row(s) to the durable write queue FIRST (synchronous,
 *      on-device, cannot race a kill) — see {@link writeAheadEnqueue}.
 *   2. Attempt the network upsert with a bounded timeout — see
 *      {@link withUpsertTimeout}. A timeout is treated identically to a
 *      network error: the row stays queued, nothing is rolled back.
 *   3. On success, ack (remove) exactly the confirmed ids from the queue —
 *      see {@link ackWrittenIds} (thin wrapper over the existing
 *      `ackJournalQueuedIds`, which was defined but never called before
 *      this fix).
 *   4. On cold start, queued-but-unflushed rows must still be visible in the
 *      journal — see {@link queueRowsAsByDayFallback}, which callers feed
 *      into `mergeJournalByDay` as the "local" argument alongside whatever
 *      is already in memory (empty on a genuine cold start).
 *
 * Platform-agnostic: mobile (AsyncStorage) and web (localStorage) both
 * inject their own queue load/save + row→meal mapping; this module never
 * reaches into `apps/mobile/*` or the DOM.
 */
import {
  emptyJournalWriteQueue,
  enqueueJournalUpserts,
  type JournalWriteQueue,
} from "./journalWriteQueue";
import { ackJournalQueuedIds } from "./flushJournalWriteQueue";

/** Queue load/save primitives, injected by the platform (AsyncStorage vs localStorage). */
export type JournalWriteQueueIO = {
  load: () => Promise<JournalWriteQueue>;
  save: (queue: JournalWriteQueue) => Promise<void>;
};

/**
 * Step 1 — write-ahead enqueue. Persists `rows` to the durable queue and
 * returns the updated queue. Callers do this BEFORE attempting the network
 * upsert (or atomically alongside the optimistic `setByDay`), so a kill
 * between "user tapped log" and "network resolved" always leaves the row
 * recoverable from storage.
 *
 * Idempotent by row id: re-enqueueing a row that's already queued (e.g. a
 * retry) replaces the earlier entry and resets its attempt counter — see
 * `enqueueJournalUpserts`.
 */
export async function writeAheadEnqueue(
  io: JournalWriteQueueIO,
  dayKey: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<JournalWriteQueue> {
  if (rows.length === 0) return io.load();
  const queue = await io.load();
  const next = enqueueJournalUpserts(queue, dayKey, rows);
  await io.save(next);
  return next;
}

/** Sentinel returned by {@link withUpsertTimeout} when the wrapped promise never settled in time. */
export const UPSERT_TIMEOUT = Symbol("journal_upsert_timeout");

export const DEFAULT_UPSERT_TIMEOUT_MS = 10_000;

/**
 * Step 2 — race an in-flight Supabase upsert against a bounded timeout. A
 * hung fetch (dead connection, backgrounded app holding a socket open, a
 * flaky carrier network) must never hold the write-ahead "still trying"
 * window open indefinitely — after `timeoutMs` the caller treats this
 * exactly like a rejected upsert: the row stays queued (already true from
 * step 1) and the "Saved on this device" path fires.
 *
 * NOTE: this does not cancel the underlying request — supabase-js/fetch has
 * no abort hook wired through the call sites today. The in-flight request
 * may still complete after the timeout fires; the row is already safe
 * either way (queued), and the next flush pass will dedupe via `onConflict:
 * "id"` if the original request eventually lands.
 */
export async function withUpsertTimeout<T>(
  // `PromiseLike`, not `Promise` — supabase-js query builders are thenable
  // (they build/execute the request lazily on `.then()`) but don't implement
  // the full `Promise` interface, so a strict `Promise<T>` parameter type
  // rejects them at the call site.
  promise: PromiseLike<T>,
  timeoutMs: number = DEFAULT_UPSERT_TIMEOUT_MS,
): Promise<T | typeof UPSERT_TIMEOUT> {
  return Promise.race([
    promise,
    new Promise<typeof UPSERT_TIMEOUT>((resolve) => {
      setTimeout(() => resolve(UPSERT_TIMEOUT), timeoutMs);
    }),
  ]);
}

/**
 * Step 3 — ack exactly the ids that were confirmed written, removing them
 * from the durable queue. Thin, testable wrapper over the existing
 * `ackJournalQueuedIds` (previously defined and never called by any
 * caller — the write-ahead rows piled up in storage forever even after a
 * successful direct write, until the next full-queue flush happened to
 * also send them).
 *
 * Callers must re-load the queue immediately before acking (not reuse a
 * stale snapshot) so a row enqueued concurrently during the network
 * round-trip is never clobbered — mirrors `reconcileQueueAfterFlush`'s
 * re-load-then-reconcile pattern.
 */
export async function ackWrittenIds(
  io: JournalWriteQueueIO,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const latest = await io.load();
  await io.save(ackJournalQueuedIds(latest, ids));
}

/**
 * Step 4 — cold-start visibility. Turns queue rows into a `ByDay`-shaped map
 * of raw row records, grouped by `dayKey`, so a caller can hand them to
 * `mergeJournalByDay(server, queueByDay)` (or merge them with whatever's
 * already in memory) and have a queued-but-unflushed meal survive a fresh
 * `loadJournal` after a relaunch — including the case where `prev` is `{}`
 * because the app was actually killed, not just backgrounded.
 *
 * Returns raw `Record<string, unknown>` rows (the exact shape queued for
 * upsert), not `JournalMeal` — mapping to the UI meal type is a platform
 * concern (mobile's `journalRowToMeal`, web's `rowToLoggedMeal`) that this
 * shared module must not import.
 */
export function queueRowsAsByDayFallback(
  queue: JournalWriteQueue,
): Record<string, Record<string, unknown>[]> {
  const byDay: Record<string, Record<string, unknown>[]> = {};
  for (const entry of queue.entries) {
    if (!byDay[entry.dayKey]) byDay[entry.dayKey] = [];
    byDay[entry.dayKey].push(entry.row);
  }
  return byDay;
}

/**
 * Convenience no-op queue for platforms/tests that want an explicit empty
 * starting point without reaching into `journalWriteQueue` directly.
 */
export function emptyQueue(): JournalWriteQueue {
  return emptyJournalWriteQueue();
}
