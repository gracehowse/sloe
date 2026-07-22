/**
 * 2026-05-08 data-loss hotfix, extended 2026-07-06 (ENG-1447 write-ahead
 * fix) — pin every meal-add path in the Today screen to call
 * `persistMealsImmediate` (or its update sibling) right after `setByDay`,
 * AND pin that the durable write goes through the write-ahead helper
 * (`useJournalWriteAhead`'s `writeAhead`) rather than an inline Supabase
 * call. Pre-2026-05-08, the add paths wrote only to local state and relied
 * on a fragile 600ms debounced effect to drain to Supabase — most meals
 * never made it to the server, costing ~25 days of journal data on a
 * TestFlight reinstall. The 2026-05-08 fix made persistence immediate but
 * still write-AFTER-attempt (queue only gained a row once the network
 * upsert had already rejected, no timeout) — a kill during a hung upsert
 * silently reverted a committed log on relaunch (ENG-1447's P0). The
 * write-ahead fix enqueues before attempting the network write and acks on
 * confirmed success; this file pins that shape.
 *
 * If a future agent adds a new meal-add path, removes a persistence call,
 * or routes a write-ahead call site back through an inline Supabase call,
 * this test surfaces it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);
// ENG (2026-06-12, launch-audit P1-1/P1-2) — the per-column row shape
// (`canonicalNutritionEntrySource`, `recipe_id`, `eaten_at`, `date_key`) moved
// out of the inline literal in `persistMealsImmediate` into the single shared
// row-builder so the immediate path and the 600ms backstop cannot diverge on
// the upsert column set. Pin the builder file too, not just the call site.
const ROW_BUILDER_SRC = readFileSync(
  resolve(REPO, "apps/mobile/lib/nutritionEntryRow.ts"),
  "utf8",
);
// ENG-1447 — the write-ahead sequencing (enqueue-before-upsert, timeout
// race, ack-on-success) lives in the hook TodayScreen delegates to, not in
// TodayScreen itself (screen-budget pinned). Pin the hook's shape too.
const WRITE_AHEAD_HOOK_SRC = readFileSync(
  resolve(REPO, "apps/mobile/hooks/useJournalWriteAhead.ts"),
  "utf8",
);
const WRITE_AHEAD_LIB_SRC = readFileSync(
  resolve(REPO, "src/lib/nutrition/journalWriteAhead.ts"),
  "utf8",
);
// ENG-1522 — insertClonedRowsIntoDay (copy meal / duplicate day) was
// extracted to useCopyDuplicateMeal so the honest persisted/failed
// reporting fix didn't grow this pinned screen-budget file. Pin its shape
// where it now lives, same pattern as the write-ahead hook above.
const COPY_DUPLICATE_HOOK_SRC = readFileSync(
  resolve(REPO, "apps/mobile/hooks/useCopyDuplicateMeal.ts"),
  "utf8",
);
// ENG-1475 — the `nutrition_entries` boot-window fetch + write-ahead-queue
// merge (formerly inline in `TodayScreen.loadJournal`) moved into the
// shared `NutritionJournalProvider` so Today and Progress read/write ONE
// journal instead of two independently-drifting copies. Pin its shape
// where it now lives, same pattern as the other extracted-hook pins above.
const NUTRITION_JOURNAL_CONTEXT_SRC = readFileSync(
  resolve(REPO, "apps/mobile/context/nutritionJournal.tsx"),
  "utf8",
);

describe("Today journal — every meal-add path persists to Supabase immediately", () => {
  it("declares persistMealsImmediate helper that delegates to the write-ahead hook", () => {
    expect(SRC).toMatch(/const\s+persistMealsImmediate\s*=\s*useCallback/);
    const idx = SRC.indexOf("const persistMealsImmediate");
    const slice = SRC.slice(idx, idx + 4000);
    // Rows come from the single shared builder (no inline column literal that
    // could drift from the backstop).
    expect(slice).toMatch(
      /meals\.map\(\(m\)\s*=>\s*buildNutritionEntryRow\(m,\s*targetDayKey,\s*userId,\s*profileTimeZone\)/,
    );
    // ENG-1447 — the durable write goes through `writeAhead`, not an inline
    // `supabase.from("nutrition_entries").upsert(...)` in the screen itself.
    expect(slice).toMatch(/await\s+writeAhead\(targetDayKey,\s*dbRows\)/);
    expect(slice).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.upsert/);
  });

  it("useJournalWriteAhead enqueues to the durable queue BEFORE attempting the network upsert, and acks on success", () => {
    expect(WRITE_AHEAD_HOOK_SRC).toMatch(/export function useJournalWriteAhead/);
    const idx = WRITE_AHEAD_HOOK_SRC.indexOf("const writeAhead = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = WRITE_AHEAD_HOOK_SRC.slice(idx, idx + 2000);
    const enqueueIdx = slice.search(/writeAheadEnqueue\(/);
    const upsertIdx = slice.search(/from\(["']nutrition_entries["']\)\s*\.upsert/);
    expect(enqueueIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(-1);
    // Ordering: enqueue call textually precedes the upsert call.
    expect(enqueueIdx).toBeLessThan(upsertIdx);
    // A confirmed write acks off the queue (previously dead code — nothing
    // called `ackJournalQueuedIds` before ENG-1447).
    expect(slice).toMatch(/ackWrittenIds\(/);
    // Timeout race — a hung fetch cannot hold the loss window open forever.
    expect(slice).toMatch(/withUpsertTimeout\(/);
    expect(slice).toMatch(/UPSERT_TIMEOUT/);
  });

  it("journalWriteAhead.ts is the single source of the write-ahead ordering primitives (shared, platform-agnostic)", () => {
    expect(WRITE_AHEAD_LIB_SRC).toMatch(/export async function writeAheadEnqueue/);
    expect(WRITE_AHEAD_LIB_SRC).toMatch(/export async function withUpsertTimeout/);
    expect(WRITE_AHEAD_LIB_SRC).toMatch(/export async function ackWrittenIds/);
    expect(WRITE_AHEAD_LIB_SRC).toMatch(/export function queueRowsAsByDayFallback/);
    // Must not reach into mobile- or web-specific paths (shared-code
    // boundary) — no actual import statement pulling in a platform module
    // (matched against real `import ... from "..."` lines only, so a
    // doc-comment mentioning "mobile" or "AsyncStorage" in prose is fine).
    const importLines = WRITE_AHEAD_LIB_SRC.split("\n").filter((l) => l.trim().startsWith("import "));
    for (const line of importLines) {
      expect(line).not.toMatch(/apps\/mobile/);
      expect(line).not.toMatch(/AsyncStorage/);
      expect(line).not.toMatch(/react-native/);
    }
  });

  it("the shared row-builder is the source of the canonical source, recipe_id and eaten_at columns", () => {
    // These columns moved out of the inline literal into the builder — pin
    // them where they now live so dropping `eaten_at`/`recipe_id`/the
    // canonical source from a write still fails a test.
    expect(ROW_BUILDER_SRC).toMatch(/canonicalNutritionEntrySource/);
    expect(ROW_BUILDER_SRC).toMatch(/recipe_id:\s*meal\.recipeId/);
    expect(ROW_BUILDER_SRC).toMatch(/eaten_at:\s*eatenAt/);
    // date_key is the eaten-derived attribution, not a hard-coded anchor.
    expect(ROW_BUILDER_SRC).toMatch(/nutritionEntryDateKeyAndEatenAt/);
  });

  it("declares persistMealUpdateImmediate helper for edit-meal", () => {
    expect(SRC).toMatch(/const\s+persistMealUpdateImmediate\s*=\s*useCallback/);
    const idx = SRC.indexOf("const persistMealUpdateImmediate");
    const slice = SRC.slice(idx, idx + 2500);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.update/);
    expect(slice).toMatch(/\.eq\(["']id["']/);
    expect(slice).toMatch(/\.eq\(["']user_id["']/);
    // ENG-1125 — failed updates queue for retry instead of rolling back UI.
    expect(slice).toMatch(/enqueueJournalUpserts/);
    expect(slice).toMatch(/Saved on this device/);
  });

  it("insertClonedRowsIntoDay (copy/duplicate) delegates to writeAhead — no inline insert, no pre-write haptic", () => {
    expect(COPY_DUPLICATE_HOOK_SRC).toMatch(/const\s+insertClonedRowsIntoDay\s*=\s*useCallback/);
    const idx = COPY_DUPLICATE_HOOK_SRC.indexOf("const insertClonedRowsIntoDay");
    const slice = COPY_DUPLICATE_HOOK_SRC.slice(idx, idx + 3500);
    // ENG-1447 — routed through the same write-ahead helper as every other
    // log-commit path; no more direct `.insert()` (which had no timeout and
    // wasn't upsert-safe against a retried flush) and no raw
    // `enqueueJournalUpserts` call in the screen itself.
    expect(slice).toMatch(/await\s+writeAhead\(targetDayKey,\s*dbRows/);
    expect(slice).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.insert/);
    expect(slice).not.toMatch(/Couldn't copy/);
    // ENG-1447 part 5 — the confirm haptic must NOT fire before the write is
    // at least durably queued: assert it's wired through writeAhead's
    // `onEnqueued` option, and that this is the ONLY place in the function
    // that calls it (no separate, earlier, unconditional call right after
    // the optimistic `setByDay`).
    expect(slice).toMatch(/onEnqueued:\s*\(\)\s*=>\s*confirmLogHapticRef\.current\(\)/);
    const hapticCallCount = (slice.match(/confirmLogHapticRef\.current\(\)/g) ?? []).length;
    expect(hapticCallCount).toBe(1);
  });

  it("addMeal calls persistMealsImmediate (Quick Entry path)", () => {
    const idx = SRC.indexOf("const addMeal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 1500);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("saveEditMeal calls persistMealUpdateImmediate", () => {
    const idx = SRC.indexOf("const saveEditMeal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    // ENG-772 eaten_at resolution pushed the callback past 2k chars.
    const slice = SRC.slice(idx, idx + 4000);
    expect(slice).toMatch(/persistMealUpdateImmediate\(/);
  });

  it("logSavedMealFromPanel calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("logSavedMealFromPanel");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(targetDayKey,\s*newMeals\)/);
  });

  it("logSavedMealFromSlotHeader calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("logSavedMealFromSlotHeader");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(targetDayKey,\s*newMeals\)/);
  });

  it("logHistoryItemToSlot (Quick add / Eat-again) calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("const logHistoryItemToSlot = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("commitAiLoggedItems (AI photo/voice commit) calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("const commitAiLoggedItems = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*newMeals\)/);
  });

  it("barcode onScan host (in (tabs)/index.tsx) calls persistMealsImmediate", () => {
    // The host wraps BarcodeScannerModal and on success appends a
    // single meal to byDay. Find the BarcodeScannerModal usage and
    // assert persistMealsImmediate is nearby.
    const idx = SRC.indexOf("<BarcodeScannerModal");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 4000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("id-format gating lives in the shared builder, not a screen-local regex", () => {
    // The 2026-05-08 data-loss hotfix lifted a per-render UUID_RE to module
    // scope; the launch-audit P1-2 consolidation then moved id re-minting
    // into `buildNutritionEntryRow` (NUTRITION_ENTRY_UUID_RE). Pin that the
    // screen no longer carries its own copy — a reintroduced local regex
    // would mean a second, divergeable id-gating path.
    expect(SRC).not.toMatch(/const\s+UUID_RE\s*=/);
    expect(SRC).toMatch(/buildNutritionEntryRow\(/);
  });

  it("ENG-1447 part 3/4 — flushQueuedJournalWrites delegates to the hook's flushQueue and surfaces drops", () => {
    const idx = SRC.indexOf("const flushQueuedJournalWrites = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 1200);
    expect(slice).toMatch(/await\s+flushQueue\(\)/);
    // A successful flush requests a journal reload so flushed rows re-hydrate
    // through the normal merge path.
    expect(slice).toMatch(/requestJournalRefresh\(\)/);
    // Poison evictions / terminal drops are surfaced, not silently dropped
    // (pre-ENG-1447: `droppedPoisonIds` / `dropQueue` were computed by
    // `flushJournalWriteQueue` but no caller ever read them).
    expect(slice).toMatch(/reportDroppedJournalWrites\(/);
  });

  it("ENG-1475 — TodayScreen.loadJournal delegates the nutrition_entries fetch to the shared journal context's refreshJournal, not an inline query", () => {
    const idx = SRC.indexOf("const loadJournal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 4500);
    // Delegates to the ONE shared journal (context/nutritionJournal.tsx) —
    // no more inline `nutrition_entries` SELECT / `mergeJournalByDay` call
    // in the screen itself. This is the actual ENG-1475 fix: Progress reads
    // the SAME state Today writes to, instead of independently re-fetching
    // into a screen-local copy that could desync ("iOS says 0/3 days
    // logged, web says 1/3").
    // Raced in the SAME `Promise.all` as `meal_plan_days` (not a separate
    // sequential `await`) so overall wall time stays the max of the two
    // caps, not their sum — see the comment immediately above this call
    // site in TodayScreen.tsx.
    expect(slice).toMatch(/=\s*await\s+Promise\.all\(\[/);
    const promiseAllIdx = slice.search(/=\s*await\s+Promise\.all\(\[/);
    expect(slice.slice(promiseAllIdx)).toMatch(/refreshSharedJournal\(\)/);
    expect(slice).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.select/);
    expect(slice).not.toMatch(/mergeJournalByDay\(/);
  });

  it("ENG-1475 — the shared journal context (not TodayScreen) hydrates write-ahead-queued rows into byDay before/alongside the server merge", () => {
    // Formerly pinned inline in `TodayScreen.loadJournal` (ENG-1447 part
    // 3); moved verbatim into `refreshJournal` when the fetch relocated to
    // the shared provider (ENG-1475) — same merge shape, new home.
    const idx = NUTRITION_JOURNAL_CONTEXT_SRC.indexOf("const refreshJournal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const mergeIdx = NUTRITION_JOURNAL_CONTEXT_SRC.indexOf("mergeJournalByDay(loaded", idx);
    expect(mergeIdx).toBeGreaterThan(-1);
    const slice = NUTRITION_JOURNAL_CONTEXT_SRC.slice(idx, mergeIdx + 200);
    expect(slice).toMatch(/loadQueuedByDay\(\)/);
    // The queued rows are merged in as a second "local" layer underneath
    // whatever's already in memory, so they survive even when `prev` is `{}`
    // (a genuine cold start) — not merely `mergeJournalByDay(loaded, prev)`.
    expect(slice).toMatch(
      /mergeJournalByDay\(loaded,\s*mergeJournalByDay\(queuedMeals,\s*prev\)\)/,
    );
  });

  it("ENG-1475 — refreshJournal never blanks byDay on a SELECT error (state is shared now; the old Today-local blank-on-error would wipe Progress's data too)", () => {
    const idx = NUTRITION_JOURNAL_CONTEXT_SRC.indexOf("const refreshJournal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const nextFnIdx = NUTRITION_JOURNAL_CONTEXT_SRC.indexOf("const ensureJournalHistory", idx);
    const slice = NUTRITION_JOURNAL_CONTEXT_SRC.slice(idx, nextFnIdx > -1 ? nextFnIdx : idx + 4000);
    expect(slice).not.toMatch(/setByDay\(\{\}\)/);
  });

  it("ENG-1475 — Progress reads `byDay` from the shared context, not its own nutrition_entries SELECT", () => {
    const PROGRESS_SRC = readFileSync(
      resolve(REPO, "apps/mobile/app/(tabs)/progress.tsx"),
      "utf8",
    );
    expect(PROGRESS_SRC).toMatch(/const\s*\{\s*byDay,\s*ensureJournalHistory\s*\}\s*=\s*useNutritionJournal\(\)/);
    expect(PROGRESS_SRC).not.toMatch(/from\(["']nutrition_entries["']\)\s*\.select/);
    // The 90-day window is a merge-only backfill call, not a replace.
    expect(PROGRESS_SRC).toMatch(/void\s+ensureJournalHistory\(ninetyDaysAgo\)/);
  });
});
