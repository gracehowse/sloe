"use client";

import { useCallback, useRef, useState } from "react";
import type { LogSessionTrayItem } from "./logSessionTray.ts";

/**
 * ENG-1643 — the log-session tray's presentation state, shared byte-for-byte
 * across web (`NutritionTracker.tsx`) and mobile (`useLogSheetCommits.ts`).
 * Pure React (no platform APIs, no analytics, no Supabase) so both platforms
 * import the same hook and can never drift.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`.
 *
 * The tray is a receipt of items ALREADY committed this sheet-session:
 *  - `append` pushes the result of a synchronous commit (which carries the
 *    committed `mealId`). Appending anything without a `mealId` is a contract
 *    violation the caller must not make (the item type forbids it).
 *  - `undo` deletes the committed journal row via the host's existing removal
 *    path (`deleteMeal` mobile / `removeLoggedMeal` web), then drops the row
 *    from tray state. The row's ✕ is disabled while its removal is in flight
 *    (`pendingUndoIds`) so a double-tap can't double-submit.
 *  - `reset` clears the tray (presentation only — it NEVER un-commits
 *    anything; the logged items live on in Today as normal editable rows).
 *    The sheet-close effect calls this.
 */
export interface UseLogSessionTrayArgs {
  /** Host removal path for the committed row. May be sync-void (the real
   *  hosts) or return a promise (tests); either way the in-flight guard holds
   *  until it settles. */
  onRemoveItem: (mealId: string) => void | Promise<void>;
}

export interface UseLogSessionTrayResult {
  items: LogSessionTrayItem[];
  pendingUndoIds: readonly string[];
  append: (item: LogSessionTrayItem) => void;
  undo: (item: LogSessionTrayItem) => Promise<void>;
  reset: () => void;
}

export function useLogSessionTray({
  onRemoveItem,
}: UseLogSessionTrayArgs): UseLogSessionTrayResult {
  const [items, setItems] = useState<LogSessionTrayItem[]>([]);
  const [pendingUndoIds, setPendingUndoIds] = useState<string[]>([]);
  // Ref mirror of the in-flight set so the double-submit guard reads a fresh
  // value even within the same tick (before the state update flushes).
  const pendingRef = useRef<Set<string>>(new Set());

  const append = useCallback((item: LogSessionTrayItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const undo = useCallback(
    async (item: LogSessionTrayItem) => {
      const { mealId } = item;
      if (pendingRef.current.has(mealId)) return; // no double-submit
      pendingRef.current.add(mealId);
      setPendingUndoIds((prev) => [...prev, mealId]);
      try {
        await Promise.resolve(onRemoveItem(mealId));
        setItems((prev) => prev.filter((i) => i.mealId !== mealId));
      } finally {
        pendingRef.current.delete(mealId);
        setPendingUndoIds((prev) => prev.filter((id) => id !== mealId));
      }
    },
    [onRemoveItem],
  );

  const reset = useCallback(() => {
    pendingRef.current.clear();
    setItems([]);
    setPendingUndoIds([]);
  }, []);

  return { items, pendingUndoIds, append, undo, reset };
}
