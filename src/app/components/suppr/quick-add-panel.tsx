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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeFrequentMeals,
  computeRecentMeals,
  foodHistoryKey,
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
  createSavedMeal,
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
import { SaveMealDialog } from "./save-meal-dialog";

type Tab = "favourites" | "frequent" | "recent" | "saved";

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
  /** Optional initial tab — defaults to Recent (matches prior mobile behaviour). */
  defaultTab?: Tab;
  className?: string;
}

/** Row model unified across Favourites / Frequent / Recent tabs. */
type Row = FoodHistoryItem & {
  /** DB row id when this row is (also) a favourite. */
  favoriteId?: string;
};

const TAB_LABELS: Record<Tab, string> = {
  favourites: "Favourites",
  frequent: "Frequent",
  recent: "Recent",
  saved: "My meals",
};

const EMPTY_COPY: Record<Exclude<Tab, "saved">, string> = {
  favourites: "Star meals you log often for one-tap re-logging.",
  frequent: "Your most-logged meals will show up here after a few days of tracking.",
  recent: "Nothing to re-log yet. Start logging meals to build your history.",
};

export function QuickAddPanel({
  byDay,
  activeSlot,
  supabase,
  userId,
  onLog,
  onLogSavedMeal,
  defaultTab = "recent",
  className,
}: QuickAddPanelProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  // Saved meals state (Batch 2.6)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedMealsLoading, setSavedMealsLoading] = useState(false);
  const [savedPendingIds, setSavedPendingIds] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogItems, setSaveDialogItems] = useState<Array<Omit<SavedMealItem, "id" | "position">>>([]);

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

  // Load saved meals.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setSavedMeals([]);
      return;
    }
    setSavedMealsLoading(true);
    listSavedMeals(supabase, userId)
      .then((rows) => {
        if (!cancelled) setSavedMeals(rows);
      })
      .finally(() => {
        if (!cancelled) setSavedMealsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

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
        // eslint-disable-next-line no-console
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

  /** Called from parent NutritionTracker when the user taps
   * "Save these as a meal". Flipping this open hands the items to the
   * dialog via `initialItems`. */
  const openSaveDialog = useCallback(
    (items: Array<Omit<SavedMealItem, "id" | "position">>) => {
      if (!userId) {
        toast.info("Sign in to save meal combos.");
        return;
      }
      if (items.length < 2) {
        toast.info("Log 2 or more items first, then save the combo.");
        return;
      }
      setSaveDialogItems(items);
      setSaveDialogOpen(true);
    },
    [userId],
  );

  const handleCreate = useCallback(
    async (payload: { name: string; defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks"; items: Array<Omit<SavedMealItem, "id" | "position">> }) => {
      if (!userId) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: SavedMeal = {
        id: tempId,
        name: payload.name,
        items: payload.items.map((it, i) => ({ position: i, ...it })),
        createdAt: new Date().toISOString(),
        logCount: 0,
        ...(payload.defaultMealSlot ? { defaultMealSlot: payload.defaultMealSlot } : {}),
      };
      setSavedMeals((prev) => [optimistic, ...prev]);
      try {
        const created = await createSavedMeal(supabase, userId, payload);
        setSavedMeals((prev) => [created, ...prev.filter((m) => m.id !== tempId)]);
        try {
          track(AnalyticsEvents.saved_meal_created, {
            itemCount: payload.items.length,
            defaultMealSlot: payload.defaultMealSlot,
          });
        } catch {
          /* analytics is fire-and-forget */
        }
        toast.success(`Saved "${payload.name}".`);
        // Jump to the My meals tab so the user sees the new row.
        setTab("saved");
      } catch (err) {
        setSavedMeals((prev) => prev.filter((m) => m.id !== tempId));
        toast.error("Couldn't save that combo. Try again.");
        // eslint-disable-next-line no-console
        console.error("QuickAddPanel saved-meal create failed", err);
      }
    },
    [supabase, userId],
  );

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
          });
        } catch {
          /* noop */
        }
        // Fire-and-forget counter bump. A failure here is not user-facing.
        void incrementLogCount(supabase, userId, meal.id).catch((err) => {
          // eslint-disable-next-line no-console
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

  const handleRename = useCallback(
    async (meal: SavedMeal) => {
      if (!userId) return;
      if (typeof window === "undefined") return;
      const next = window.prompt("Rename meal", meal.name);
      if (next == null) return; // cancelled
      const trimmed = next.trim();
      if (!trimmed || trimmed === meal.name) return;
      const snapshot = savedMeals;
      setSavedMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, name: trimmed } : m)));
      try {
        await renameSavedMeal(supabase, userId, meal.id, trimmed);
        toast.success("Renamed.");
      } catch (err) {
        setSavedMeals(snapshot);
        toast.error("Couldn't rename. Try again.");
        // eslint-disable-next-line no-console
        console.error("QuickAddPanel rename failed", err);
      }
    },
    [savedMeals, supabase, userId],
  );

  const handleDelete = useCallback(
    async (meal: SavedMeal) => {
      if (!userId) return;
      if (typeof window !== "undefined" && !window.confirm(`Delete "${meal.name}"?`)) return;
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
        // eslint-disable-next-line no-console
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
            <p className="px-3.5 py-6 text-xs text-muted-foreground text-center">
              {EMPTY_COPY[tab as Exclude<Tab, "saved">]}
            </p>
          )}

          {rows.map((row) => {
            const rowKey = `${foodHistoryKey(row.recipeTitle, row.calories)}#${row.favoriteId ?? "u"}`;
            const starred = Boolean(row.favoriteId);
            const pending = pendingKeys.has(favoriteKey(row.recipeTitle, row.calories));
            // Batch 5.13 — subtle AI badge for entries logged via voice or photo.
            // Matches the strings written by the NutritionTracker commit path
            // ("AI voice" / "AI photo") and by the mobile Today tab.
            const sourceLc = (row.source ?? "").toLowerCase();
            const isAiSourced =
              sourceLc.includes("ai voice") ||
              sourceLc.includes("ai photo") ||
              sourceLc === "voice" ||
              sourceLc === "ai_photo" ||
              sourceLc === "ai_voice";
            return (
              <div key={rowKey} className="flex items-center gap-2 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                    {row.recipeTitle}
                    {isAiSourced && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                        aria-label="AI estimated nutrition"
                        title="This entry was logged with AI-estimated nutrition"
                      >
                        AI
                      </span>
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

      <SaveMealDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        initialItems={saveDialogItems}
        defaultSlot={
          activeSlot === "Breakfast" || activeSlot === "Lunch" || activeSlot === "Dinner" || activeSlot === "Snacks"
            ? (activeSlot as "Breakfast" | "Lunch" | "Dinner" | "Snacks")
            : undefined
        }
        onSave={handleCreate}
        suggestedName={`My ${activeSlot.toLowerCase()} combo`}
      />
      {/* Re-expose the open trigger via a global window event so the
          host NutritionTracker can open the dialog when the user taps
          "Save these as a meal" without dragging the panel ref through
          props. Avoids prop-drilling a ref on an existing public API. */}
      <SaveMealDialogTrigger onOpen={openSaveDialog} />
    </div>
  );
}

/** Invisible event listener — lets the host component (NutritionTracker
 * web, tracker screen mobile) open the save-meal dialog without the
 * `QuickAddPanel` having to expose a ref API. The host dispatches a
 * `CustomEvent("suppr:open-save-meal-dialog", { detail: { items } })`
 * and this listener forwards the payload to `onOpen`. Using an event
 * keeps the panel's public props unchanged. */
function SaveMealDialogTrigger({
  onOpen,
}: {
  onOpen: (items: Array<Omit<SavedMealItem, "id" | "position">>) => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ items: Array<Omit<SavedMealItem, "id" | "position">> }>;
      const items = ce?.detail?.items;
      if (Array.isArray(items)) onOpen(items);
    };
    window.addEventListener("suppr:open-save-meal-dialog", handler);
    return () => window.removeEventListener("suppr:open-save-meal-dialog", handler);
  }, [onOpen]);
  return null;
}

export default QuickAddPanel;
