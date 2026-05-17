import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  Bookmark,
  Clock,
  History,
  LogIn,
  MoreVertical,
  PlusCircle,
  Star as StarIcon,
} from "lucide-react-native";
import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import Badge from "@/components/Badge";
import { SourceDot } from "@/components/ui/SourceDot";
import {
  computeFrequentMeals,
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryItem,
  type FoodHistoryMealLike,
} from "@suppr/shared/nutrition/foodHistory";
import { mapMealSourceToDot } from "@suppr/shared/nutrition/sourceMap";
import {
  addFavorite,
  favoriteKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
  type FavoriteFoodInput,
} from "@suppr/shared/nutrition/favoriteFoods";
import { formatMacroTrailer } from "@suppr/shared/nutrition/macroFormat";
import {
  deleteSavedMeal,
  incrementLogCount,
  listSavedMeals,
  renameSavedMeal,
  type SavedMeal,
  type SavedMealItem,
} from "@suppr/shared/nutrition/savedMeals";
import {
  dominantSavedMealSource,
  summariseSavedMeal,
} from "@suppr/shared/nutrition/savedMealsLogic";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import EmptyState from "@/components/EmptyState";
import { resolveQuickAddDefaultTab } from "@suppr/shared/nutrition/usualMealHint";

/**
 * Mobile `QuickAddPanel` — first-class React Native component that mirrors
 * the web `src/app/components/suppr/quick-add-panel.tsx`. Both consume the
 * same shared helpers in `src/lib/nutrition/*` so Favourites / Frequent /
 * Recent / My meals logic cannot drift (audit H1, 2026-04-18).
 *
 * Prop contract mirrors the web component where applicable:
 *  - `byDay` + `activeSlot` drive the tab contents.
 *  - `onLog` fires when the user taps `+` on a history/favourite/frequent/
 *    recent row. The host persists to the journal.
 *  - `onLogSavedMeal` fires when the user taps `+` on a saved-meal row.
 *    The host expands the saved meal into journal entries via
 *    `buildMealEntriesFromSavedMeal` so this panel stays presentation-only.
 *  - `onOpenSaveCombo` is part of the public API so the host owns
 *    `SaveMealSheet`. Not used internally today — the save-usual-meal
 *    surface lives on the parent's meal-slot section — but parity with
 *    the web panel keeps the contract stable.
 *  - `savedMealsRefreshToken` — bump after the host persists a new saved
 *    meal to refetch + auto-switch to "Usual meals".
 *
 * Optimism:
 *  - Star toggles update local state immediately and revert on Supabase
 *    error. No success alert (the star fill is the confirmation).
 *  - Saved-meal rename / delete show optimistic updates and revert with
 *    an Alert on Supabase error.
 */

type Tab = "saved" | "recent" | "frequent" | "favourites";

export interface QuickAddPanelProps {
  /** Journal byDay map — accepts mobile `JournalMeal[]` or web `LoggedMeal[]`. */
  byDay: Record<string, FoodHistoryMealLike[]>;
  /** The slot the user will be logging into on tap. */
  activeSlot: string;
  /** Supabase client. */
  supabase: { from: (table: string) => any };
  /** Authed user id. Empty string disables favourites + saved meals persistence. */
  userId: string;
  /** Fires when the user taps `+` on a history/favourite/frequent/recent row. */
  onLog: (item: FoodHistoryItem) => void;
  /** Fires when the user taps a saved-meal row — receives the whole
   *  saved meal + the slot to log to. */
  onLogSavedMeal?: (meal: SavedMeal, slot: string) => void;
  /** Request that the host open the `SaveMealSheet` pre-filled with
   *  `seedItems` for `slot`. Part of the public API for parity with web;
   *  not used internally today. */
  onOpenSaveCombo?: (
    slot?: string,
    seedItems?: Omit<SavedMealItem, "id" | "position">[],
  ) => void;
  /** Bump this number after a new saved-meal is persisted by the host to
   *  trigger a refetch + auto-switch to the "My meals" tab. */
  savedMealsRefreshToken?: number;
  /** Optional initial tab — defaults to Recent. */
  defaultTab?: Tab;
  /** Optional container style escape hatch. */
  style?: ViewStyle;
}

/** Row model unified across Favourites / Frequent / Recent tabs. */
type Row = FoodHistoryItem & {
  favoriteId?: string;
};

/**
 * Tab labels + insertion order. Ship M1 (2026-04-18) renames "My meals"
 * → "Usual meals" and puts it first; matches the web panel ordering.
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
 * `<EmptyState />` primitive. Parity with
 * `src/app/components/suppr/quick-add-panel.tsx`.
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

/**
 * 2026-05-02 (ui-critic #6) — illustration glyph per non-saved tab.
 * Each tab gets its own anchor so the empty card communicates which
 * surface the user is looking at. Rendered inside the `<EmptyState>`
 * primitive's 72pt primary-tinted disc.
 */
const ILLUSTRATION_SIZE = 32;
function emptyIllustrationFor(tab: Exclude<Tab, "saved">): React.ReactNode {
  switch (tab) {
    case "favourites":
      return <StarIcon size={ILLUSTRATION_SIZE} color={Accent.primary} strokeWidth={2.25} />;
    case "frequent":
      return <History size={ILLUSTRATION_SIZE} color={Accent.primary} strokeWidth={2.25} />;
    case "recent":
      return <Clock size={ILLUSTRATION_SIZE} color={Accent.primary} strokeWidth={2.25} />;
  }
}

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
  style,
}: QuickAddPanelProps) {
  // Part of the public API for parity with the web panel (the save-usual
  // row lives on the parent's meal-slot section today, not on the panel).
  void _onOpenSaveCombo;

  const colors = useThemeColors();

  // Ship M1 — when the caller leaves `defaultTab` unset, the first saved
  // meals load decides whether to land on "Usual meals" or "Recent" via
  // the shared `resolveQuickAddDefaultTab` helper (parity with web).
  const callerForcedTab = defaultTab !== undefined;
  const [tab, setTab] = useState<Tab>(defaultTab ?? "recent");
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedMealsLoading, setSavedMealsLoading] = useState(false);
  const [savedPendingIds, setSavedPendingIds] = useState<Set<string>>(new Set());
  const didResolveInitialTabRef = useRef(false);

  /** Load favourites on mount and whenever the user changes. */
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

  /** Load saved meals on mount, userId change, and whenever the host bumps
   *  `savedMealsRefreshToken` after persisting a new saved meal. */
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
          // Ship M1 — apply the shared default-tab rule on first load.
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

  /** Jump to the "Usual meals" tab whenever the host signals a new saved
   *  meal was persisted. Skip initial mount so the default tab still
   *  shows first. */
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
   *  across Frequent / Recent rows too. */
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
    if (tab === "saved") return []; // rendered via saved-meals branch
    const source = tab === "frequent" ? frequent : recent;
    return source.map<Row>((item) => {
      const k = foodHistoryKey(item.recipeTitle, item.calories);
      const favId = favoriteIdByKey.get(k);
      return favId ? { ...item, favoriteId: favId } : item;
    });
  }, [tab, favorites, frequent, recent, favoriteIdByKey]);

  const toggleFavorite = useCallback(
    async (row: Row) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save favourites.");
        return;
      }
      const key = favoriteKey(row.recipeTitle, row.calories);
      if (pendingKeys.has(key)) return;
      setPendingKeys((s) => {
        const n = new Set(s);
        n.add(key);
        return n;
      });

      const snapshot = favorites;
      const wasStarred = Boolean(row.favoriteId);
      try {
        if (wasStarred && row.favoriteId) {
          setFavorites((prev) => prev.filter((f) => f.id !== row.favoriteId));
          await removeFavorite(supabase, userId, row.favoriteId);
        } else {
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
          const input: FavoriteFoodInput = {
            recipeTitle: row.recipeTitle,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            fiber: row.fiber,
            source: row.source ?? null,
          };
          const saved = await addFavorite(supabase, userId, input);
          setFavorites((prev) => [saved, ...prev.filter((f) => f.id !== tempId)]);
        }
      } catch (err) {
        setFavorites(snapshot);
        Alert.alert(
          wasStarred ? "Could not remove favourite" : "Could not save favourite",
          "Please try again.",
        );
         
        console.warn("QuickAddPanel favourite toggle failed", err);
      } finally {
        setPendingKeys((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [favorites, pendingKeys, supabase, userId],
  );

  const handleLogSaved = useCallback(
    (meal: SavedMeal) => {
      if (!userId || savedPendingIds.has(meal.id)) return;
      const slot = meal.defaultMealSlot ?? activeSlot;
      setSavedPendingIds((s) => {
        const n = new Set(s);
        n.add(meal.id);
        return n;
      });
      try {
        // Delegate journal insertion to the host so it goes through the
        // same path as every other log.
        onLogSavedMeal?.(meal, slot);
        // Optimistic local bump — reorder and update counters so the row
        // surfaces at the top on next render.
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
            slot,
            // L6 G3 (2026-04-18) — join key for F3 habit-loop funnel.
            savedMealId: meal.id,
          });
        } catch {
          /* analytics is fire-and-forget */
        }
        // Fire-and-forget counter bump. A failure here is not user-facing.
        void incrementLogCount(supabase, userId, meal.id).catch((err) => {
           
          console.warn("QuickAddPanel saved-meal log-count bump failed", err);
        });
      } finally {
        setSavedPendingIds((s) => {
          const n = new Set(s);
          n.delete(meal.id);
          return n;
        });
      }
    },
    [activeSlot, onLogSavedMeal, savedPendingIds, supabase, userId],
  );

  const promptRename = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      // `Alert.prompt` is iOS-only; Android gets a graceful fallback.
      if (Platform.OS === "ios" && typeof (Alert as any).prompt === "function") {
        (Alert as any).prompt(
          "Rename meal",
          "Enter a new name.",
          async (text: string | undefined) => {
            const next = (text ?? "").trim();
            if (!next || next === meal.name) return;
            const snapshot = savedMeals;
            setSavedMeals((prev) =>
              prev.map((m) => (m.id === meal.id ? { ...m, name: next } : m)),
            );
            try {
              await renameSavedMeal(supabase, userId, meal.id, next);
            } catch (err) {
              setSavedMeals(snapshot);
              Alert.alert("Could not rename", "Please try again.");
               
              console.warn("QuickAddPanel saved-meal rename failed", err);
            }
          },
          "plain-text",
          meal.name,
        );
      } else {
        Alert.alert(
          "Rename meal",
          "Renaming is coming to Android in a future update. For now, delete and re-create the meal with a new name.",
        );
      }
    },
    [savedMeals, supabase, userId],
  );

  const confirmDelete = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      Alert.alert(
        "Delete saved meal",
        `Delete "${meal.name}"? This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
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
                  /* analytics is fire-and-forget */
                }
              } catch (err) {
                setSavedMeals(snapshot);
                Alert.alert("Could not delete", "Please try again.");
                 
                console.warn("QuickAddPanel saved-meal delete failed", err);
              }
            },
          },
        ],
      );
    },
    [savedMeals, supabase, userId],
  );

  const openActions = useCallback(
    (meal: SavedMeal) => {
      Alert.alert(
        meal.name,
        `${meal.items.length} item${meal.items.length === 1 ? "" : "s"}`,
        [
          { text: "Rename", onPress: () => promptRename(meal) },
          { text: "Delete", style: "destructive", onPress: () => confirmDelete(meal) },
          { text: "Cancel", style: "cancel" },
        ],
      );
    },
    [promptRename, confirmDelete],
  );

  // --- Render ---

  return (
    <View style={style}>
      {/* Tab row */}
      <View
        style={{
          flexDirection: "row",
          gap: Spacing.xs,
          paddingHorizontal: Spacing.xl,
          paddingBottom: Spacing.sm,
        }}
        accessibilityRole="tablist"
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const active = tab === t;
          const label = TAB_LABELS[t];
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} tab`}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: Radius.sm,
                alignItems: "center",
                backgroundColor: active ? Accent.primary : colors.border + "40",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: active ? "#fff" : colors.textSecondary,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "saved" ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.xl,
            paddingBottom: 40,
            gap: Spacing.sm,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {savedMealsLoading && (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <ActivityIndicator color={Accent.primary} />
            </View>
          )}
          {!savedMealsLoading && !userId && (
            <EmptyState
              illustration={
                <LogIn size={ILLUSTRATION_SIZE} color={Accent.primary} strokeWidth={2.25} />
              }
              title="Sign in to save a usual meal for one-tap re-logging."
            />
          )}
          {!savedMealsLoading && userId && savedMeals.length === 0 && (
            <EmptyState
              illustration={
                <Bookmark size={ILLUSTRATION_SIZE} color={Accent.primary} strokeWidth={2.25} />
              }
              title={`Log 2 or more items in a slot, then tap "Save {Slot} as a meal" to re-log it in one tap.`}
            />
          )}
          {!savedMealsLoading &&
            savedMeals.map((meal) => {
              const summary = summariseSavedMeal(meal);
              const pending = savedPendingIds.has(meal.id);
              const itemsLabel =
                summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
              const slotLabel = meal.defaultMealSlot ?? activeSlot;
              const summaryLabel = `${itemsLabel}, ${summary.totalCalories} kcal, protein ${Math.round(
                summary.totalProtein,
              )} grams, carbs ${Math.round(summary.totalCarbs)} grams, fat ${Math.round(
                summary.totalFat,
              )} grams`;
              // Trust posture (audit 2026-04-30 round-2 fix #B7) —
              // dominant source across the meal's items. See
              // `dominantSavedMealSource` (shared lib).
              const dominantSource = dominantSavedMealSource(meal);
              return (
                <Pressable
                  key={meal.id}
                  onPress={() => handleLogSaved(meal)}
                  onLongPress={() => openActions(meal)}
                  disabled={pending || summary.itemCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${meal.name} to ${slotLabel}. ${summaryLabel}. Long-press for more actions.`}
                  style={{
                    backgroundColor: colors.card,
                    // Audit M6 (2026-04-18): card-shell list rows align to
                    // Radius.lg (mobile convention, matches web rounded-card).
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  <SourceDot
                    source={dominantSource}
                    size={6}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                    >
                      {meal.name}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
                    >
                      {itemsLabel} · {formatMacroTrailer({
                        calories: summary.totalCalories,
                        protein: summary.totalProtein,
                        carbs: summary.totalCarbs,
                        fat: summary.totalFat,
                      })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openActions(meal);
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`More actions for ${meal.name}`}
                    style={{ paddingHorizontal: 6 }}
                  >
                    <MoreVertical
                      size={IconSize.lg}
                      color={colors.textSecondary}
                      strokeWidth={2.25}
                    />
                  </Pressable>
                  <PlusCircle
                    size={IconSize.hero}
                    color={Accent.primary}
                    strokeWidth={2.25}
                  />
                </Pressable>
              );
            })}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.xl,
            paddingBottom: 40,
            gap: Spacing.sm,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "favourites" && favoritesLoading && (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <ActivityIndicator color={Accent.primary} />
            </View>
          )}
          {rows.length === 0 && !(tab === "favourites" && favoritesLoading) && (
            <EmptyState
              illustration={emptyIllustrationFor(tab as Exclude<Tab, "saved">)}
              title={EMPTY_COPY[tab as Exclude<Tab, "saved">].title}
              description={EMPTY_COPY[tab as Exclude<Tab, "saved">].description}
            />
          )}
          {rows.map((row, idx) => {
            const starred = Boolean(row.favoriteId);
            const pending = pendingKeys.has(favoriteKey(row.recipeTitle, row.calories));
            const isAi = isAiSourcedFoodHistoryItem(row);
            // Trust posture (audit 2026-04-30 round-2 fix #B7) —
            // surface the row's source via canonical dot. Falls back
            // to "manual" when no source metadata exists.
            const sourceKey = mapMealSourceToDot(row.source ?? null);
            return (
              <Pressable
                key={`${row.recipeTitle}-${row.calories}-${idx}`}
                style={{
                  backgroundColor: colors.card,
                  // Audit M6 (2026-04-18): card-shell list rows align to
                  // Radius.lg (mobile convention, matches web rounded-card).
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Log ${row.recipeTitle} to ${activeSlot}`}
                onPress={() => onLog(row)}
              >
                <SourceDot source={sourceKey} size={6} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                    >
                      {row.recipeTitle}
                    </Text>
                    {isAi && (
                      <Badge variant="ai" accessibilityLabel="AI estimated nutrition">
                        AI
                      </Badge>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {formatMacroTrailer({
                      calories: row.calories,
                      protein: row.protein,
                      carbs: row.carbs,
                      fat: row.fat,
                    })}
                    {row.count > 1 ? `  ·  ${row.count}×` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    toggleFavorite(row);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={starred ? "Unstar meal" : "Favourite this meal"}
                  accessibilityState={{ selected: starred, disabled: pending }}
                  style={{ paddingHorizontal: 6, opacity: pending ? 0.5 : 1 }}
                >
                  <StarIcon
                    size={22}
                    color={starred ? "#f59e0b" : colors.textSecondary}
                    fill={starred ? "#f59e0b" : "transparent"}
                    strokeWidth={2.25}
                  />
                </Pressable>
                <PlusCircle
                  size={IconSize.hero}
                  color={Accent.primary}
                  strokeWidth={2.25}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default QuickAddPanel;
