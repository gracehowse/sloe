import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  formatContainsLine,
  normaliseAllergenIds,
} from "../../constants/regulatedAllergens";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { IngredientOverride, IngredientRow, RecipeCard, UserTier } from "../../types/recipe.ts";
import { GoPublicDialog } from "./GoPublicDialog.tsx";
import { CookMode } from "./CookMode.tsx";
import { carbsLabel, netCarbsForRow } from "../../lib/nutrition/netCarbs.ts";
import { FoodSearch, type FoodSearchSelection } from "./FoodSearch.tsx";
import { ConfidenceDot } from "./suppr/confidence-dot";
import { classifyConfidence } from "../../lib/nutrition/aiLogging";
import { AddIngredientDialog, type AddIngredientPayload } from "./suppr/add-ingredient-dialog";
import { OverrideIngredientDialog } from "./suppr/override-ingredient-dialog";
import { normaliseRecipeDisplayTitle } from "../../lib/recipe/normaliseDisplayTitle";
import {
  findSeedRecipeById,
  isSeedRecipeId,
} from "../../lib/recipes/seedRecipesV2";
import { pickHeroImageUrl } from "../../lib/recipes/heroImageFallback.ts";
import { DEFAULT_UPLOADED_RECIPE_IMAGE } from "../../context/appData/constants.ts";
import { RecipeNotesCard } from "./suppr/recipe-notes-card";
import { Badge } from "./suppr/badge";
import {
  effectiveMacros,
  hasOverride,
  recomputeRecipeTotals,
} from "../../lib/nutrition/ingredientOverrides.ts";
import { formatIngredientAmountUnit } from "../../lib/recipe-ingredients/formatIngredientAmount.ts";
import {
  deriveIngredientVerificationTier,
  ingredientShouldShowVerifyCta,
} from "../../lib/recipe-ingredients/ingredientVerificationStatus.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";
import { MoreVertical } from "lucide-react";
import { formatRecipeMinutes } from "../../lib/recipe/formatRecipeMinutes.ts";
import {
  composeSubtitleParts,
  computeFitsYourDayVerdict,
  shouldRenderTimeStats,
} from "../../lib/recipe/recipeDetailLayout.ts";
import { webRecipeDeepLink } from "../../lib/share/recipeDeepLink.ts";
import { normaliseInstructions } from "../../lib/recipes/normaliseInstructions.ts";
import { sanitizeRecipeDescription } from "../../lib/recipes/sanitizeRecipeDescription.ts";
import { formatMacroValue } from "../../lib/nutrition/formatMacro.ts";
// GW-08 (audit 2026-04-28): `computeRecipeFitPercent` import dropped
// when the always-85% pill was removed from this screen. Helper is
// still callable from web Library card where targets are real.
// Phase 4 / B3.X (2026-04-27) — trust posture sweep. Authority:
// D-2026-04-27-16. The recipe-level chip aggregates ingredient
// trust into a single hero chip; per-row dots sit on the ingredient
// list below.
import { TrustChip } from "./ui/trust-chip";
import { SourceDot } from "./ui/source-dot";
// GW-08 (audit 2026-04-28): `aggregateRecipeTrust` import dropped
// when the source TrustChip was removed from this screen. Gluten
// classifier stays — it's a real ingredient-keyword scan, not a
// fabricated source claim.
import { classifyRecipeGluten } from "../../lib/nutrition/recipeTrust.ts";
import { mapMealSourceToDot } from "../../lib/nutrition/sourceMap.ts";
import { FatSecretBadge } from "./ui/FatSecretBadge";
// Recipe-detail viewing-servings stepper (Paprika parity, 2026-05-02
// customer-lens audit). Shared bounds / clamp / debounce / seed
// helpers — mobile uses the same module so the contract stays in
// lock-step. See `src/lib/nutrition/recipeViewScale.ts`.
import {
  RECIPE_VIEW_SERVINGS_MAX,
  RECIPE_VIEW_SERVINGS_MIN,
  RECIPE_VIEW_STEPPER_DEBOUNCE_MS,
  initialViewServings,
  stepViewServings,
} from "../../lib/nutrition/recipeViewScale.ts";

async function shareRecipeDeepLink(recipeId: string) {
  if (typeof window === "undefined") return;
  const url = webRecipeDeepLink(recipeId, window.location.origin);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Recipe on Suppr", text: "Open this recipe in Suppr", url });
      toast.success("Shared");
      return;
    } catch (e: unknown) {
      if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  } catch {
    // Audit M7 (2026-04-18) — the prior `window.prompt("Copy this link:", url)`
    // fallback was an unthemed native dialog. Surface the link via a
    // persistent toast instead so the user can long-press / select the URL
    // and copy it themselves without the browser prompt.
    toast.message("Copy this link", {
      description: url,
      duration: 15000,
    });
  }
}

const RECIPE_MACRO_KEYS_FOR_FILTER = new Set(["protein", "carbs", "fat", "fiber", "sugar", "sodium"]);

interface RecipeDetailProps {
  recipe: RecipeCard;
  userTier: UserTier;
  onBack: () => void;
  /** Auto-open cook mode when recipe loads (from planner "Cook" button). */
  autoOpenCookMode?: boolean;
  /** Pre-fill servings from planner portion multiplier. */
  initialServings?: number;
  /** Navigate to the tracker view (shown after cook mode meal logging). */
  onViewTracker?: () => void;
}

type DbIngredientRow = {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  is_verified: boolean;
  source: string | null;
  override_macros?: IngredientOverride | null;
  added_by_user?: boolean | null;
  /** GW-08 P2 (2026-04-28) — real persisted match confidence (0..1). */
  confidence?: number | null;
};

function mapDbIngredientToRow(row: DbIngredientRow): IngredientRow {
  const out: IngredientRow = {
    name: row.name,
    amount: row.amount != null ? String(row.amount) : "",
    unit: row.unit ?? "",
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiberG: row.fiber_g ?? 0,
    sugarG: row.sugar_g ?? 0,
    sodiumMg: row.sodium_mg ?? 0,
    isVerified: row.is_verified,
    source: row.source ?? "Manual",
    // GW-08 P2 (2026-04-28): hydrate the real persisted confidence
    // when present. Legacy rows (pre-confidence-column data) still
    // come through with `null` — callers that need a number fall
    // back to the synthetic 0.9/0.3 mapping based on `is_verified`.
    confidence:
      typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? row.confidence
        : null,
  };
  if (row.override_macros && typeof row.override_macros === "object") {
    const o = row.override_macros as IngredientOverride;
    if (
      Number.isFinite(o.calories) &&
      Number.isFinite(o.protein) &&
      Number.isFinite(o.carbs) &&
      Number.isFinite(o.fat)
    ) {
      out.overrideMacros = o;
    }
  }
  if (row.added_by_user) out.addedByUser = true;
  return out;
}

// Audit 2026-04-30 visual-qa P1 #6 — ingredient amount float overflow.
// `(parseFloat(amount) * servings) / baseServings` produced strings
// like "0.6666666666666666 cup" when the user changed the servings
// stepper. Round to 2dp, drop trailing zeros, return integers as-is.
function formatIngredientAmount(raw: number): string {
  if (!Number.isFinite(raw)) return "";
  const rounded = Math.round(raw * 100) / 100;
  if (Number.isInteger(rounded)) return rounded.toString();
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function RecipeDetail({ recipe, userTier, onBack, autoOpenCookMode, initialServings, onViewTracker }: RecipeDetailProps) {
  const {
    toggleSaveRecipe,
    isRecipeSaved,
    refreshDiscoverRecipes,
    refreshMyLibraryRecipes,
    addNotification,
    notificationPrefs,
    nutritionTargets,
    netCarbsLensEnabled,
  } = useAppData();
  const router = useRouter();
  const saved = isRecipeSaved(recipe.id);
  // PR1 (Paprika parity, 2026-05-02): the viewing-servings stepper
  // is the canonical "how many portions am I looking at" state.
  // Bounds (1..99) + the deep-link `initialServings` honouring live
  // in the shared `recipeViewScale.ts` so mobile uses the exact same
  // contract. The stepper deals only in whole portions — fractional
  // cook-mode multipliers (0.5x / 1x / 1.5x / 2x / 4x) live in
  // `recipeScale.ts` and are composed on top inside the CookMode
  // component (PR #72).
  const [servings, setServings] = useState<number>(() =>
    initialViewServings({
      baseServings: recipe.servings,
      portionParam:
        typeof initialServings === "number" && Number.isFinite(initialServings) && initialServings > 0
          ? initialServings
          : null,
    }),
  );
  // Stepper debounce — coalesces a burst of `+`/`-` clicks (or held
  // keys via keyboard auto-repeat) into a single state update at the
  // tail of the burst. 200ms matches the mobile cadence so a held
  // key on the web stepper feels the same as a held tap on mobile.
  const stepperPendingDelta = useRef(0);
  const stepperPendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleViewServingsStep = useCallback((delta: number) => {
    stepperPendingDelta.current += delta;
    if (stepperPendingTimer.current) clearTimeout(stepperPendingTimer.current);
    stepperPendingTimer.current = setTimeout(() => {
      const accum = stepperPendingDelta.current;
      stepperPendingDelta.current = 0;
      stepperPendingTimer.current = null;
      setServings((prev) => stepViewServings(prev, accum));
    }, RECIPE_VIEW_STEPPER_DEBOUNCE_MS);
  }, []);
  // Cancel pending stepper timer on unmount so a late tick doesn't
  // call setState after teardown.
  useEffect(() => {
    return () => {
      if (stepperPendingTimer.current) {
        clearTimeout(stepperPendingTimer.current);
        stepperPendingTimer.current = null;
      }
    };
  }, []);
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");
  const [cookModeOpen, setCookModeOpen] = useState(Boolean(autoOpenCookMode));

  // Audit gap #3 (Wave 4, 2026-05-02) — static seed recipes have no
  // Supabase backing row; treat them like a catalogue entry so the
  // existing catalogue-only short-circuits in this component (DB
  // fetches + saves) all skip cleanly. The seed's ingredients +
  // instructions are hydrated into the dbIngredients / dbInstructionsText
  // state below so the existing render paths (Steps tab + Ingredients
  // tab) work without a second branch in the JSX.
  const isCatalogRecipe = isSeedRecipeId(recipe.id);
  const seedRecipe = isCatalogRecipe ? findSeedRecipeById(recipe.id) : null;
  const [publishedOverride, setPublishedOverride] = useState<boolean | null>(null);
  const isPublished = publishedOverride ?? (recipe.isPublished ?? null);

  const [dbLoading, setDbLoading] = useState(!isCatalogRecipe);
  const [dbDescription, setDbDescription] = useState<string | null>(null);
  const [dbInstructionsText, setDbInstructionsText] = useState<string | null>(null);
  const [dbServings, setDbServings] = useState<number | null>(null);
  const [dbMacros, setDbMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  } | null>(null);
  const [dbPrepMin, setDbPrepMin] = useState<number | null>(null);
  const [dbCookMin, setDbCookMin] = useState<number | null>(null);
  const [recipeYieldDraft, setRecipeYieldDraft] = useState("");
  const [recipeYieldSaving, setRecipeYieldSaving] = useState(false);
  const [recipeYieldEditing, setRecipeYieldEditing] = useState(false);
  const recipeYieldInputRef = useRef<HTMLInputElement | null>(null);
  const recipeYieldEscapeBlurRef = useRef(false);
  const [dbIngredients, setDbIngredients] = useState<IngredientRow[]>([]);
  const [dbIngredientIds, setDbIngredientIds] = useState<string[]>([]);
  const [dbFetchFailed, setDbFetchFailed] = useState(false);
  const [verifySearchOpen, setVerifySearchOpen] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState<number | null>(null);
  // Batch 2.7 — add-ingredient + per-ingredient override dialogs.
  const [addIngOpen, setAddIngOpen] = useState(false);
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  // Audit 2026-04-30 visual-qa P0 #3 — mobile meatball menu drives
  // these dialogs since the inline buttons are hidden below `md`.
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [goPublicMobileOpen, setGoPublicMobileOpen] = useState(false);

  const [followCreatorId, setFollowCreatorId] = useState<string | null>(null);
  const [recipeAuthorId, setRecipeAuthorId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [trackedMacros, setTrackedMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMetaLoaded, setFollowMetaLoaded] = useState(false);
  const [publicSaveCount, setPublicSaveCount] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  const isMyRecipe = Boolean(
    !isCatalogRecipe &&
      authUserId &&
      (recipe.authorId ?? recipeAuthorId) &&
      authUserId === (recipe.authorId ?? recipeAuthorId),
  );

  const setPublished = async (nextPublished: boolean) => {
    if (!authUserId || !isMyRecipe) return;
    try {
      const { error } = await supabase
        .from("recipes")
        .update({ published: nextPublished })
        .eq("id", recipe.id)
        .eq("author_id", authUserId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setPublishedOverride(nextPublished);
      await refreshDiscoverRecipes();
      await refreshMyLibraryRecipes();
      toast.success(nextPublished ? "Recipe published" : "Recipe unpublished");
      if (notificationPrefs.creatorUpdates) {
        addNotification({
          kind: nextPublished ? "recipe_published" : "recipe_unpublished",
          title: nextPublished ? "Recipe published" : "Recipe unpublished",
          body: recipe.title ? `"${recipe.title}"` : undefined,
          recipeId: recipe.id,
        });
      }
    } catch {
      toast.error("Could not update publish status.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFollowMetaLoaded(false);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      if (cancelled) return;
      setAuthUserId(uid);

      if (isCatalogRecipe) {
        setFollowCreatorId(null);
        setRecipeAuthorId(null);
        setIsFollowing(false);
        setPublicSaveCount(recipe.savedCount);
        setFollowerCount(null);
        setFollowMetaLoaded(true);
        return;
      }

      const { data: metaRow } = await supabase
        .from("recipes")
        .select("creator_id, author_id")
        .eq("id", recipe.id)
        .maybeSingle();

      if (cancelled) return;
      if (!metaRow) {
        setFollowCreatorId(null);
        setRecipeAuthorId(null);
        setIsFollowing(false);
        setPublicSaveCount(recipe.savedCount);
        setFollowerCount(null);
        setFollowMetaLoaded(true);
        return;
      }

      const cid = (metaRow.creator_id as string | null) ?? null;
      const aid = (metaRow.author_id as string | null) ?? null;
      setFollowCreatorId(cid);
      setRecipeAuthorId(aid);

      if (cid && uid) {
        const { data: fol } = await supabase
          .from("follows")
          .select("creator_id")
          .eq("user_id", uid)
          .eq("creator_id", cid)
          .maybeSingle();
        if (!cancelled) setIsFollowing(Boolean(fol));
      } else if (aid && uid) {
        const { data: afol } = await supabase
          .from("author_follows")
          .select("author_id")
          .eq("follower_id", uid)
          .eq("author_id", aid)
          .maybeSingle();
        if (!cancelled) setIsFollowing(Boolean(afol));
      } else if (!cancelled) {
        setIsFollowing(false);
      }

      const { data: sc, error: scErr } = await supabase.rpc("public_recipe_save_count", { p_recipe_id: recipe.id });
      if (!cancelled) {
        if (!scErr && sc != null) {
          const n = Number(sc);
          setPublicSaveCount(Number.isFinite(n) ? n : recipe.savedCount);
        } else {
          setPublicSaveCount(recipe.savedCount);
        }
      }

      if (cid) {
        const { data: fc, error: fcErr } = await supabase.rpc("public_creator_follower_count", { p_creator_id: cid });
        if (!cancelled) {
          if (!fcErr && fc != null) {
            const n = Number(fc);
            setFollowerCount(Number.isFinite(n) ? n : 0);
          } else {
            setFollowerCount(0);
          }
        }
      } else if (aid) {
        const { data: fc, error: fcErr } = await supabase.rpc("public_author_follower_count", { p_author_id: aid });
        if (!cancelled) {
          if (!fcErr && fc != null) {
            const n = Number(fc);
            setFollowerCount(Number.isFinite(n) ? n : 0);
          } else {
            setFollowerCount(0);
          }
        }
      } else if (!cancelled) {
        setFollowerCount(null);
      }

      setFollowMetaLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id, recipe.savedCount, isCatalogRecipe]);

  useEffect(() => {
    if (!authUserId) {
      setTrackedMacros(["protein", "carbs", "fat"]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("profiles").select("tracked_macros").eq("id", authUserId).maybeSingle();
      if (cancelled) return;
      if (data?.tracked_macros && Array.isArray(data.tracked_macros) && data.tracked_macros.length > 0) {
        setTrackedMacros(data.tracked_macros as string[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  const showFollowButton =
    !isCatalogRecipe &&
    followMetaLoaded &&
    Boolean(authUserId && recipeAuthorId && authUserId !== recipeAuthorId);

  const toggleFollow = async () => {
    if (!authUserId || followBusy) return;
    if (followCreatorId) {
      setFollowBusy(true);
      try {
        if (isFollowing) {
          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("user_id", authUserId)
            .eq("creator_id", followCreatorId);
          if (error) {
            toast.error(error.message);
            return;
          }
          setIsFollowing(false);
          setFollowerCount((c) => (c != null ? Math.max(0, c - 1) : c));
          toast.success("Unfollowed");
        } else {
          const { error } = await supabase.from("follows").insert({
            user_id: authUserId,
            creator_id: followCreatorId,
          });
          if (error) {
            toast.error(error.message);
            return;
          }
          setIsFollowing(true);
          setFollowerCount((c) => (c != null ? c + 1 : 1));
          toast.success("Following");
        }
      } finally {
        setFollowBusy(false);
      }
      return;
    }
    if (recipeAuthorId) {
      setFollowBusy(true);
      try {
        if (isFollowing) {
          const { error } = await supabase
            .from("author_follows")
            .delete()
            .eq("follower_id", authUserId)
            .eq("author_id", recipeAuthorId);
          if (error) {
            toast.error(error.message);
            return;
          }
          setIsFollowing(false);
          setFollowerCount((c) => (c != null ? Math.max(0, c - 1) : c));
          toast.success("Unfollowed");
        } else {
          const { error } = await supabase.from("author_follows").insert({
            follower_id: authUserId,
            author_id: recipeAuthorId,
          });
          if (error) {
            toast.error(error.message);
            return;
          }
          setIsFollowing(true);
          setFollowerCount((c) => (c != null ? c + 1 : 1));
          toast.success("Following");
        }
      } finally {
        setFollowBusy(false);
      }
    }
  };

  useEffect(() => {
    if (isCatalogRecipe) {
      setDbLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setDbLoading(true);
      setDbFetchFailed(false);
      setDbPrepMin(null);
      setDbCookMin(null);
      const { data: row, error: recipeError } = await supabase
        .from("recipes")
        .select(
          "description, instructions, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, prep_time_min, cook_time_min",
        )
        .eq("id", recipe.id)
        .maybeSingle();

      if (cancelled) return;
      if (recipeError || !row) {
        setDbFetchFailed(true);
        setDbLoading(false);
        return;
      }

      const prepRaw = Number((row as { prep_time_min?: unknown }).prep_time_min);
      const cookRaw = Number((row as { cook_time_min?: unknown }).cook_time_min);
      setDbPrepMin(Number.isFinite(prepRaw) && prepRaw > 0 ? Math.round(prepRaw) : null);
      setDbCookMin(Number.isFinite(cookRaw) && cookRaw > 0 ? Math.round(cookRaw) : null);

      setDbDescription((row.description as string | null) ?? null);
      setDbInstructionsText((row.instructions as string | null) ?? null);
      setDbServings((row.servings as number) ?? recipe.servings);
      setDbMacros({
        calories: (row.calories as number) ?? 0,
        protein: (row.protein as number) ?? 0,
        carbs: (row.carbs as number) ?? 0,
        fat: (row.fat as number) ?? 0,
        fiberG: Number((row as { fiber_g?: unknown }).fiber_g) || 0,
        sugarG: Number((row as { sugar_g?: unknown }).sugar_g) || 0,
        sodiumMg: Number((row as { sodium_mg?: unknown }).sodium_mg) || 0,
      });

      const { data: ingRows, error: ingError } = await supabase
        .from("recipe_ingredients")
        .select(
          "id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, source, override_macros, added_by_user, confidence",
        )
        .eq("recipe_id", recipe.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (!ingError && ingRows?.length) {
        setDbIngredients(ingRows.map((r) => mapDbIngredientToRow(r as DbIngredientRow)));
        setDbIngredientIds(ingRows.map((r: any) => r.id));
      } else {
        setDbIngredients([]);
        setDbIngredientIds([]);
      }
      setDbLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id, recipe.servings, isCatalogRecipe]);

  /** Audit gap #3 (Wave 4, 2026-05-02) — hydrate the seed-recipe
   *  content into the same state slots the DB-backed path writes to,
   *  so the Ingredients + Steps tabs render without bespoke seed
   *  branches. Mobile parity: `apps/mobile/app/recipe/[id].tsx`. */
  useEffect(() => {
    if (!seedRecipe) return;
    setDbInstructionsText(seedRecipe.steps.join("\n"));
    setDbServings(seedRecipe.servings);
    setDbPrepMin(seedRecipe.prepTimeMin > 0 ? seedRecipe.prepTimeMin : null);
    setDbCookMin(seedRecipe.cookTimeMin > 0 ? seedRecipe.cookTimeMin : null);
    setDbIngredients(
      seedRecipe.ingredients.map((i): IngredientRow => ({
        name: i.name,
        amount: String(i.grams),
        unit: "g",
        // Seed cards display ingredient lines but never claim macro
        // values for them — log-time ingredient pipeline owns nutrition.
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        isVerified: true,
        source: seedRecipe.attribution.author,
      })),
    );
  }, [seedRecipe]);

  useEffect(() => {
    const s = dbServings ?? recipe.servings;
    setRecipeYieldDraft(String(Math.max(1, s)));
  }, [dbServings, recipe.servings]);

  useEffect(() => {
    if (!recipeYieldEditing) return;
    const id = requestAnimationFrame(() => {
      recipeYieldInputRef.current?.focus();
      recipeYieldInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [recipeYieldEditing]);

  const ingredients = dbIngredients;
  const instructionSteps = useMemo(() => {
    // Shared normaliser handles `\n` / `/n` typos + whitespace trimming
    // + paragraph collapse. Identical helper runs on the mobile detail
    // screen and on every write path so display/write don't drift.
    const text = normaliseInstructions(dbInstructionsText);
    if (!text) return [];
    return text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [dbInstructionsText]);

  const baseServings = dbServings ?? recipe.servings;
  const prepDisplay =
    formatRecipeMinutes(dbPrepMin) ?? recipe.prepTime ?? "—";
  const cookDisplay =
    formatRecipeMinutes(dbCookMin) ?? recipe.cookTime ?? "—";

  const displayRecipe = useMemo(() => {
    if (isCatalogRecipe || !dbMacros) {
      return recipe;
    }
    return {
      ...recipe,
      servings: baseServings,
      calories: dbMacros.calories,
      protein: dbMacros.protein,
      carbs: dbMacros.carbs,
      fat: dbMacros.fat,
      fiberG: dbMacros.fiberG,
      sugarG: dbMacros.sugarG,
      sodiumMg: dbMacros.sodiumMg,
      prepTime: formatRecipeMinutes(dbPrepMin) ?? recipe.prepTime,
      cookTime: formatRecipeMinutes(dbCookMin) ?? recipe.cookTime,
    };
  }, [recipe, isCatalogRecipe, dbMacros, baseServings, dbPrepMin, dbCookMin]);

  // Base per-serving macros: prefer live ingredient totals (so add-ingredient
  // and override flows reflect immediately before the user saves) but fall
  // back to the persisted recipe macros when the recipe has no ingredient
  // rows yet. We still scale by `servings / baseServings` to respect the
  // "portions to view" selector.
  // NOTE: declared after `liveIngredientPerServing` which depends on `baseServings`.

  // Totals use `effectiveMacros` so per-ingredient overrides take precedence
  // over the matched snapshot (Batch 2.7). Sugar / sodium don't have an
  // override surface yet — they stay on the persisted snapshot columns.
  const ingredientTotal = useMemo(
    () =>
      ingredients.reduce(
        (acc, ing) => {
          const eff = effectiveMacros(ing);
          return {
            calories: acc.calories + eff.calories,
            protein: acc.protein + eff.protein,
            carbs: acc.carbs + eff.carbs,
            fat: acc.fat + eff.fat,
            fiberG: acc.fiberG + (eff.fiber ?? ing.fiberG ?? 0),
            sugarG: acc.sugarG + (ing.sugarG ?? 0),
            sodiumMg: acc.sodiumMg + (ing.sodiumMg ?? 0),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
      ),
    [ingredients],
  );

  // Live per-serving totals from effective macros (Batch 2.7). When the
  // recipe has any ingredient rows, these override the persisted
  // `displayRecipe` calories/macros so add-ingredient and override flows
  // reflect immediately before the user saves the recipe-level totals.
  const liveIngredientPerServing = useMemo(
    () => recomputeRecipeTotals(ingredients, baseServings),
    [ingredients, baseServings],
  );

  // Top-of-recipe "portions to view" macros — prefer live ingredient totals
  // (per-serving) scaled by the viewer's chosen portion count when we have
  // ingredient rows; else fall back to the persisted recipe per-serving
  // macros scaled the same way.
  const perServingBase = ingredients.length > 0
    ? liveIngredientPerServing
    : {
        calories: displayRecipe.calories,
        protein: displayRecipe.protein,
        carbs: displayRecipe.carbs,
        fat: displayRecipe.fat,
      };
  const viewScale = servings / Math.max(1, baseServings);
  // Polish (2026-04-25) — formatMacroValue centralises per-macro rounding so
  // protein/carbs/fat get 1-decimal precision (no more "105.80000000000001g")
  // while calories stay integer. Single source of truth lives at
  // src/lib/nutrition/formatMacro.ts.
  const scaledMacros = {
    calories: formatMacroValue(perServingBase.calories * viewScale, "calories"),
    protein: formatMacroValue(perServingBase.protein * viewScale, "protein"),
    carbs: formatMacroValue(perServingBase.carbs * viewScale, "carbs"),
    fat: formatMacroValue(perServingBase.fat * viewScale, "fat"),
  };

  // Scaled micronutrients — from ingredient sum or recipe-level fallback
  const scaledMicros = {
    fiberG: Math.round(((ingredientTotal.fiberG || displayRecipe.fiberG || 0) * servings) / baseServings * 10) / 10,
    sugarG: Math.round(((ingredientTotal.sugarG || displayRecipe.sugarG || 0) * servings) / baseServings * 10) / 10,
    sodiumMg: Math.round(((ingredientTotal.sodiumMg || displayRecipe.sodiumMg || 0) * servings) / baseServings),
  };

  // True when any ingredient in this recipe was matched against the
  // FatSecret database — drives the attribution badge per FatSecret ToS.
  const hasFatSecretIngredients = useMemo(
    () => ingredients.some((ing) =>
      typeof ing.source === "string" &&
      ing.source.toLowerCase().includes("fatsecret"),
    ),
    [ingredients],
  );

  const recipeMacrosToShow = useMemo(() => {
    const filtered = trackedMacros.filter((k) => RECIPE_MACRO_KEYS_FOR_FILTER.has(k));
    return filtered.length > 0 ? filtered : ["protein", "carbs", "fat"];
  }, [trackedMacros]);

  // macroAccuracy available if needed: Math.abs(ingredientTotal.calories - displayRecipe.calories)

  const persistRecipeYield = useCallback(async (opts?: { explicitServings?: number; silentNoop?: boolean }) => {
    if (!authUserId || !isMyRecipe || !dbMacros) return;
    const raw = opts?.explicitServings ?? Number(recipeYieldDraft);
    const newS = Math.max(1, Math.min(48, Math.round(Number(raw)) || 1));
    const oldS = Math.max(1, baseServings);
    if (newS === oldS) {
      if (!opts?.silentNoop) toast.message("Servings unchanged");
      return;
    }
    setRecipeYieldSaving(true);
    try {
      let calories: number;
      let protein: number;
      let carbs: number;
      let fat: number;
      let fiber_g: number;
      let sugar_g: number;
      let sodium_mg: number;

      if (ingredients.length > 0) {
        const t = ingredientTotal;
        calories = Math.max(0, Math.round(t.calories / newS));
        protein = Math.max(0, Math.round((t.protein / newS) * 10) / 10);
        carbs = Math.max(0, Math.round((t.carbs / newS) * 10) / 10);
        fat = Math.max(0, Math.round((t.fat / newS) * 10) / 10);
        fiber_g = Math.max(0, Math.round((t.fiberG / newS) * 10) / 10);
        sugar_g = Math.max(0, Math.round((t.sugarG / newS) * 10) / 10);
        sodium_mg = Math.max(0, Math.round(t.sodiumMg / newS));
      } else {
        calories = Math.max(0, Math.round((dbMacros.calories * oldS) / newS));
        protein = Math.max(0, Math.round(((dbMacros.protein * oldS) / newS) * 10) / 10);
        carbs = Math.max(0, Math.round(((dbMacros.carbs * oldS) / newS) * 10) / 10);
        fat = Math.max(0, Math.round(((dbMacros.fat * oldS) / newS) * 10) / 10);
        fiber_g = Math.max(0, Math.round(((dbMacros.fiberG * oldS) / newS) * 10) / 10);
        sugar_g = Math.max(0, Math.round(((dbMacros.sugarG * oldS) / newS) * 10) / 10);
        sodium_mg = Math.max(0, Math.round((dbMacros.sodiumMg * oldS) / newS));
      }

      const { error } = await supabase
        .from("recipes")
        .update({
          servings: newS,
          calories,
          protein,
          carbs,
          fat,
          fiber_g,
          sugar_g,
          sodium_mg,
        })
        .eq("id", recipe.id)
        .eq("author_id", authUserId);

      if (error) {
        toast.error(error.message);
        return;
      }

      setDbServings(newS);
      setDbMacros({
        calories,
        protein,
        carbs,
        fat,
        fiberG: fiber_g,
        sugarG: sugar_g,
        sodiumMg: sodium_mg,
      });
      setServings((prev) => Math.min(Math.max(1, prev), newS));
      setRecipeYieldDraft(String(newS));
      await refreshMyLibraryRecipes();
      toast.success(`Recipe yields ${newS} servings — per-serving nutrition updated.`);
    } catch {
      toast.error("Could not update recipe yield.");
    } finally {
      setRecipeYieldSaving(false);
    }
  }, [
    authUserId,
    isMyRecipe,
    dbMacros,
    recipeYieldDraft,
    baseServings,
    ingredients,
    ingredientTotal,
    recipe.id,
    refreshMyLibraryRecipes,
  ]);

  const commitInlineRecipeYield = useCallback(async () => {
    if (recipeYieldEscapeBlurRef.current) {
      recipeYieldEscapeBlurRef.current = false;
      return;
    }
    if (!recipeYieldEditing) return;
    const newS = Math.max(1, Math.min(48, Math.round(Number(recipeYieldDraft)) || 1));
    setRecipeYieldDraft(String(newS));
    setRecipeYieldEditing(false);
    if (newS === Math.max(1, baseServings)) return;
    await persistRecipeYield({ explicitServings: newS, silentNoop: true });
  }, [recipeYieldEditing, recipeYieldDraft, baseServings, persistRecipeYield]);

  const cancelInlineRecipeYield = useCallback(() => {
    recipeYieldEscapeBlurRef.current = true;
    setRecipeYieldDraft(String(Math.max(1, baseServings)));
    setRecipeYieldEditing(false);
    recipeYieldInputRef.current?.blur();
  }, [baseServings]);

  // Batch 2.7 — persist a new user-added ingredient row. Uses the same
  // Supabase path as the verify flow (single insert into `recipe_ingredients`)
  // and fires `recipe_ingredient_added` with the match outcome.
  const handleAddIngredient = useCallback(
    async (payload: AddIngredientPayload) => {
      if (!authUserId || !isMyRecipe) {
        toast.error("Only the recipe author can add ingredients.");
        return;
      }
      const insertRow: Record<string, unknown> = {
        recipe_id: recipe.id,
        name: payload.name,
        amount: payload.amount ? Number(payload.amount) : null,
        unit: payload.unit || null,
        calories: Math.round(payload.calories),
        protein: Math.round(payload.protein * 10) / 10,
        carbs: Math.round(payload.carbs * 10) / 10,
        fat: Math.round(payload.fat * 10) / 10,
        fiber_g: Math.round(payload.fiberG * 10) / 10,
        sugar_g: Math.round(payload.sugarG * 10) / 10,
        sodium_mg: Math.round(payload.sodiumMg),
        is_verified: payload.hasMatch && payload.confidence >= 0.5,
        source: payload.source,
        confidence: payload.confidence,
        added_by_user: true,
      };
      if (payload.overrideMacros) insertRow.override_macros = payload.overrideMacros;

      const { data, error } = await supabase
        .from("recipe_ingredients")
        .insert(insertRow)
        .select(
          "id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, source, override_macros, added_by_user, confidence",
        )
        .single();

      if (error || !data) {
        toast.error(error?.message ?? "Failed to add ingredient");
        return;
      }

      const mapped = mapDbIngredientToRow(data as DbIngredientRow);
      setDbIngredients((prev) => [...prev, mapped]);
      setDbIngredientIds((prev) => [...prev, (data as { id: string }).id]);
      track(AnalyticsEvents.recipe_ingredient_added, {
        recipeId: recipe.id,
        hasMatch: payload.hasMatch,
        // L6 G4 (2026-04-18) — reuse the shared `classifyConfidence`
        // classifier so the bucket thresholds never drift from the
        // existing ConfidenceDot + verify-pipeline logic. When there
        // was no match at all (pure manual add), the confidence is
        // 0 and buckets as "low".
        confidence_bucket: classifyConfidence(payload.confidence),
      });
      toast.success(
        payload.hasMatch
          ? `Added ${payload.name}`
          : `Added ${payload.name} (manual macros)`,
      );
    },
    [authUserId, isMyRecipe, recipe.id],
  );

  // Batch 2.7 — pin a manual macro override on an existing ingredient row.
  const handleOverrideSave = useCallback(
    async (index: number, override: IngredientOverride) => {
      if (!authUserId || !isMyRecipe) return;
      const ingId = dbIngredientIds[index];
      if (!ingId) return;
      const { error } = await supabase
        .from("recipe_ingredients")
        .update({ override_macros: override })
        .eq("id", ingId);
      if (error) {
        toast.error("Failed to save override");
        return;
      }
      const priorRow = dbIngredients[index];
      setDbIngredients((prev) =>
        prev.map((ing, i) => (i === index ? { ...ing, overrideMacros: override } : ing)),
      );
      track(AnalyticsEvents.recipe_ingredient_overridden, {
        recipeId: recipe.id,
        ingredientPosition: index,
        // L6 G4 (2026-04-18) — bucket the row's PRE-override
        // confidence so product can answer "do people override
        // high-confidence matches too?". The `IngredientRow` itself
        // only stores `isVerified` (true when the pipeline returned a
        // match with confidence >= 0.5 at insert time), which mirrors
        // the UI's `ConfidenceDot level={ing.isVerified ? "high" : "medium"}`
        // decision. No raw confidence is persisted, so we reuse the
        // UI's mapping here instead of inventing a new threshold.
        confidence_bucket: priorRow?.isVerified ? "high" : "medium",
      });
      toast.success("Nutrition override saved");
    },
    [authUserId, isMyRecipe, dbIngredientIds, dbIngredients, recipe.id],
  );

  // Batch 2.7 — clear a previously-pinned override, reverting to matched macros.
  const handleOverrideReset = useCallback(
    async (index: number) => {
      if (!authUserId || !isMyRecipe) return;
      const ingId = dbIngredientIds[index];
      if (!ingId) return;
      const { error } = await supabase
        .from("recipe_ingredients")
        .update({ override_macros: null })
        .eq("id", ingId);
      if (error) {
        toast.error("Failed to clear override");
        return;
      }
      const priorRow = dbIngredients[index];
      setDbIngredients((prev) =>
        prev.map((ing, i) => {
          if (i !== index) return ing;
          const { overrideMacros: _drop, ...rest } = ing;
          return rest as IngredientRow;
        }),
      );
      track(AnalyticsEvents.recipe_ingredient_override_cleared, {
        recipeId: recipe.id,
        ingredientPosition: index,
        // L6 G4 (2026-04-18) — same bucket derivation as the
        // `_overridden` emit above. Classifier reused from the UI.
        confidence_bucket: priorRow?.isVerified ? "high" : "medium",
      });
      toast.success("Override cleared — using matched macros");
    },
    [authUserId, isMyRecipe, dbIngredientIds, dbIngredients, recipe.id],
  );

  if (!isCatalogRecipe && dbLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="aspect-video w-full rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
        </div>
        <p className="text-center text-sm text-muted-foreground">Loading recipe…</p>
      </div>
    );
  }

  if (!isCatalogRecipe && dbFetchFailed) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 p-2 text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
        >
          <Icons.back className="w-5 h-5" />
          Back
        </button>
        <p className="text-foreground">This recipe could not be loaded.</p>
      </div>
    );
  }

  if (cookModeOpen && instructionSteps.length > 0) {
    return (
      <CookMode
        recipe={displayRecipe}
        instructionSteps={instructionSteps}
        ingredients={ingredients}
        servings={servings}
        baseServings={baseServings}
        onExit={() => setCookModeOpen(false)}
        onViewTracker={onViewTracker}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      {/* Audit 2026-04-30 visual-qa P0 #3 + P2 #17 — on a 375px
          viewport with all 7 header items rendered the title shrunk
          to 0-2 chars. Fix: every button is now `shrink-0`, and below
          `md` the secondary actions (Edit, Unpublish, Go public)
          collapse into a meatball menu so the always-visible row is
          Back · Title · Cook · Save · Share · ⋮ . z-index bumped to
          z-20 to win against the hero `shadow-2xl` stacking context. */}
      <div className="sticky top-0 backdrop-blur-xl bg-card/80 border-b border-border/50 px-6 py-4 flex items-center gap-4 z-20 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all shrink-0"
        >
          <Icons.back className="w-5 h-5" />
        </button>
        {/* 2026-04-20 prototype port — centred bold title in the
            sticky top bar (was a gradient left-aligned headline).
            Truncated with ellipsis if overflowing. */}
        {/* F-85 (2026-04-25) — web parity for de-CAPS recipe title. */}
        <h2 className="flex-1 min-w-0 text-center font-semibold text-foreground truncate">{normaliseRecipeDisplayTitle(recipe.title)}</h2>
        {isMyRecipe ? (
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
              router.replace(`/home?${q}`, { scroll: false });
            }}
            className="hidden md:inline-flex px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/60 font-semibold shrink-0"
          >
            Edit
          </button>
        ) : null}
        {isMyRecipe && isPublished === false ? (
          <div className="hidden md:inline-flex shrink-0">
            <GoPublicDialog
              recipeTitle={recipe.title}
              disabled={dbLoading}
              onConfirmPublish={() => void setPublished(true)}
              triggerLabel="Go public"
            />
          </div>
        ) : null}
        {isMyRecipe && isPublished === true ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={dbLoading}
                className="hidden md:inline-flex px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/60 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Unpublish
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Unpublish this recipe?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes it from public discovery. It will stay in your library as a private draft.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => void setPublished(false)}>
                  Unpublish
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {instructionSteps.length > 0 && (
          <button
            type="button"
            onClick={() => setCookModeOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all shrink-0"
          >
            <Icons.cook className="w-4 h-4" />
            Cook
          </button>
        )}
        {/* Prototype port (2026-04-20, mobile parity commit 26a63bf):
            save (bookmark) sits left of share in the header — web was
            already in that order so no reorder. Buttons now carry a
            1pt border, small drop-shadow, and foreground icon colour
            so they remain legible if the header is rendered against a
            pale hero photo on mobile-web (<md). The saved state keeps
            a primary tint so it's still scannable. */}
        <button
          type="button"
          onClick={() => toggleSaveRecipe(recipe.id, userTier)}
          className={`p-2.5 rounded-xl border transition-all shadow-sm shrink-0 ${
            saved
              ? "text-primary bg-primary/10 border-primary/40 shadow-primary/20"
              : "text-foreground border-border/70 bg-card hover:bg-muted/60"
          }`}
          aria-label={saved ? "Remove from library" : "Save to library"}
        >
          <Icons.save className="w-5 h-5" fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={() => void shareRecipeDeepLink(recipe.id)}
          className="p-2.5 text-foreground border border-border/70 bg-card hover:bg-muted/60 rounded-xl transition-all shadow-sm shrink-0"
          aria-label="Share recipe link"
        >
          <Icons.share className="w-5 h-5" />
        </button>
        {/* Audit 2026-04-30 visual-qa P0 #3 — mobile-only meatball
            menu collapses Edit / Unpublish / Go public so the title
            keeps room to breathe on narrow viewports. The desktop
            inline buttons above are `hidden md:inline-flex`; this
            menu is `md:hidden`. Renders only when there's at least
            one secondary action to surface (i.e. it's the user's
            own recipe). */}
        {isMyRecipe ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="md:hidden p-2.5 text-foreground border border-border/70 bg-card hover:bg-muted/60 rounded-xl transition-all shadow-sm shrink-0"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
                  router.replace(`/home?${q}`, { scroll: false });
                }}
              >
                Edit
              </DropdownMenuItem>
              {isPublished === false ? (
                <DropdownMenuItem
                  disabled={dbLoading}
                  onSelect={() => setGoPublicMobileOpen(true)}
                >
                  Go public
                </DropdownMenuItem>
              ) : null}
              {isPublished === true ? (
                <DropdownMenuItem
                  disabled={dbLoading}
                  onSelect={() => setUnpublishOpen(true)}
                >
                  Unpublish
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {/* Audit 2026-04-30 visual-qa P0 #3 — controlled mobile-menu
          dialogs. They're rendered outside the sticky header so the
          dropdown can close cleanly before the dialog opens. */}
      {isMyRecipe && isPublished === true ? (
        <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
          <AlertDialogContent className="bg-card border border-border rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Unpublish this recipe?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes it from public discovery. It will stay in your library as a private draft.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                onClick={() => {
                  setUnpublishOpen(false);
                  void setPublished(false);
                }}
              >
                Unpublish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {isMyRecipe && isPublished === false && goPublicMobileOpen ? (
        <GoPublicDialog
          recipeTitle={recipe.title}
          disabled={dbLoading}
          onConfirmPublish={() => {
            setGoPublicMobileOpen(false);
            void setPublished(true);
          }}
          triggerLabel="Go public"
          autoOpen
          onAutoOpenClose={() => setGoPublicMobileOpen(false)}
        />
      ) : null}

      {/* 2026-04-30 ui-product-designer recipe-detail audit: tightened
          page rhythm from `space-y-8` (32px) to `space-y-5` (20px) so
          the hero stack reads as one composed unit instead of five
          separate cards. Mobile parity in `apps/mobile/app/recipe/
          [id].tsx` body StyleSheet (Spacing.md = 12). */}
      <div className="px-6 py-8 space-y-5">
        <div className="rounded-xl border border-border/80 bg-muted/90 px-4 py-3 text-sm text-foreground">
          {isCatalogRecipe ? (
            <p>
              <span className="font-semibold text-foreground">Verified curated recipe.</span> Macros and
              ingredients are checked against structured sources in our catalog.
            </p>
          ) : (
            <p>
              <span className="font-semibold text-foreground">Community recipe.</span> Macros are as
              published by the author; ingredient nutrition may be mixed verified and estimated — review before relying on
              it for medical goals.
            </p>
          )}
        </div>

        {/* Hero Image */}
        {/* Phase 5 / B5 (2026-04-27) — matching view-transition-name
            anchors the card-to-detail morph. Spec §1.1 + Surface H.

            Recime parity (2026-04-30): when the recipe has no real
            image (hydration defaulted to DEFAULT_UPLOADED_RECIPE_IMAGE
            in AppDataContext) but the source URL is a YouTube watch /
            shorts URL, surface the YT thumbnail instead of the stock
            placeholder. See `src/lib/recipes/heroImageFallback.ts`. */}
        {(() => {
          const hasRealImage =
            typeof recipe.image === "string" &&
            recipe.image !== "" &&
            recipe.image !== DEFAULT_UPLOADED_RECIPE_IMAGE;
          const ladderSrc = pickHeroImageUrl({
            image_url: hasRealImage ? recipe.image : null,
            source_url: recipe.sourceUrl ?? null,
          });
          const heroSrc = ladderSrc ?? recipe.image;
          return (
            <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
              {/* eslint-disable-next-line @next/next/no-img-element -- viewTransitionName + arbitrary hero ladder URLs */}
              <img
                src={heroSrc}
                alt={recipe.title}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            </div>
          );
        })()}

        {/* 2026-04-30 ui-product-designer recipe-detail audit Fix 1 —
            web parity gap closed. Mobile body has always rendered the
            recipe title + byline subtitle below the hero; the web
            detail leaned on the sticky-bar `<h2>` only, leaving the
            body looking unanchored once you scrolled. Inserted body
            `<h1>` (the real heading for the page) + a single
            flex-wrap subtitle row joined by `·` ("by author · lunch ·
            serves 3"). Author is tappable when `recipe.sourceUrl` is
            present, no underline. Mobile parity in
            `apps/mobile/app/recipe/[id].tsx` (subtitleRow). */}
        {(() => {
          const bylineLabel: string | null =
            recipe.creatorName && recipe.creatorName !== "Community"
              ? recipe.creatorName
              : null;
          const bylineHref =
            typeof recipe.sourceUrl === "string" && recipe.sourceUrl.trim()
              ? recipe.sourceUrl.trim()
              : null;
          const slots: string[] = Array.isArray(recipe.mealSlots)
            ? (recipe.mealSlots as readonly string[]).map(String)
            : [];
          // 2026-05-02 v4 (recipe-detail-tiles-and-kcal): user feedback
          // "cals need to be clearer" — kcal got promoted out of the
          // subtitle row into its own dedicated headline line directly
          // under the title. The subtitle below stays as the meta line
          // ("lunch · serves 3 · by author"). composeSubtitleParts is
          // no longer passed `kcal`, so the helper drops the token
          // cleanly (the unit-tested "drops kcal when omitted" path).
          const subtitleParts = composeSubtitleParts({
            authorLabel: bylineLabel,
            slots,
            servings: baseServings,
          });
          // PR1 (Paprika parity, 2026-05-02): per-portion kcal stays
          // invariant under the viewing-servings stepper — per-portion
          // is per-portion. The secondary "X kcal total for N portions"
          // line below tracks the multiplier honestly, so the visible
          // batch number tracks the user's chosen scale without
          // pretending the per-portion value has changed.
          const kcalForLine = Math.round(perServingBase.calories);
          const hasScaledAway = servings !== baseServings;
          const totalKcalForView = Math.round(perServingBase.calories * servings);
          return (
            <div className="space-y-1">
              <h1
                className="text-2xl font-bold text-foreground leading-tight"
                data-testid="recipe-body-title"
              >
                {normaliseRecipeDisplayTitle(recipe.title)}
              </h1>
              {kcalForLine > 0 ? (
                <div
                  className="mt-1.5 flex items-baseline gap-1.5"
                  data-testid="recipe-kcal-line"
                  aria-label={`${kcalForLine} kilocalories per portion`}
                >
                  <span
                    className="text-[17px] font-bold text-foreground tabular-nums leading-none"
                    data-testid="recipe-kcal-number"
                  >
                    {kcalForLine} kcal
                  </span>
                  <span aria-hidden className="text-muted-foreground/70 text-sm">·</span>
                  <span className="text-sm text-muted-foreground">per portion</span>
                </div>
              ) : null}
              {kcalForLine > 0 && hasScaledAway && totalKcalForView > 0 ? (
                <div
                  className="text-xs text-muted-foreground tabular-nums"
                  data-testid="recipe-kcal-total-line"
                  aria-label={`${totalKcalForView} kilocalories total for ${servings} portions`}
                >
                  {totalKcalForView} kcal total for {servings} portions
                </div>
              ) : null}
              {subtitleParts.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground"
                  data-testid="recipe-subtitle-row"
                >
                  {subtitleParts.map((part, idx) => {
                    const isAuthor = part.key === "by" && Boolean(bylineHref);
                    return (
                      <span key={part.key} className="inline-flex items-center">
                        {idx > 0 ? (
                          <span aria-hidden className="mr-1 text-muted-foreground/70">
                            ·
                          </span>
                        ) : null}
                        {isAuthor ? (
                          <a
                            href={bylineHref ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground no-underline hover:text-foreground"
                          >
                            {part.label}
                          </a>
                        ) : (
                          <span>{part.label}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* 2026-04-20 prototype port — tag pill row directly under
            the hero. Mobile parity (2026-04-30 ui-product-designer
            audit Fix 1): meal-slot pills now live in the new subtitle
            row above (`by author · lunch · serves 3`), so this row
            is gluten-classifier only on both platforms. The
            `<TrustChip>` is the spec's "TrustChip immediately under
            the title" surface from D-2026-04-27-16. */}
        {(() => {
          // GW-08 (audit 2026-04-28): the recipe-level fit-percent
          // pill and the source TrustChip were removed. The gluten
          // classifier chip stays — it walks ingredient strings
          // against a real keyword set and is honest.
          const glutenResult = classifyRecipeGluten(
            ingredients.map((ing) => String(ing.name ?? "")),
          );
          if (!glutenResult.variant) return null;
          return (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Recipe tags">
              <TrustChip
                variant={glutenResult.variant}
                data-testid="recipe-detail-gluten-chip"
              />
            </div>
          );
        })()}

        {!isCatalogRecipe && dbDescription && sanitizeRecipeDescription(dbDescription) && (
          <p className="text-muted-foreground leading-relaxed">
            {sanitizeRecipeDescription(dbDescription)}
          </p>
        )}

        {/*
          T12 (2026-04-24) — regulated-allergen callout. Closes DI-P0-01.
          Empty array means "not tagged," not "safe" — the caveat runs
          both when allergens are present and when the array is empty so
          a user with a severe allergy never reads silence as safety.
          Never paywalled.
        */}
        {(() => {
          const allergensFromRecipe = Array.isArray((recipe as { allergens?: readonly string[] }).allergens)
            ? ((recipe as { allergens?: readonly string[] }).allergens as readonly string[])
            : [];
          const normalised = normaliseAllergenIds(allergensFromRecipe);
          const containsLine = formatContainsLine(normalised);
          return (
            <div
              className="rounded-xl border border-border bg-card/60 p-3 text-xs"
              role="note"
              aria-label="Regulated-allergen information"
              data-testid="recipe-allergen-callout"
            >
              {containsLine ? (
                <p className="font-semibold text-foreground mb-1">{containsLine}</p>
              ) : (
                <p className="font-semibold text-foreground mb-1">Not tagged for allergens</p>
              )}
              <p className="text-muted-foreground leading-snug">
                We tag recipes from matched ingredients at import and verify time. Always verify ingredients against the original source if an allergen is a safety concern.
              </p>
            </div>
          );
        })()}

        {/* Creator Info */}
        <div className="flex items-center gap-4 p-6 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- creator avatar URLs */}
          <img src={recipe.creatorImage} alt={recipe.creatorName} className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">{recipe.creatorName}</p>
            <p className="text-sm text-muted-foreground">
              {!followMetaLoaded && !isCatalogRecipe ? (
                <span className="text-muted-foreground">Loading reach…</span>
              ) : (
                <>
                  {(publicSaveCount != null ? publicSaveCount : recipe.savedCount).toLocaleString()} saves
                  {!isCatalogRecipe && followerCount != null
                    ? ` · ${followerCount.toLocaleString()} followers`
                    : null}
                </>
              )}
            </p>
          </div>
          {showFollowButton ? (
            <button
              type="button"
              disabled={followBusy}
              onClick={() => void toggleFollow()}
              className="px-5 py-2.5 bg-primary text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              {followBusy ? "…" : isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {/* 2026-04-30 ui-product-designer recipe-detail audit Fix 2 —
            the 4-tile info row (Prep / Cook / Portions / Confidence)
            consumed a third of the screen on every recipe regardless
            of whether the timings were known. Replaced with a compact
            single-line form. Hidden entirely when both prep and cook
            are unknown (servings already lives in the subtitle and the
            "Servings to view" stepper below covers per-serving sizing).
            Confidence tile removed — backstage signal, no actionable
            interpretation for a user. Mobile parity in
            `apps/mobile/app/recipe/[id].tsx` (timeStatsRow). */}
        {(() => {
          const hasPrep = dbPrepMin != null && dbPrepMin > 0;
          const hasCook = dbCookMin != null && dbCookMin > 0;
          const showRow = shouldRenderTimeStats(dbPrepMin, dbCookMin);
          const showOwnerEdit =
            isMyRecipe && !isCatalogRecipe && (showRow || true);
          if (!showRow && !showOwnerEdit) return null;
          const segments: string[] = [];
          if (hasPrep) segments.push(`${prepDisplay} prep`);
          if (hasCook) segments.push(`${cookDisplay} cook`);
          return (
            <div
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
              data-testid="recipe-time-stats"
            >
              {showRow ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icons.timer className="w-3.5 h-3.5 text-muted-foreground/80" />
                  <span>{segments.join(" · ")}</span>
                </span>
              ) : null}
              {showOwnerEdit ? (
                recipeYieldEditing ? (
                  <span className="inline-flex items-center gap-1">
                    <span>Recipe makes</span>
                    <input
                      ref={recipeYieldInputRef}
                      type="number"
                      min={1}
                      max={48}
                      inputMode="numeric"
                      disabled={recipeYieldSaving || dbLoading}
                      value={recipeYieldDraft}
                      onChange={(e) => setRecipeYieldDraft(e.target.value)}
                      onBlur={() => void commitInlineRecipeYield()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelInlineRecipeYield();
                        }
                      }}
                      className="w-12 min-w-0 rounded-md border border-primary bg-background px-1 py-0.5 text-center text-xs font-bold text-foreground"
                      aria-label="Total portions this full recipe makes"
                    />
                    <span>portions</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={recipeYieldSaving || dbLoading}
                    onClick={() => {
                      recipeYieldEscapeBlurRef.current = false;
                      setRecipeYieldDraft(String(baseServings));
                      setRecipeYieldEditing(true);
                    }}
                    title="Change how many portions the full recipe makes"
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                    aria-label={`Full recipe makes ${baseServings} portions. Click to edit.`}
                  >
                    Edit servings
                  </button>
                )
              ) : null}
            </div>
          );
        })()}

        {/* Servings to view — how many portions you are looking at /
            logging. Bounded 1..99, debounced 200ms, +/- with disabled
            states at the bounds (mirrors mobile). The label is
            aligned with mobile to "Servings to view" so the
            cross-platform copy stays in sync. PR1 (Paprika parity,
            2026-05-02). */}
        <div
          className="bg-card rounded-2xl p-4 flex items-center justify-between border border-border"
          data-testid="recipe-view-servings-stepper"
        >
          <span className="font-semibold text-foreground text-sm">Servings to view</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleViewServingsStep(-1)}
              disabled={servings <= RECIPE_VIEW_SERVINGS_MIN}
              aria-label="Decrease servings to view"
              data-testid="recipe-view-servings-decrement"
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span
              className="w-8 text-center font-bold text-foreground tabular-nums"
              role="status"
              aria-live="polite"
              aria-label={`${servings} servings to view`}
              data-testid="recipe-view-servings-value"
            >
              {servings}
            </span>
            <button
              type="button"
              onClick={() => handleViewServingsStep(1)}
              disabled={servings >= RECIPE_VIEW_SERVINGS_MAX}
              aria-label="Increase servings to view"
              data-testid="recipe-view-servings-increment"
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* 2026-05-01 v3 redesign — the bordered "Calories per portion"
            hero card that lived here is gone. kcal moved to the
            subtitle row above as a bold inline token (slot · serves
            · kcal · author). The macro tiles below now ARE the visual
            hero. The "Fits your day" verdict drops to a single text
            line below the macro grid (no card, no pill background) so
            it reads as a footnote of the macros, not a separate band.

            When nutrition is not yet computed we still render a single
            dimmed line so the user can tell the difference between
            "this recipe is 0 kcal" and "we haven't computed it yet"
            (P1-16 behaviour preserved). */}
        {(() => {
          const kcalNum = Math.round(scaledMacros.calories);
          const hasNutrition =
            kcalNum > 0 ||
            scaledMacros.protein > 0 ||
            scaledMacros.carbs > 0 ||
            scaledMacros.fat > 0;
          if (hasNutrition) return null;
          return (
            <div
              data-testid="recipe-nutrition-pending"
              className="rounded-xl border px-5 py-3 text-center text-sm font-semibold text-muted-foreground border-border bg-muted/30"
            >
              Calories not yet computed — open the Ingredients tab to verify
            </div>
          );
        })()}
        {/* v3 macro tiles — visual hero. 2026-05-02 v4 user feedback
            "the widgets should be the same size and fit on one row" —
            switched the wrap layout (which let fiber stand alone on
            row 2 at 48% width while p/c/f shared row 1) to a
            `grid grid-cols-4` layout. All tiles share width and read
            as one coherent grid. Users with extra tracked macros
            (sugar/sodium) spill onto row 2 at the same per-tile
            width, not at a different size. */}
        <div
          data-testid="recipe-macros-grid"
          className="mb-2 grid grid-cols-4 gap-2"
        >
          {recipeMacrosToShow.map((macro) => {
            const REF_SUGAR_G = 50;
            const REF_SODIUM_MG = 2300;
            const macroMap: Record<string, { label: string; cur: number; tgt: number; color: string; unit: string }> = {
              protein: {
                label: "Protein",
                cur: scaledMacros.protein,
                tgt: nutritionTargets.protein,
                color: "var(--macro-protein)",
                unit: "g",
              },
              carbs: {
                // P3-30 (2026-04-25): apply net-carbs lens. Refuses
                // "Net carbs" label when fibre is unknown.
                label: carbsLabel(scaledMicros.fiberG, netCarbsLensEnabled),
                cur: netCarbsForRow(scaledMacros.carbs, scaledMicros.fiberG, netCarbsLensEnabled),
                tgt: netCarbsForRow(nutritionTargets.carbs, nutritionTargets.fiber, netCarbsLensEnabled),
                color: "var(--macro-carbs)",
                unit: "g",
              },
              fat: {
                label: "Fat",
                cur: scaledMacros.fat,
                tgt: nutritionTargets.fat,
                color: "var(--macro-fat)",
                unit: "g",
              },
              fiber: {
                label: "Fiber",
                cur: scaledMicros.fiberG,
                tgt: nutritionTargets.fiber,
                color: "var(--macro-calories)",
                unit: "g",
              },
              sugar: {
                label: "Sugar",
                cur: scaledMicros.sugarG,
                tgt: REF_SUGAR_G,
                color: "#6c8cff",
                unit: "g",
              },
              sodium: {
                label: "Sodium",
                cur: scaledMicros.sodiumMg,
                tgt: REF_SODIUM_MG,
                color: "#f97316",
                unit: "mg",
              },
            };
            const m = macroMap[macro];
            if (!m) return null;
            // Polish (2026-04-25) — route per-macro rounding through the
            // shared helper. protein/carbs/fat now keep 1-decimal precision
            // (no more "105.80000000000001g"), calories+sodium stay integer.
            const displayAmount = formatMacroValue(m.cur, macro);
            return (
              <div
                key={macro}
                data-testid={`recipe-macro-tile-${macro}`}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm" style={{ background: m.color }} />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{m.label}</span>
                </div>
                <div className="text-lg font-extrabold tabular-nums text-foreground leading-tight">
                  {displayAmount}
                  {m.unit}
                </div>
                <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  of {m.tgt}
                  {m.unit}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${Math.min(m.cur / Math.max(m.tgt, 1), 1) * 100}%`,
                      backgroundColor: m.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* v3 (2026-05-01) — "Fits your day" verdict softened to a
            single text line below the macro tiles. No card, no pill
            background — just a coloured glyph + label. Logic
            delegated to `computeFitsYourDayVerdict` so web and mobile
            share the percent / tone / copy rules. */}
        {(() => {
          const verdict = computeFitsYourDayVerdict({
            kcal: scaledMacros.calories,
            targetCals: nutritionTargets.calories,
          });
          if (!verdict) return null;
          const toneVar =
            verdict.tone === "success"
              ? "var(--success)"
              : verdict.tone === "destructive"
                ? "var(--destructive)"
                : "var(--warning)";
          return (
            <div
              data-testid="recipe-fits-your-day"
              role="status"
              aria-label={verdict.a11y}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: toneVar }}
            >
              {verdict.fits ? (
                <Icons.check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
              ) : null}
              <span>{verdict.label}</span>
            </div>
          );
        })()}

        {/* Creator Discrepancy */}
        {isCatalogRecipe &&
          recipe.creatorCalories &&
          Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
              <Icons.caution className="w-4 h-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">
                  Creator stated {recipe.creatorCalories} kcal (
                  {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                </p>
                <p className="text-xs text-warning/80 mt-0.5">Verified value calculated from ingredient data</p>
              </div>
            </div>
          )}

        {/* Tab Bar — Ingredients / Steps / Nutrition (matches mobile) */}
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {(["ingredients", "steps", "nutrition"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "ingredients" ? "Ingredients" : tab === "steps" ? "Steps" : "Nutrition"}
            </button>
          ))}
        </div>

        {/* Ingredients Tab */}
        {activeTab === "ingredients" && (
          <>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {ingredients.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">No ingredients listed yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {ingredients.map((ingredient, index) => {
                  // Use effective macros so per-row overrides take precedence (Batch 2.7).
                  const eff = effectiveMacros(ingredient);
                  const ingCal = Math.round((eff.calories * servings) / baseServings);
                  const ingP = Math.round((eff.protein * servings) / baseServings);
                  const ingC = Math.round((eff.carbs * servings) / baseServings);
                  const ingF = Math.round((eff.fat * servings) / baseServings);
                  const macroTotal = ingP + ingC + ingF || 1;
                  const rowHasOverride = hasOverride(ingredient);
                  const rowAddedByUser = Boolean(ingredient.addedByUser);
                  /**
                   * 2026-05-02 fix — derive verification tier from
                   * the persisted `{is_verified, confidence, source}`
                   * triple so the dot, badge, and Verify CTA agree
                   * with what the row actually represents. Pre-fix,
                   * the dot used `isVerified` but the recipe-row
                   * "Verify →" CTA only suppressed when `isVerified`
                   * was true — which is correct for web today, but
                   * we route through the shared helper so web/mobile
                   * stay in sync if the rule shifts (e.g. trusting a
                   * USDA `source` even on legacy rows where
                   * `is_verified` was missed).
                   */
                  const verificationTier = deriveIngredientVerificationTier({
                    isVerified: ingredient.isVerified ?? null,
                    confidence: ingredient.confidence ?? null,
                    source: ingredient.source ?? null,
                  });
                  const showVerifyCta = ingredientShouldShowVerifyCta(verificationTier);
                  return (
                    <div key={index} className="px-4 py-3 flex items-center gap-3 group">
                      <ConfidenceDot level={verificationTier === "verified" ? "high" : "medium"} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{ingredient.name}</p>
                          {rowHasOverride ? (
                            <Badge
                              variant="override"
                              title="Manual macro override is pinned on this row."
                            >
                              Override
                            </Badge>
                          ) : null}
                          {rowAddedByUser ? (
                            <Badge
                              variant="added"
                              title="Added by you after import."
                            >
                              Added
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {/* 2026-05-02 fix — defensive amount/unit
                              formatter dedupes "1 1 breast" when
                              USDA/FatSecret persists a count-prefixed
                              portion label like "1 breast" into the
                              unit column. Mirrors the mobile fix in
                              `apps/mobile/app/recipe/[id].tsx`. */}
                          {ingredient.amount
                            ? formatIngredientAmountUnit(
                                formatIngredientAmount((parseFloat(ingredient.amount) * servings) / baseServings),
                                ingredient.unit,
                              )
                            : ingredient.unit}
                        </p>
                      </div>
                      {/* P2-30 web parity (2026-04-25 ui-critic):
                          suppress the "0 kcal" right column when the
                          ingredient has no resolved nutrition. */}
                      {ingCal > 0 ? (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{ingCal} kcal</span>
                      ) : null}
                      {/* Stacked P/C/F bar */}
                      <div className="w-12 h-2 rounded-full overflow-hidden flex shrink-0">
                        <div style={{ width: `${(ingP / macroTotal) * 100}%`, backgroundColor: "var(--macro-protein)" }} />
                        <div style={{ width: `${(ingC / macroTotal) * 100}%`, backgroundColor: "var(--macro-carbs)" }} />
                        <div style={{ width: `${(ingF / macroTotal) * 100}%`, backgroundColor: "var(--macro-fat)" }} />
                      </div>
                      {/* Phase 4 / B3.X — per-ingredient SourceDot.
                          The ConfidenceDot above stays for the
                          high/medium-confidence visual; the SourceDot
                          here completes the trust posture (provenance
                          colour at row right edge, spec §1.6). */}
                      <SourceDot
                        source={mapMealSourceToDot(ingredient.source)}
                        size={6}
                        className="shrink-0"
                        data-testid={`recipe-ingredient-source-${index}`}
                      />
                      {/* Phase 4 / B3.X — explicit "Verify →" inline
                          when the row is estimated. Sits above the
                          existing Fix/Override hover affordances and
                          is always visible for unverified rows so
                          users don't have to discover it through
                          hover (mobile parity).

                          2026-05-02 — visibility now follows the
                          shared verification tier (is_verified ||
                          trusted source) so the CTA disappears as
                          soon as the user has resolved the row,
                          mirroring the mobile fix. */}
                      {dbIngredientIds[index] && showVerifyCta ? (
                        <button
                          type="button"
                          onClick={() => { setVerifyIndex(index); setVerifySearchOpen(true); }}
                          className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                          aria-label={`Verify ${ingredient.name}`}
                          data-testid={`recipe-ingredient-verify-${index}`}
                        >
                          Verify →
                        </button>
                      ) : null}
                      {dbIngredientIds[index] && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => { setVerifyIndex(index); setVerifySearchOpen(true); }}
                            className="text-xs text-primary hover:bg-primary/10 px-2 py-0.5 rounded-full"
                            aria-label={`Fix match for ${ingredient.name}`}
                          >
                            Fix
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideIndex(index)}
                            className="text-xs text-primary hover:bg-primary/10 px-2 py-0.5 rounded-full"
                            aria-label={`Override nutrition for ${ingredient.name}`}
                          >
                            Override
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {isMyRecipe && !isCatalogRecipe && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setAddIngOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-card px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Add an ingredient the importer missed"
                >
                  <span aria-hidden>+</span>
                  Add ingredient
                </button>
                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                  Missed an ingredient during import? Add it here and totals update live.
                </p>
              </div>
            )}
          </div>
          {/* FatSecret attribution — ToS requires the badge wherever
              FatSecret-sourced content is displayed. Rendered at the
              foot of the ingredient list so it's adjacent to the
              ingredient rows it applies to. */}
          <FatSecretBadge
            show={hasFatSecretIngredients}
            variant="text"
            className="mt-3"
            data-testid="fatsecret-badge-ingredients"
          />
          </>
        )}

        {/* Steps Tab */}
        {activeTab === "steps" && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            {instructionSteps.length === 0 ? (
              <p className="text-muted-foreground text-sm">No instructions yet.</p>
            ) : (
              instructionSteps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <p className="text-sm text-foreground pt-0.5 leading-relaxed">{step}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Nutrition Tab */}
        {activeTab === "nutrition" && (
          <div className="space-y-4">
            {/* 2x2 stat grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calories", value: `${Math.round(scaledMacros.calories)}`, unit: "kcal" },
                { label: "Protein", value: `${Math.round(scaledMacros.protein)}`, unit: "g" },
                {
                  // P3-30: net-carbs lens for the macro chip strip too.
                  label: carbsLabel(scaledMicros.fiberG, netCarbsLensEnabled),
                  value: `${Math.round(netCarbsForRow(scaledMacros.carbs, scaledMicros.fiberG, netCarbsLensEnabled))}`,
                  unit: "g",
                },
                { label: "Fat", value: `${Math.round(scaledMacros.fat)}`, unit: "g" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <span className="text-lg font-bold text-foreground tabular-nums">{stat.value}</span>
                  <span className="text-xs text-muted-foreground ml-0.5">{stat.unit}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Micronutrient bars — real data from ingredients.
                2026-05-08 ui-critic F4 web parity: hide rows for missing
                values (>0 only) instead of rendering bare "0g" / "0mg"
                with a full progress bar (reads as "this recipe has zero
                fiber" not "we don't know yet"). */}
            {(() => {
              const microRows = [
                { name: "Fiber", pct: Math.min(100, Math.round((scaledMicros.fiberG / 28) * 100)), value: `${scaledMicros.fiberG}g`, raw: scaledMicros.fiberG },
                { name: "Sugar", pct: Math.min(100, Math.round((scaledMicros.sugarG / 50) * 100)), value: `${scaledMicros.sugarG}g`, raw: scaledMicros.sugarG },
                { name: "Sodium", pct: Math.min(100, Math.round((scaledMicros.sodiumMg / 2300) * 100)), value: `${scaledMicros.sodiumMg}mg`, raw: scaledMicros.sodiumMg },
              ].filter((row) => row.raw > 0);
              if (microRows.length === 0) return null;
              return (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Micronutrients</h4>
                  {microRows.map((micro) => (
                    <div key={micro.name} className="flex items-center gap-3">
                      <span className="text-xs text-foreground w-20 shrink-0">{micro.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${micro.pct}%`, backgroundColor: "var(--macro-calories)" }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right">{micro.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Buttons — Start Cooking + I Made This (matches mobile) */}
        <div className="flex gap-3">
          {instructionSteps.length > 0 && (
            <button
              type="button"
              onClick={() => setCookModeOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              <Icons.cook className="w-4 h-4" />
              Start Cooking
            </button>
          )}
          <button
            type="button"
            onClick={() => toast.success("Marked as made!")}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-card border border-border text-foreground font-bold text-sm hover:bg-muted transition-all"
          >
            <Icons.check className="w-4 h-4" />
            I Made This
          </button>
        </div>

        {/* Batch 3.8 — Personal notes + rating */}
        <RecipeNotesCard recipeId={recipe.id} userId={authUserId} />
      </div>

      {/* Food search dialog for ingredient verification */}
      <FoodSearch
        open={verifySearchOpen}
        onClose={() => { setVerifySearchOpen(false); setVerifyIndex(null); }}
        supabase={supabase}
        userId={authUserId}
        initialQuery={verifyIndex != null ? ingredients[verifyIndex]?.name ?? "" : ""}
        initialAmount={verifyIndex != null ? dbIngredients[verifyIndex]?.amount : null}
        initialUnit={verifyIndex != null ? dbIngredients[verifyIndex]?.unit : null}
        originalDescription={verifyIndex != null ? [
          dbIngredients[verifyIndex]?.amount,
          dbIngredients[verifyIndex]?.unit,
          ingredients[verifyIndex]?.name,
        ].filter(Boolean).join(" ") : null}
        onSelect={async (selection: FoodSearchSelection) => {
          if (verifyIndex == null) return;
          const ingId = dbIngredientIds[verifyIndex];
          if (!ingId) return;

          // 2026-05-06 audit (D1): per-serving-only path (FatSecret
          // no-metric foods). Use `macrosPerServing × quantity`
          // directly when `macrosPer100g` is null. Mirrors mobile.
          const isPerServingOnly =
            selection.macrosPer100g === null && Boolean(selection.macrosPerServing);
          const grams = isPerServingOnly
            ? 0
            : selection.chosenPortion.gramWeight * selection.quantity;
          const f = isPerServingOnly ? 0 : grams / 100;
          const ps = selection.macrosPerServing;
          const q = selection.quantity;
          const macros = isPerServingOnly && ps
            ? {
                calories: Math.round(ps.calories * q),
                protein: Math.round(ps.protein * q * 10) / 10,
                carbs: Math.round(ps.carbs * q * 10) / 10,
                fat: Math.round(ps.fat * q * 10) / 10,
              }
            : {
                calories: Math.round((selection.macrosPer100g?.calories ?? 0) * f),
                protein: Math.round((selection.macrosPer100g?.protein ?? 0) * f * 10) / 10,
                carbs: Math.round((selection.macrosPer100g?.carbs ?? 0) * f * 10) / 10,
                fat: Math.round((selection.macrosPer100g?.fat ?? 0) * f * 10) / 10,
              };
          const microsServing =
            (selection as { microsPerServing?: Record<string, number> }).microsPerServing ?? {};
          const fiberG = isPerServingOnly
            ? Math.round((microsServing.fiberG ?? 0) * q * 10) / 10
            : Math.round((selection.macrosPer100g?.fiberG ?? 0) * f * 10) / 10;
          const sugarG = isPerServingOnly
            ? Math.round((microsServing.sugarG ?? 0) * q * 10) / 10
            : Math.round((selection.macrosPer100g?.sugarG ?? 0) * f * 10) / 10;
          const sodiumMg = isPerServingOnly
            ? Math.round((microsServing.sodiumMg ?? 0) * q)
            : Math.round((selection.macrosPer100g?.sodiumMg ?? 0) * f);

          const { error } = await supabase
            .from("recipe_ingredients")
            .update({
              name: selection.name,
              amount: selection.quantity,
              unit: selection.chosenPortion.label,
              calories: macros.calories,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
              fiber_g: fiberG,
              sugar_g: sugarG,
              sodium_mg: sodiumMg,
              is_verified: true,
              source: selection.source,
              // 2026-05-02 fix — also persist `confidence: 1.0` so
              // the recipe-detail row UI can't fall back to a stale
              // pre-verify confidence (e.g. 0.69 from the AI parse)
              // and keep showing "Partial match" after the user has
              // already resolved the row.
              confidence: 1.0,
            })
            .eq("id", ingId);

          if (error) {
            toast.error("Failed to update ingredient");
            return;
          }

          // Update local state — mirror the DB write so the in-
          // memory row matches the persisted row on the next render.
          setDbIngredients((prev) =>
            prev.map((ing, i) =>
              i === verifyIndex
                ? { ...ing, name: selection.name, amount: String(selection.quantity), unit: selection.chosenPortion.label, ...macros, isVerified: true, source: selection.source, confidence: 1.0 }
                : ing,
            ),
          );
          toast.success(`Updated to ${selection.name}`);
          setVerifyIndex(null);
        }}
      />

      {/* Batch 2.7 — Add ingredient (user-added row) */}
      <AddIngredientDialog
        open={addIngOpen}
        onOpenChange={setAddIngOpen}
        onAdd={handleAddIngredient}
        recipeId={recipe.id}
      />

      {/* Batch 2.7 — Per-ingredient override dialog */}
      {overrideIndex != null && ingredients[overrideIndex] ? (
        <OverrideIngredientDialog
          open={overrideIndex != null}
          onOpenChange={(o) => { if (!o) setOverrideIndex(null); }}
          ingredientName={ingredients[overrideIndex]!.name}
          currentMacros={effectiveMacros(ingredients[overrideIndex])}
          hasExistingOverride={hasOverride(ingredients[overrideIndex])}
          onSave={(ov) => handleOverrideSave(overrideIndex, ov)}
          onReset={() => handleOverrideReset(overrideIndex)}
        />
      ) : null}
    </div>
  );
}
