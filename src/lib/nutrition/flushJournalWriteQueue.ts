import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyJournalWriteQueue,
  journalQueueUpsertRows,
  removeJournalQueuedIds,
  type JournalWriteQueue,
} from "./journalWriteQueue";

export type FlushJournalWriteQueueResult = {
  flushedIds: string[];
  remaining: JournalWriteQueue;
  lastError: string | null;
};

/** Retry queued nutrition_entries upserts. Returns ids that succeeded. */
export async function flushJournalWriteQueue(
  supabase: SupabaseClient,
  queue: JournalWriteQueue,
): Promise<FlushJournalWriteQueueResult> {
  const rows = journalQueueUpsertRows(queue);
  if (rows.length === 0) {
    return { flushedIds: [], remaining: queue, lastError: null };
  }

  const { error } = await supabase
    .from("nutrition_entries")
    .upsert(rows, { onConflict: "id" });

  if (!error) {
    const flushedIds = rows.map((r) => String(r.id));
    return {
      flushedIds,
      remaining: emptyJournalWriteQueue(),
      lastError: null,
    };
  }

  const msg = error.message ?? "unknown error";
  // Hard auth / schema failures — drop the queue so we don't spin forever.
  if (
    msg.includes("JWT") ||
    msg.includes("permission denied") ||
    (error as { code?: string }).code === "42501"
  ) {
    return { flushedIds: [], remaining: emptyJournalWriteQueue(), lastError: msg };
  }

  return { flushedIds: [], remaining: queue, lastError: msg };
}

/** Remove specific ids from the queue after a direct write succeeded. */
export function ackJournalQueuedIds(
  queue: JournalWriteQueue,
  ids: readonly string[],
): JournalWriteQueue {
  return removeJournalQueuedIds(queue, ids);
}
