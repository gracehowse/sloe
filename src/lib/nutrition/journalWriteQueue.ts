/**
 * ENG-1125 — durable offline write queue for failed nutrition journal upserts.
 *
 * When a meal log upsert fails (network, transient 5xx), keep the optimistic
 * UI and enqueue the row for retry instead of rolling back and losing the entry.
 */

export const JOURNAL_WRITE_QUEUE_STORAGE_KEY = "suppr-journal-write-queue-v1";

export type JournalQueuedUpsert = {
  kind: "upsert";
  queuedAt: string;
  dayKey: string;
  row: Record<string, unknown>;
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
      return {
        kind: "upsert" as const,
        queuedAt: typeof e.queuedAt === "string" ? e.queuedAt : new Date().toISOString(),
        dayKey: e.dayKey.trim(),
        row: e.row as Record<string, unknown>,
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
    byId.set(id, { kind: "upsert", queuedAt: now, dayKey, row });
  }
  return { version: 1, entries: [...byId.values()] };
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
