"use client";

/**
 * QuickAddPanel — tabbed picker for Favourites / Frequent / Recent /
 * My meals with one-tap log + star toggle.
 *
 * Parity: mirrors the mobile Quick add panel in
 * `apps/mobile/app/(tabs)/index.tsx`. Shared logic lives in
 * `src/lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`,
 * and `savedMealsLogic.ts`.
 *
 * Optimism:
 *  - Star toggles update local state immediately and revert on Supabase
 *    error. No success toast (the star fill is the confirmation).
 *  - Saved-meal create / rename / delete show optimistic rows and revert
 *    with a Sonner toast on Supabase error.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeFrequentMeals,
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryItem,
  type FoodHistoryMealLike,
} from "../../../lib/nutrition/foodHistory";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  favoriteKey,
  type FavoriteFood,
  type FavoriteFoodInput,
} from "../../../lib/nutrition/favoriteFoods";
import {
  deleteSavedMeal,
  incrementLogCount,
  listSavedMeals,
  renameSavedMeal,
  type SavedMeal,
  type SavedMealItem,
} from "../../../lib/nutrition/savedMeals";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { SavedMealsTab } from "./saved-meals-tab";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";
import { RenameSavedMealDialog } from "./rename-saved-meal-dialog";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";
import { resolveQuickAddDefaultTab } from "../../../lib/nutrition/usualMealHint";

type Tab = "saved" | "recent" | "frequent" | "favourites";

export interface QuickAddPanelProps {
  /** Journal byDay map — accepts web `LoggedMeal[]` or mobile `JournalMeal[]`. */
  byDay: Record<string, FoodHistoryMealLike[]>;
  /** The slot the user will be logging into on tap. */
  activeSlot: string;
  /** Supabase client (browser or mobile). */
  supabase: { from: (table: string) => any };
  /** Authed user id. Empty string disables favourites + saved meals persistence. */
  userId: string;
  /** Fires when the user taps `+` on a row to log the meal to `activeSlot`. */
  onLog: (meal: FoodHistoryItem) => void;
  /** Fires when the user taps `+` on a saved-meal row — receives the whole
   * combo + the slot to log to. The caller is responsible for expanding
   * `meal.items` into individual journal entries (e.g. via
   * `buildMealEntriesFromSavedMeal`) so this panel stays presentation-only. */
  onLogSavedMeal?: (meal: SavedMeal, slot: string) => void;
  /** Request that the host open the `SaveMealDialog` pre-filled with
   * `seedItems` for `slot`. Replaces the Batch 2.6 custom-event bridge
   * (audit H4, 2026-04-18). The host owns the dialog so the flow is
   * prop-driven and testable. Called by the panel when any internal UI
   * requests the dialog; today the trigger lives on the parent's
   * meal-slot header so this prop is part of the public API for parity
   * + future use. */
  onOpenSaveCombo?: (
    slot?: string,
    seedItems?: Array<Omit<SavedMealItem, "id" | "position">>,
  ) => void;
  /** Bump this number after a new saved-meal is persisted by the host to
   * trigger a refetch + auto-switch to the "My meals" tab, preserving the
   * post-save UX from Batch 2.6. */
  savedMealsRefreshToken?: number;
  /** Optional initial tab — defaults to Recent (matches prior mobile behaviour). */
  defaultTab?: Tab;
  className?: string;
}

/** Row model unified across Favourites / Frequent / Recent tabs. */
type Row = FoodHistoryItem & {
  /** DB row id when this row is (also) a favourite. */
  favoriteId?: string;
};

/**
 * Tab labels + insertion order.
 *
 * Ship M1 (2026-04-18) — "Usual meals" replaces "My meals" as the
 * canonical re-log surface, and the tab order is restructured so the
 * primary discovery path shows first: **Usual meals → Recent → Frequent
 * → Favourites**. The old labelling ("My meals") was ambiguous with the
 * broader food history tabs; "Usual meals" is concrete — "the thing I
 * saved to re-log in one tap".
 *
 * Keys intentionally ordered — `Object.keys(TAB_LABELS)` drives the
 * render sequence so a future rename does not need to touch the JSX.
 */
const TAB_LABELS: Record<Tab, string> = {
  saved: "Usual meals",
  recent: "Recent",
  frequent: "Frequent",
  favourites: "Favourites",
};

/**
 * Empty-state copy per non-saved tab. Strings preserved from before
 * audit M5 (2026-04-18) — only the rendering was moved into the shared
 * `<EmptyState />` primitive. Split into `title` + `description` where
 * the original already read as two factual sentences; otherwise the
 * whole string stays in `title`. Mirrors mobile
 * `apps/mobile/components/QuickAddPanel.tsx`.
 */
const EMPTY_COPY: Record<Exclude<Tab, "saved">, { title: string; description?: string }> = {
  favourites: {
    title: "Star meals you log often for one-tap re-logging.",
  },
  frequent: {
    title: "Your most-logged meals will show up here after a few days of tracking.",
  },
  recent: {
    title: "Nothing to re-log yet.",
    description: "Start logging meals to build your history.",
  },
};

export function QuickAddPanel({
  byDay,
  activeSlot,
  supabase,
  userId,
  onLog,
  onLogSavedMeal,
  onOpenSaveCombo: _onOpenSaveCombo,
  savedMealsRefreshToken,
  defaultTab,
  className,
}: QuickAddPanelProps) {
  // `onOpenSaveCombo` is part of the panel's public API (audit H4) so the
  // host can be the single owner of `SaveMealDialog`. The panel itself has
  // no save-combo trigger today — the "Save combo" chip lives on the
  // parent's meal-slot header — so the prop is currently unused internally.
  // We reference it via `_onOpenSaveCombo` to keep TypeScript / ESLint happy.
  void _onOpenSaveCombo;

  // Ship M1 — when the caller leaves `defaultTab` unset we defer the
  // initial tab choice to the shared `resolveQuickAddDefaultTab`
  // helper. That helper lands on "saved" when the user has ≥1 saved
  // meal and "recent" otherwise. We seed with "recent" here and let
  // the load effect flip to "saved" on first response when appropriate
  // (see below). A caller-forced `defaultTab` always wins.
  const callerForcedTab = defaultTab !== undefined;
  const [tab, setTab] = useState<Tab>(defaultTab ?? "recent");
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  // Saved meals state (Batch 2.6)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedMealsLoading, setSavedMealsLoading] = useState(false);
  const [savedPendingIds, setSavedPendingIds] = useState<Set<string>>(new Set());
  const didResolveInitialTabRef = useRef(false);

  // Rename + delete dialog state (audit M7, 2026-04-18). The dialogs
  // replace the previous `window.prompt` / `window.confirm` calls so
  // themed + focus-trapped + screen-reader-friendly alternatives are
  // used everywhere on web.
  const [renameTarget, setRenameTarget] = useState<SavedMeal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedMeal | null>(null);

  // Load favourites on mount and whenever the user changes.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setFavorites([]);
      return;
    }
    setFavoritesLoading(true);
    listFavorites(supabase, userId)
      .then((rows) => {
        if (!cancelled) setFavorites(rows);
      })
      .finally(() => {
        if (!cancelled) setFavoritesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // Load saved meals on mount, userId change, and whenever the host bumps
  // `savedMealsRefreshToken` after persisting a new combo (audit H4).
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setSavedMeals([]);
      return;
    }
    setSavedMealsLoading(true);
    listSavedMeals(supabase, userId)
      .then((rows) => {
        if (!cancelled) {
          setSavedMeals(rows);
          // Ship M1 — apply the shared default-tab rule on first load. If
          // the caller forced a `defaultTab` we respect that forever; if
          // not, the first successful load decides whether the user lands
          // on Usual meals or Recent via the shared helper.
          if (!callerForcedTab && !didResolveInitialTabRef.current) {
            didResolveInitialTabRef.current = true;
            setTab(resolveQuickAddDefaultTab(rows.length > 0));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setSavedMealsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, savedMealsRefreshToken, callerForcedTab]);

  // Jump to the "My meals" tab whenever the host signals a new combo was
  // saved. Skip the initial mount so users aren't yanked off the default
  // tab the first time the panel renders.
  const [didMountForRefresh, setDidMountForRefresh] = useState(false);
  useEffect(() => {
    if (!didMountForRefresh) {
      setDidMountForRefresh(true);
      return;
    }
    if (savedMealsRefreshToken == null) return;
    setTab("saved");
  }, [savedMealsRefreshToken, didMountForRefresh]);

  const frequent = useMemo(() => computeFrequentMeals(byDay, 20), [byDay]);
  const recent = useMemo(() => computeRecentMeals(byDay, 20), [byDay]);

  /** Map of "title|cal" -> favourite row id, used to show filled stars
   * and to find the id when unstarring from a Recent/Frequent row. */
  const favoriteIdByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of favorites) m.set(favoriteKey(f.recipeTitle, f.calories), f.id);
    return m;
  }, [favorites]);

  const rows: Row[] = useMemo(() => {
    if (tab === "favourites") {
      return favorites.map<Row>((f) => ({
        recipeTitle: f.recipeTitle,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        ...(f.fiber != null ? { fiber: f.fiber } : {}),
        ...(f.source ? { source: f.source } : {}),
        count: f.count,
        favoriteId: f.id,
      }));
    }
    if (tab === "saved") return []; // rendered by SavedMealsTab
    const source = tab === "frequent" ? frequent : recent;
    return source.map<Row>((item) => {
      const key = foodHistoryKey(item.recipeTitle, item.calories);
      const favId = favoriteIdByKey.get(key);
      return favId ? { ...item, favoriteId: favId } : item;
    });
  }, [tab, favorites, frequent, recent, favoriteIdByKey]);

  const toggleFavorite = useCallback(
    async (row: Row) => {
      if (!userId) {
        toast.info("Sign in to save favourites.");
        return;
      }
      const key = favoriteKey(row.recipeTitle, row.calories);
      if (pendingKeys.has(key)) return;
      setPendingKeys((s) => new Set(s).add(key));

      const snapshot = favorites;
      const alreadyStarred = Boolean(row.favoriteId);
      try {
        if (alreadyStarred && row.favoriteId) {
          // Optimistic remove.
          setFavorites((prev) => prev.filter((f) => f.id !== row.favoriteId));
          await removeFavorite(supabase, userId, row.favoriteId);
        } else {
          const input: FavoriteFoodInput = {
            recipeTitle: row.recipeTitle,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            fiber: row.fiber,
            source: row.source ?? null,
          };
          // Optimistic add with a temp id so the star fills immediately.
          const tempId = `temp-${key}`;
          const optimistic: FavoriteFood = {
            id: tempId,
            recipeTitle: row.recipeTitle,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            ...(row.fiber != null ? { fiber: row.fiber } : {}),
            ...(row.source ? { source: row.source } : {}),
            count: 1,
            createdAt: new Date().toISOString(),
          };
          setFavorites((prev) => [optimistic, ...prev]);
          const saved = await addFavorite(supabase, userId, input);
          setFavorites((prev) => [saved, ...prev.filter((f) => f.id !== tempId)]);
        }
      } catch (err) {
        // Revert on error.
        setFavorites(snapshot);
        toast.error(
          alreadyStarred ? "Couldn't remove favourite. Try again." : "Couldn't save favourite. Try again.",
        );
        console.error("QuickAddPanel favourite toggle failed", err);
      } finally {
        setPendingKeys((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [favorites, pendingKeys, supabase, userId],
  );

  // -- Saved meals actions (Batch 2.6) --
  //
  // Note: creation (`handleCreate`) and the `SaveMealDialog` it feeds were
  // lifted to the host `NutritionTracker` as part of audit H4 (2026-04-18)
  // to replace the save-combo CustomEvent bridge with direct props. The
  // panel refetches `listSavedMeals` via `savedMealsRefreshToken` when
  // the host persists a new combo.

  const handleLogSaved = useCallback(
    async (meal: SavedMeal) => {
      if (!userId || savedPendingIds.has(meal.id)) return;
      const slot = meal.defaultMealSlot ?? activeSlot;
      setSavedPendingIds((s) => new Set(s).add(meal.id));
      try {
        // Delegate the actual journal-entry insertion to the parent so
        // it goes through the same `addLoggedMealForDate` primitive as
        // every other log.
        onLogSavedMeal?.(meal, slot);
        // Optimistic local bump — reorder and update counters.
        setSavedMeals((prev) => {
          const next = prev.map((m) =>
            m.id === meal.id
              ? { ...m, logCount: m.logCount + 1, lastLoggedAt: new Date().toISOString() }
              : m,
          );
          next.sort((a, b) => {
            const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
            const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
            if (ta !== tb) return tb - ta;
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          });
          return next;
        });
        try {
          track(AnalyticsEvents.saved_meal_logged, {
            itemCount: meal.items.length,
            defaultMealSlot: meal.defaultMealSlot,
            // L6 G3 (2026-04-18) — join key for F3 habit-loop funnel.
            savedMealId: meal.id,
          });
        } catch {
          /* noop */
        }
        // Fire-and-forget counter bump. A failure here is not user-facing.
        void incrementLogCount(supabase, userId, meal.id).catch((err) => {
          console.warn("QuickAddPanel log-count bump failed", err);
        });
      } finally {
        setSavedPendingIds((s) => {
          const next = new Set(s);
          next.delete(meal.id);
          return next;
        });
      }
    },
    [activeSlot, onLogSavedMeal, savedPendingIds, supabase, userId],
  );

  // Opens the themed rename dialog. The dialog itself calls
  // `commitRename` with the validated + trimmed name when the user
  // taps Save.
  const handleRename = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      setRenameTarget(meal);
    },
    [userId],
  );

  const commitRename = useCallback(
    async (meal: SavedMeal, nextName: string) => {
      if (!userId) return;
      // The dialog already runs `normaliseSavedMealName`, so `nextName`
      // is trimmed + clipped to SAVED_MEAL_NAME_MAX_LENGTH. Still guard
      // against a no-op for safety.
      if (nextName === meal.name) return;
      const snapshot = savedMeals;
      setSavedMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, name: nextName } : m)));
      try {
        await renameSavedMeal(supabase, userId, meal.id, nextName);
        toast.success("Renamed.");
      } catch (err) {
        setSavedMeals(snapshot);
        toast.error("Couldn't rename. Try again.");
        console.error("QuickAddPanel rename failed", err);
      }
    },
    [savedMeals, supabase, userId],
  );

  // Opens the themed destructive-confirm dialog. The dialog itself
  // calls `commitDelete` when the user taps the red Delete button.
  const handleDelete = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      setDeleteTarget(meal);
    },
    [userId],
  );

  const commitDelete = useCallback(
    async (meal: SavedMeal) => {
      if (!userId) return;
      const snapshot = savedMeals;
      setSavedMeals((prev) => prev.filter((m) => m.id !== meal.id));
      try {
        await deleteSavedMeal(supabase, userId, meal.id);
        try {
          track(AnalyticsEvents.saved_meal_deleted, {
            itemCount: meal.items.length,
            defaultMealSlot: meal.defaultMealSlot,
          });
        } catch {
          /* noop */
        }
        toast.success("Deleted.");
      } catch (err) {
        setSavedMeals(snapshot);
        toast.error("Couldn't delete. Try again.");
        console.error("QuickAddPanel delete failed", err);
      }
    },
    [savedMeals, supabase, userId],
  );

  return (
    <div className={["rounded-card border border-border bg-card overflow-hidden", className].filter(Boolean).join(" ")}>
      {/* Header + tab row */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Quick add</p>
          <p className="text-[11px] text-muted-foreground">Logging to <span className="text-primary font-medium">{activeSlot}</span></p>
        </div>
      </div>
      <div className="flex items-center gap-1 px-3.5 py-2 border-b border-border" role="tablist" aria-label="Quick add tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {tab === "saved" ? (
        <SavedMealsTab
          meals={savedMeals}
          loading={savedMealsLoading}
          activeSlot={activeSlot}
          pendingIds={savedPendingIds}
          onLog={handleLogSaved}
          onRename={handleRename}
          onDelete={handleDelete}
          signedIn={Boolean(userId)}
        />
      ) : (
        <div className="divide-y divide-border/40">
          {tab === "favourites" && favoritesLoading && (
            <div className="flex items-center gap-2 px-3.5 py-6 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading favourites…
            </div>
          )}

          {rows.length === 0 && !(tab === "favourites" && favoritesLoading) && (
            <EmptyState
              title={EMPTY_COPY[tab as Exclude<Tab, "saved">].title}
              description={EMPTY_COPY[tab as Exclude<Tab, "saved">].description}
            />
          )}

          {rows.map((row) => {
            const rowKey = `${foodHistoryKey(row.recipeTitle, row.calories)}#${row.favoriteId ?? "u"}`;
            const starred = Boolean(row.favoriteId);
            const pending = pendingKeys.has(favoriteKey(row.recipeTitle, row.calories));
            // Batch 5.13 — subtle AI badge for entries logged via voice or photo.
            // Detection lives in `src/lib/nutrition/foodHistory.ts` so web +
            // mobile cannot drift (audit H1, 2026-04-18).
            const isAiSourced = isAiSourcedFoodHistoryItem(row);
            return (
              <div key={rowKey} className="flex items-center gap-2 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                    {row.recipeTitle}
                    {isAiSourced && (
                      <Badge
                        variant="ai"
                        ariaLabel="AI estimated nutrition"
                        title="This entry was logged with AI-estimated nutrition"
                      >
                        AI
                      </Badge>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {Math.round(row.calories)} kcal · P {Math.round(row.protein)}g · C {Math.round(row.carbs)}g · F {Math.round(row.fat)}g
                    {row.count > 1 && <span className="ml-1 text-muted-foreground/80">· {row.count}×</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(row)}
                  disabled={pending}
                  className={`size-7 inline-flex items-center justify-center rounded-lg transition-colors ${
                    starred ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                  } ${pending ? "opacity-60 cursor-not-allowed" : ""}`}
                  aria-label={starred ? "Unstar meal" : "Favourite this meal"}
                  aria-pressed={starred}
                  title={starred ? "Unstar meal" : "Favourite this meal"}
                >
                  <Star className="w-4 h-4" fill={starred ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() => onLog(row)}
                  className="size-7 inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                  aria-label={`Log ${row.recipeTitle} to ${activeSlot}`}
                  title={`Log to ${activeSlot}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename + delete confirmations (audit M7, 2026-04-18). Rendered
          unconditionally so the dialogs can animate close when the
          target is cleared; Radix handles the portal so they escape the
          panel's overflow-hidden shell. */}
      <RenameSavedMealDialog
        open={renameTarget != null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
        currentName={renameTarget?.name ?? ""}
        onConfirm={async (nextName) => {
          if (renameTarget) await commitRename(renameTarget, nextName);
        }}
      />
      <DestructiveConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete meal?"}
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await commitDelete(deleteTarget);
        }}
      />
    </div>
  );
}

export default QuickAddPanel;
