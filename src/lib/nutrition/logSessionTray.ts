/**
 * logSessionTray — pure shared logic for the log-sheet session tray
 * (ENG-1643). Shared across web (`src/app/components/suppr/log-session-tray.tsx`)
 * and mobile (`apps/mobile/components/today/LogSessionTray.tsx`) so the running
 * count + kcal/macro totals + default meal-name behave identically on both
 * platforms.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`.
 *
 * The tray is a RECEIPT, never a stage: every item it holds was already
 * committed to the journal through the existing one-commit path (ENG-1462),
 * so each `LogSessionTrayItem` carries the committed row's `mealId`. There is
 * no pending state — closing the sheet in any state loses nothing.
 *
 * This module owns NO React state, NO persistence, NO Date/analytics — it only
 * knows how to sum the tray and name the resulting usual meal. It reuses the
 * rounding/clamping conventions of the retired `buildMealCart` module
 * (`git show c6f0347a:src/lib/nutrition/buildMealCart.ts`): kcal rounds to a
 * whole number, macros to one decimal, and NaN/negative inputs clamp to 0 so a
 * single malformed item can never poison the whole total.
 */
import type { SavedMealItem } from "./savedMeals.ts";

/**
 * A single item committed this sheet-session. `mealId` is the id of the
 * committed journal row — a tray item without a committed row id is
 * unrepresentable by design (the receipt can only hold real, already-logged
 * food). Macros are the ALREADY-ROUNDED committed numbers (what the journal
 * row stores), so the tray never re-derives nutrition.
 */
export interface LogSessionTrayItem {
  /** Committed journal-row id — the handle the per-item Undo removes. */
  mealId: string;
  /** Display title (the food/meal name as logged). */
  title: string;
  /** Committed kcal (already rounded). */
  kcal: number;
  /** Committed protein (g). */
  protein: number;
  /** Committed carbs (g). */
  carbs: number;
  /** Committed fat (g). */
  fat: number;
  /** Slot the item committed to (Breakfast / Lunch / Dinner / Snacks). */
  slot: string;
  /** ENG-1417/1502 per-item trust bit; absent = unverified (honest `~`). */
  kcalIsVerified?: boolean;
  /** Optional provenance label carried from the commit result. */
  source?: string;
}

/**
 * Props for the presentational session tray, shared byte-for-byte across web
 * (`log-session-tray.tsx`) and mobile (`LogSessionTray.tsx`) so the two stay in
 * lockstep. The host owns the state (via `useLogSessionTray`) and threads it in;
 * the tray owns only its collapsed/expanded UI state.
 */
export interface LogSessionTrayProps {
  /** Items committed this session, oldest first. */
  items: LogSessionTrayItem[];
  /** Ids whose Undo is in flight — the row's ✕ disables while present. */
  pendingUndoIds: readonly string[];
  /** Per-item Undo — deletes the committed row via the host's removal path. */
  onUndo: (item: LogSessionTrayItem) => void | Promise<void>;
  /** Primary Done — closes the sheet (everything is already committed). */
  onDone: () => void;
  /** Save-as-usual-meal — rendered only at count ≥ 2 (opens the seeded save flow). */
  onSaveMeal?: () => void;
}

/**
 * The result of a synchronous LogSheet commit — carries the committed
 * journal-row `id` plus everything the tray needs. Returned by both platforms'
 * commit hooks (`useLogSheetFoodCommits` web / `useLogSheetCommits` mobile) so
 * a tray append is a trivial `id → mealId` map (`committedToTrayItem`) with no
 * nutrition re-derivation.
 */
export interface CommittedLogItem {
  id: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  slot: string;
  kcalIsVerified: boolean;
}

/** Map a commit result to a tray item (`id → mealId`). The single place the
 *  two shapes are bridged, so web + mobile can never map differently. */
export function committedToTrayItem(c: CommittedLogItem): LogSessionTrayItem {
  return {
    mealId: c.id,
    title: c.title,
    kcal: c.kcal,
    protein: c.protein,
    carbs: c.carbs,
    fat: c.fat,
    slot: c.slot,
    kcalIsVerified: c.kcalIsVerified,
  };
}

export interface LogSessionTrayTotals {
  /** Number of items committed this session. */
  count: number;
  /** Summed kcal, rounded to a whole number. */
  kcal: number;
  /** Summed protein (g), to one decimal. */
  protein: number;
  /** Summed carbs (g), to one decimal. */
  carbs: number;
  /** Summed fat (g), to one decimal. */
  fat: number;
}

/**
 * Sum the tray. Each item contributes its already-committed macro values;
 * kcal rounds to a whole number and macros to one decimal — matching how the
 * single-item commit path rounds, so a 1-item tray totals to exactly that
 * item's logged row. NaN/negative inputs clamp to 0. An empty tray totals to
 * all-zero with `count: 0`.
 */
export function sessionTrayTotals(
  items: readonly LogSessionTrayItem[],
): LogSessionTrayTotals {
  const acc = items.reduce(
    (a, item) => ({
      kcal: a.kcal + safeNumber(item.kcal),
      protein: a.protein + safeNumber(item.protein),
      carbs: a.carbs + safeNumber(item.carbs),
      fat: a.fat + safeNumber(item.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    count: items.length,
    kcal: Math.round(acc.kcal),
    protein: round1(acc.protein),
    carbs: round1(acc.carbs),
    fat: round1(acc.fat),
  };
}

/**
 * True only when the tray has at least one item AND every item's kcal is
 * verified (`kcalIsVerified === true`). Drives the ENG-1417 `~` trust marker:
 * the headline total renders unqualified only when this is true, else the
 * honest `~` prefix. An empty tray is not "fully verified" (there is nothing
 * to trust), so it returns false.
 */
export function trayIsFullyVerified(
  items: readonly LogSessionTrayItem[],
): boolean {
  return items.length > 0 && items.every((i) => i.kcalIsVerified === true);
}

/**
 * True when the tray spans more than one distinct slot — the tray rows append
 * `· {Slot}` only in this case (a single-slot session doesn't need to repeat
 * the slot on every row).
 */
export function trayIsMultiSlot(items: readonly LogSessionTrayItem[]): boolean {
  if (items.length < 2) return false;
  const first = items[0]?.slot;
  return items.some((i) => i.slot !== first);
}

/**
 * Default "save as usual meal" name (guidance only; used when the save flow
 * supports a name):
 *   - single slot → `"{n}-item {slot}"` (lower-cased slot), e.g. `"3-item dinner"`
 *   - mixed slots → `"{n}-item meal"`.
 * An empty tray returns `""` (the host guards against saving < 2 items).
 */
export function resolveUsualMealName(
  items: readonly LogSessionTrayItem[],
): string {
  const n = items.length;
  if (n === 0) return "";
  if (trayIsMultiSlot(items)) return `${n}-item meal`;
  const slot = (items[0]?.slot ?? "").trim().toLowerCase();
  return slot ? `${n}-item ${slot}` : `${n}-item meal`;
}

/**
 * Map the tray's committed items into the `SaveMealSheet` / `SaveMealDialog`
 * seed shape (§4.6), reusing the same clamping/rounding the per-slot save path
 * uses (`openSaveMealSheetForSlot`): calories → non-negative int, macros →
 * non-negative 1dp, `portionMultiplier: 1` (macros are already scaled). Micros
 * are not carried — the tray receipt holds only kcal + P/C/F, so the seeded
 * usual meal reflects exactly what the tray shows.
 */
export function sessionTrayToSavedMealItems(
  items: readonly LogSessionTrayItem[],
): Omit<SavedMealItem, "id" | "position">[] {
  return items.map((i) => {
    const item: Omit<SavedMealItem, "id" | "position"> = {
      recipeTitle: i.title,
      calories: Math.max(0, Math.round(safeNumber(i.kcal))),
      protein: Math.max(0, round1(safeNumber(i.protein))),
      carbs: Math.max(0, round1(safeNumber(i.carbs))),
      fat: Math.max(0, round1(safeNumber(i.fat))),
      portionMultiplier: 1,
    };
    if (i.source) item.source = i.source;
    return item;
  });
}

function safeNumber(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
