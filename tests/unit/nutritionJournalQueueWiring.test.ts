/**
 * ENG-1125 web nutrition journal queue wiring, extended 2026-07-06 (ENG-1466
 * — web port of mobile's write-ahead fix, ENG-1447).
 *
 * `updateLoggedMeal` (edit) keeps the pre-existing optimistic +
 * enqueue-ON-FAILURE shape (matches mobile: write-ahead targets the
 * "committed log vanishes" P0 on the insert/log-commit path, not edit).
 *
 * `addLoggedMealForDate` (single log) and `addLoggedMealsForDate` (bulk
 * copy/duplicate) no longer call `enqueueFailedUpsert` inline — they
 * delegate to `useWebJournalWriteAhead`'s `writeAhead`, which enqueues to
 * the SAME durable localStorage queue BEFORE attempting the network upsert
 * (write-ahead, not write-after-failure), races a bounded timeout, and acks
 * the confirmed ids on success. This file pins both halves of that split.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1125 web nutrition journal queue wiring", () => {
  const src = read("src/context/appData/useNutritionJournalState.ts");
  const hookSrc = read("src/hooks/useWebJournalWriteAhead.ts");

  it("addLoggedMealForDate (single log) delegates the durable write to writeAhead, not an inline upsert", () => {
    expect(src).toMatch(/const addLoggedMealForDate = useCallback/);
    const idx = src.indexOf("const addLoggedMealForDate");
    const slice = src.slice(idx, idx + 3000);
    // Fire-and-forget (the function returns the id synchronously) but the
    // durable write still routes through writeAhead — not an inline
    // `.insert()`/`.upsert()` in the context file itself.
    expect(slice).toMatch(/writeAhead\(resolvedDateKey,\s*\[row\]\)/);
    expect(slice).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.insert/);
  });

  it("addLoggedMealsForDate (bulk copy/duplicate) delegates the durable write to writeAhead, not an inline insert", () => {
    expect(src).toMatch(/const addLoggedMealsForDate = useCallback/);
    const idx = src.indexOf("const addLoggedMealsForDate");
    const slice = src.slice(idx, idx + 2500);
    expect(slice).toMatch(/await\s+writeAhead\(dayKey,\s*rows\)/);
    expect(slice).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.insert/);
    expect(slice).not.toMatch(/setNutritionByDay\(prevSnapshot\)/);
  });

  it("useWebJournalWriteAhead enqueues to the durable queue BEFORE attempting the network upsert, and acks on success", () => {
    expect(hookSrc).toMatch(/export function useWebJournalWriteAhead/);
    const idx = hookSrc.indexOf("const writeAhead = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = hookSrc.slice(idx, idx + 2000);
    const enqueueIdx = slice.search(/writeAheadEnqueue\(/);
    const upsertIdx = slice.search(/from\(["']nutrition_entries["']\)\s*\.upsert/);
    expect(enqueueIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(-1);
    // Ordering: enqueue call textually precedes the upsert call.
    expect(enqueueIdx).toBeLessThan(upsertIdx);
    // A confirmed write acks off the queue.
    expect(slice).toMatch(/ackWrittenIds\(/);
    // Timeout race — a hung fetch cannot hold the loss window open forever.
    expect(slice).toMatch(/withUpsertTimeout\(/);
    expect(slice).toMatch(/UPSERT_TIMEOUT/);
  });

  it("useWebJournalWriteAhead uses the SAME durable queue/key as the failure-path retry queue (no fragmentation)", () => {
    expect(hookSrc).toMatch(
      /loadJournalWriteQueue,\s*\n\s*saveJournalWriteQueue,\s*\n\}\s*from\s*["']\.\.\/lib\/nutrition\/journalWriteQueueStorage\.web\.ts["']/,
    );
    expect(src).toMatch(
      /loadJournalWriteQueue,\s*\n\s*saveJournalWriteQueue,\s*\n\}\s*from\s*["']\.\.\/\.\.\/lib\/nutrition\/journalWriteQueueStorage\.web\.ts["']/,
    );
  });

  it("queues failed meal updates instead of rolling back (edit path unchanged by write-ahead)", () => {
    expect(src).toMatch(/const updateLoggedMeal = useCallback/);
    const idx = src.indexOf("const updateLoggedMeal");
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toMatch(/enqueueFailedUpsert/);
    expect(slice).not.toMatch(/setNutritionByDay\(prevSnapshot\)/);
  });

  it("still surfaces the offline-save toast copy for a failed/timed-out write-ahead upsert", () => {
    expect(hookSrc).toMatch(/Saved on this device — we'll sync when you're back online/);
  });
});
