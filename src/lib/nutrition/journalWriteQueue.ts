/**
 * ENG-1125 — durable offline write queue for failed nutrition journal upserts.
 *
 * When a meal log upsert fails (network, transient 5xx), keep the optimistic
 * UI and enqueue the row for retry instead of rolling back and losing the entry.
 */

export const JOURNAL_WRITE_QUEUE_STORAGE_KEY = "suppr-journal-write-queue-v1";

/**
 * After this many failed flush attempts a queued row is treated as poison
 * (e.g. an FK to a recipe that no longer exists) and evicted via the row-by-row
 * isolation pass, so one bad row can't wedge the whole queue forever.
 */
export const MAX_JOURNAL_FLUSH_ATTEMPTS = 5;

export type JournalQueuedUpsert = {
  kind: "upsert";
  queuedAt: string;
  dayKey: string;
  row: Record<string, unknown>;
  /** Failed flush attempts so far. Reset to 0 when the row is (re)enqueued. */
  attempts: number;
};

export type JournalWriteQueue = {
  version: 1;
  entries: JournalQueuedUpsert[];
};

export function emptyJournalWriteQueue(): JournalWriteQueue {
  return { version: 1, entries: [] };
}

export function parseJournalWriteQueue(raw: unknown): JournalWriteQueue {
  if (!raw || typeof raw !== "object") return emptyJournalWriteQueue();
  const o = raw as Partial<JournalWriteQueue>;
  if (o.version !== 1 || !Array.isArray(o.entries)) return emptyJournalWriteQueue();
  const entries = o.entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Partial<JournalQueuedUpsert>;
      if (e.kind !== "upsert") return null;
      if (typeof e.dayKey !== "string" || !e.dayKey.trim()) return null;
      if (!e.row || typeof e.row !== "object") return null;
      const id = (e.row as { id?: unknown }).id;
      if (typeof id !== "string" || !id.trim()) return null;
      const rawAttempts = (e as { attempts?: unknown }).attempts;
      const attempts =
        typeof rawAttempts === "number" && Number.isFinite(rawAttempts) && rawAttempts > 0
          ? Math.floor(rawAttempts)
          : 0;
      return {
        kind: "upsert" as const,
        queuedAt: typeof e.queuedAt === "string" ? e.queuedAt : new Date().toISOString(),
        dayKey: e.dayKey.trim(),
        row: e.row as Record<string, unknown>,
        attempts,
      };
    })
    .filter((e): e is JournalQueuedUpsert => Boolean(e));
  return { version: 1, entries };
}

/** Enqueue upsert rows; later rows with the same meal id replace earlier ones. */
export function enqueueJournalUpserts(
  queue: JournalWriteQueue,
  dayKey: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): JournalWriteQueue {
  if (rows.length === 0) return queue;
  const byId = new Map(queue.entries.map((e) => [String(e.row.id), e]));
  const now = new Date().toISOString();
  for (const row of rows) {
    const id = String(row.id ?? "");
    if (!id) continue;
    // Re-enqueueing carries fresh row data, so reset the attempt counter —
    // an edit that fixes a previously-poison row deserves a clean retry budget.
    byId.set(id, { kind: "upsert", queuedAt: now, dayKey, row, attempts: 0 });
  }
  return { version: 1, entries: [...byId.values()] };
}

/** Increment the failed-attempt counter on every queued entry. */
export function bumpJournalQueueAttempts(queue: JournalWriteQueue): JournalWriteQueue {
  if (queue.entries.length === 0) return queue;
  return {
    version: 1,
    entries: queue.entries.map((e) => ({ ...e, attempts: (e.attempts ?? 0) + 1 })),
  };
}

export function removeJournalQueuedIds(
  queue: JournalWriteQueue,
  ids: ReadonlySet<string> | readonly string[],
): JournalWriteQueue {
  const drop = ids instanceof Set ? ids : new Set(ids);
  if (drop.size === 0) return queue;
  const entries = queue.entries.filter((e) => !drop.has(String(e.row.id)));
  if (entries.length === queue.entries.length) return queue;
  return { version: 1, entries };
}

export function journalQueueUpsertRows(queue: JournalWriteQueue): Record<string, unknown>[] {
  return queue.entries.map((e) => e.row);
}
