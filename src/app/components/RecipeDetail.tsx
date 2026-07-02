import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import {
  formatContainsLine,
  normaliseAllergenIds,
} from "../../constants/regulatedAllergens";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { IngredientOverride, IngredientRow, RecipeCard, UserTier } from "../../types/recipe.ts";
import { GoPublicDialog } from "./GoPublicDialog.tsx";
import {
  RecipeEditDialog,
  type RecipeEditDialogSavePayload,
} from "./suppr/recipe-edit-dialog.tsx";
import { CookMode } from "./CookMode.tsx";
import { RecipeImportReviewBanner } from "./recipe/RecipeImportReviewBanner.tsx";
import { recipeIngredientsNeedReview } from "../../lib/nutrition/recipeImportReview.ts";
import { carbsLabel, netCarbsForRow } from "../../lib/nutrition/netCarbs.ts";
import { FoodSearch, type FoodSearchSelection } from "./FoodSearch.tsx";
import { classifyConfidence } from "../../lib/nutrition/aiLogging";
import { AddIngredientDialog, type AddIngredientPayload } from "./suppr/add-ingredient-dialog";
import { OverrideIngredientDialog } from "./suppr/override-ingredient-dialog";
import { useRecipeReport } from "./suppr/use-recipe-report";
import { normaliseRecipeDisplayTitle } from "../../lib/recipe/normaliseDisplayTitle";
import {
  findSeedRecipeById,
  isSeedRecipeId,
} from "../../lib/recipes/seedRecipesV2";
import { isRetiredStockImageUrl, pickHeroImageUrl } from "../../lib/recipes/heroImageFallback.ts";
import { mapPersistenceError, userFacingImageGenError, userFacingImportError } from "../../lib/recipes/importErrorCopy.ts";
import { isImportedRecipe, importSourceDisclaimer } from "../../lib/recipes/importSourceDisclaimer.ts";
import {
  OFFICIAL_MACROS_CLAIM_BLOCKER_COPY,
  OFFICIAL_RECIPE_CLAIM_FLAG,
  canShowOfficialVersion,
  officialMacrosClaimBlocker,
} from "../../lib/recipes/officialRecipeClaim.ts";
import { displayAttribution } from "../../lib/recipes/displayAttribution.ts";
import { RecipeHeroFallback } from "./suppr/RecipeHeroFallback";
import { fetchIngredientImages } from "../../lib/recipe/ingredientImages.ts";
import { enqueueIngredientImages } from "../../lib/recipe/enqueueIngredientImages.ts";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "../../lib/recipe/ingredientImageTile.ts";
import { cleanIngredientDisplayName } from "../../lib/recipe/cleanIngredientDisplayName.ts";
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
import { structuredIngredientsForVerify } from "../../lib/recipe-ingredients/structuredIngredientsForVerify.ts";
import {
  flatMacroRowsFromVerifyJson,
  isVerifiedFromVerifyRow,
  mergeVerifiedMacroRows,
  overallConfidenceFromVerifyJson,
  perServingFromVerifyJson,
  verifyJsonNeedsReview,
} from "../../lib/nutrition/verifyRecipeResponse.ts";
import {
  MIN_ACCEPT_CONFIDENCE,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
} from "../../lib/nutrition/verifyConfidencePolicy.ts";
import { inferAllergensFromIngredients } from "../../lib/nutrition/inferAllergens.ts";
import {
  recipeAggregateHasFatSecret,
  scrubFatSecretMacros,
} from "../../lib/nutrition/fatsecretCacheGuard.ts";
import { saveVerifiedIngredientsRpc } from "../../lib/nutrition/saveVerifiedIngredientsRpc.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../lib/analytics/track.ts";
import { CookIngredientChecklist } from "./cook/CookIngredientChecklist.tsx";
import { AddToShoppingListAction } from "./recipe/AddToShoppingListAction.tsx";
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
  composeRecipeMeta,
  composeSubtitleParts,
  computeFitsYourDayVerdict,
  shouldRenderTimeStats,
} from "../../lib/recipe/recipeDetailLayout.ts";
import { webRecipeDeepLink } from "../../lib/share/recipeDeepLink.ts";
import {
  buildRecipeShareCardMessage,
  formatRecipeCreatorCredit,
} from "../../lib/share/buildRecipeShareCard.ts";
import { normaliseInstructions } from "../../lib/recipes/normaliseInstructions.ts";
import { sanitizeRecipeDescription } from "../../lib/recipes/sanitizeRecipeDescription.ts";
import { formatMacroValue } from "../../lib/nutrition/formatMacro.ts";
// ENG-1247 — real "Log to today" from the recipe-detail CTA (web parity with
// mobile `addRecipeToTodayJournal`). The web Log button previously fired only a
// fake "Marked as made!" toast; it now routes through the shared planned-meal
// log path (coercion guard + micros) exactly like the LogSheet Library pick.
import { fetchPlannedMealMicros, type SupabaseLike } from "../../lib/planning/plannedMealMicros.ts";
import { journalSlotFromMealTypes } from "../../lib/nutrition/recipeJournalSlot.ts";
import { dateKeyFromDate } from "../../lib/datetime/dateKey.ts";
import { normalizeRecipeTitle } from "../../lib/recipes/normalizeRecipeTitle.ts";
// GW-08 (audit 2026-04-28): `computeRecipeFitPercent` import dropped
// when the always-85% pill was removed from this screen. Helper is
// still callable from web Library card where targets are real.
// Phase 4 / B3.X (2026-04-27) — trust posture sweep. Authority:
// D-2026-04-27-16. The recipe-level chip aggregates ingredient
// trust into a single hero chip; per-row dots sit on the ingredient
// list below.
import { TrustChip } from "./ui/trust-chip";
import { SourceDot } from "./ui/source-dot";
import { SupprCard } from "./ui/suppr-card";
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

async function shareRecipeDeepLink(recipe: {
  id: string;
  title: string;
  calories?: number;
  protein?: number;
  isVerified?: boolean;
  sourceName?: string | null;
  creatorName?: string;
  creatorId?: string | null;
}) {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  const url = webRecipeDeepLink(recipe.id, origin);
  const richShare = isFeatureEnabled("recipe_share_card_v1");
  const shareText = richShare
    ? buildRecipeShareCardMessage({
        recipeId: recipe.id,
        title: normaliseRecipeDisplayTitle(recipe.title),
        calories: recipe.calories,
        protein: recipe.protein,
        estimated: !recipe.isVerified,
        sourceName: recipe.sourceName,
        authorDisplayName: recipe.creatorName,
        creatorId: recipe.creatorId,
        appOrigin: origin,
      })
    : null;
  const clipboardPayload = shareText ?? url;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: normaliseRecipeDisplayTitle(recipe.title),
        text: shareText ?? "Open this recipe in Sloe",
        url: shareText ? undefined : url,
      });
      if (richShare) {
        track(AnalyticsEvents.recipe_share_card_shared, {
          surface: "recipe_detail",
          platform: "web",
          hasCreatorCredit: Boolean(
            formatRecipeCreatorCredit({
              sourceName: recipe.sourceName,
              authorDisplayName: recipe.creatorName,
            }),
          ),
        });
      }
      toast.success("Shared");
      return;
    } catch (e: unknown) {
      if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(clipboardPayload);
    toast.success(shareText ? "Share card copied" : "Share link copied");
  } catch {
    // Audit M7 (2026-04-18) — the prior `window.prompt("Copy this link:", url)`
    // fallback was an unthemed native dialog. Surface the link via a
    // persistent toast instead so the user can long-press / select the URL
    // and copy it themselves without the browser prompt.
    toast.message("Copy this link", {
      description: clipboardPayload,
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

function RecipeHeroImage({
  src,
  alt,
  recipeId,
  recipeTitle,
  className,
  style,
}: {
  src: string;
  alt: string;
  recipeId: string;
  recipeTitle: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="w-full aspect-video" style={style}>
        <RecipeHeroFallback id={recipeId} title={recipeTitle} iconSize={48} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} style={style} onError={() => setBroken(true)} />
  );
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
    // ENG-1247 — real journal write for the Log-to-today CTA (web parity).
    addLoggedMealForDate,
    // ENG-943 — shopping-list append (user scope + local list mirror).
    userId: appUserId,
    activeHouseholdId,
    setShoppingItems,
  } = useAppData();
  const saved = isRecipeSaved(recipe.id);
  // PR1 (Paprika parity): the viewing-servings stepper is the canonical "how
  // many portions am I viewing" state. Bounds + deep-link `initialServings`
  // honouring live in shared `recipeViewScale.ts` (mobile uses the same
  // contract). Whole portions only — fractional cook-mode multipliers live in
  // `recipeScale.ts`, composed on top inside CookMode.
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

  // ENG-818/819 (Redesign — Design Direction 2026) — flag-gated web mirrors of
  // the mobile recipe-detail redesign.
  //   - `redesignColours`  → the "Fits your day" payoff chip (win-amber when it
  //     fits well). Flag-off keeps the flat coloured-text line.
  //   - `winFeedback` → the web analog of the mobile confirm haptic: a brief
  //     press payoff (scale + ring) on the commit CTAs (web has no Haptics API).
  // (The resting-card elevation is now UNCONDITIONAL — Figma 332:2 white slabs
  // on cream — so the old `design_system_elevation` read is dropped here, in
  // lockstep with mobile's unconditional `useCardElevation` soft lift.)
  const redesignColours = isFeatureEnabled("design_system_colours");
  const winFeedback = isFeatureEnabled("redesign_winmoment");
  /** ENG-946 — tap-to-check ingredient checklist on the Ingredients tab. */
  const cookIngredientChecklistEnabled = isFeatureEnabled("cook_ingredient_checklist_v1");
  /** ENG-943 — "Add to shopping list" action (default-ON). */
  const recipeShoppingListEnabled = isFeatureEnabled("recipe_shopping_list_v1");
  // ENG-1247 — v3 recipe-detail prototype conformance (default-OFF). ON → hero
  // title OVERLAY, serif standfirst headnote, consolidated sticky CTA bar
  // (yield · Cook Mode outline · Log filled), and a REAL journal write on Log.
  // Carve-out: "Fits your day" verdict banner keeps its tri-state SOLID
  // treatment (docs/decisions/2026-06-13-fits-your-day-verdict-banner.md).
  const recipeDetailV3 = isFeatureEnabled("recipe_detail_v3_conformance");
  const [loggingRecipe, setLoggingRecipe] = useState(false);
  // Commit-CTA press payoff (web analog of the mobile confirm haptic). A subtle
  // active-state scale + a brief brightness lift on press, gated on
  // `redesign_winmoment`. Flag-off keeps the existing hover-only transition.
  const commitCtaPayoffClass = winFeedback
    ? "transition-all duration-200 active:scale-[0.97] active:brightness-110"
    : "";

  // Flat-card surfaces (2026-06-12, Withings grammar — decision:
  // docs/decisions/2026-06-12-flat-card-surfaces.md): resting detail cards are
  // true-white `--card` slabs on the warm `--background-secondary` page — zero
  // shadow — mirroring mobile flat (the soft `--elev-card-soft` lift is retired).
  const whiteSlabStyle: React.CSSProperties = {
    backgroundColor: "var(--card)",
  };

  // Audit gap #3 (Wave 4) — static seed recipes have no Supabase backing row;
  // treat them like a catalogue entry so the DB fetch/save short-circuits skip
  // cleanly. Seed ingredients + instructions hydrate into dbIngredients /
  // dbInstructionsText so the Steps + Ingredients tabs render with no extra branch.
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
  const [dbMealType, setDbMealType] = useState<string[] | null>(null);
  const [dbImageUrl, setDbImageUrl] = useState<string | null>(recipe.image ?? null);
  const [dbImageSource, setDbImageSource] = useState<string | null>(
    (recipe as { imageSource?: string | null; image_source?: string | null }).imageSource ??
      (recipe as { image_source?: string | null }).image_source ??
      null,
  );
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [heroGenerating, setHeroGenerating] = useState(false);
  const [heroSaving, setHeroSaving] = useState(false);
  const [recipeEditOpen, setRecipeEditOpen] = useState(false);
  const [recipeYieldDraft, setRecipeYieldDraft] = useState("");
  const [recipeYieldSaving, setRecipeYieldSaving] = useState(false);
  const [recipeYieldEditing, setRecipeYieldEditing] = useState(false);
  const recipeYieldInputRef = useRef<HTMLInputElement | null>(null);
  const recipeYieldEscapeBlurRef = useRef(false);
  const [dbIngredients, setDbIngredients] = useState<IngredientRow[]>([]);
  const [dbIngredientIds, setDbIngredientIds] = useState<string[]>([]);
  // Sloe image system (2026-06-08) — `name_key → image_url` for the
  // ingredient tiles, hydrated from the global `ingredient_images` table.
  // Empty until the fal-funded backfill runs; missing keys fall back to
  // the calm cream placeholder. Never blocks render (async load effect).
  const [ingredientImageMap, setIngredientImageMap] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [dbFetchFailed, setDbFetchFailed] = useState(false);
  const [verifySearchOpen, setVerifySearchOpen] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState<number | null>(null);
  /** USDA / OFF / FatSecret / Edamam via `/api/nutrition/verify-recipe`. */
  const [autoVerifyingIngredients, setAutoVerifyingIngredients] = useState(false);
  const autoVerifySucceededForRecipeId = useRef<string | null>(null);
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
  const [officialRecipeId, setOfficialRecipeId] = useState<string | null>(null);
  const [recipeContentOrigin, setRecipeContentOrigin] = useState<string | null>(recipe.contentOrigin ?? null);
  const [recipeSourceUrl, setRecipeSourceUrl] = useState<string | null>(recipe.sourceUrl ?? null);
  const [officialClaiming, setOfficialClaiming] = useState(false);

  const isMyRecipe = Boolean(
    !isCatalogRecipe &&
      authUserId &&
      (recipe.authorId ?? recipeAuthorId) &&
      authUserId === (recipe.authorId ?? recipeAuthorId),
  );
  const report = useRecipeReport(recipe.id, normaliseRecipeDisplayTitle(recipe.title));

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
        .select("creator_id, author_id, published, content_origin, source_url")
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
      const sourceUrl = (metaRow as { source_url?: string | null }).source_url ?? recipe.sourceUrl ?? null;
      const contentOrigin = (metaRow as { content_origin?: string | null }).content_origin ?? recipe.contentOrigin ?? null;
      setFollowCreatorId(cid);
      setRecipeAuthorId(aid);
      setRecipeSourceUrl(sourceUrl);
      setRecipeContentOrigin(contentOrigin);

      if (canShowOfficialVersion({
        currentRecipeId: recipe.id,
        sourceUrl,
        published: (metaRow as { published?: boolean | null }).published ?? recipe.isPublished ?? null,
        contentOrigin,
      })) {
        const { data: official } = await supabase
          .from("recipes")
          .select("id")
          .eq("source_url", sourceUrl)
          .eq("published", true)
          .eq("content_origin", "claimed")
          .neq("id", recipe.id)
          .limit(1)
          .maybeSingle();
        if (!cancelled) setOfficialRecipeId((official as { id?: string } | null)?.id ?? null);
      } else {
        setOfficialRecipeId(null);
      }

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

  const officialClaimEnabled = isFeatureEnabled(OFFICIAL_RECIPE_CLAIM_FLAG);
  const officialClaimBlocker = officialMacrosClaimBlocker({
    isOwner: isMyRecipe,
    isCatalogRecipe,
    published: isPublished,
    contentOrigin: recipeContentOrigin,
    sourceUrl: recipeSourceUrl,
    ingredientCount: dbIngredients.length,
    verifiedIngredientCount: dbIngredients.filter((ingredient) => ingredient.isVerified === true).length,
  });
  const showOfficialClaimAction =
    officialClaimEnabled && isMyRecipe && !isCatalogRecipe && recipeContentOrigin !== "claimed";

  const markRecipeOfficial = async () => {
    if (!showOfficialClaimAction || officialClaimBlocker || officialClaiming) return;
    setOfficialClaiming(true);
    try {
      const res = await fetch("/api/recipes/claim-official", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        const copy = json.error && json.error in OFFICIAL_MACROS_CLAIM_BLOCKER_COPY
          ? OFFICIAL_MACROS_CLAIM_BLOCKER_COPY[json.error as keyof typeof OFFICIAL_MACROS_CLAIM_BLOCKER_COPY]
          : json.message ?? "Could not mark this recipe official.";
        toast.error(copy);
        return;
      }
      setRecipeContentOrigin("claimed");
      setOfficialRecipeId(null);
      await refreshDiscoverRecipes();
      await refreshMyLibraryRecipes();
      toast.success("Official macros confirmed");
    } catch {
      toast.error("Could not mark this recipe official.");
    } finally {
      setOfficialClaiming(false);
    }
  };

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
      let recipeRes = await supabase
        .from("recipes")
        .select(
          "description, instructions, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, meal_type, prep_time_min, cook_time_min, image_url, image_source",
        )
        .eq("id", recipe.id)
        .maybeSingle();
      if (recipeRes.error?.code === "42703") {
        recipeRes = await supabase
          .from("recipes")
          .select(
            "description, instructions, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, meal_type, prep_time_min, cook_time_min, image_url",
          )
          .eq("id", recipe.id)
          .maybeSingle();
      }
      const { data: row, error: recipeError } = recipeRes;

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
      // ENG-1287 — legacy rows may still persist a retired fabricated
      // stock URL (pre-fix RecipeUpload default); treat it as no image.
      const rowImageUrl = (row.image_url as string | null) ?? null;
      setDbImageUrl(isRetiredStockImageUrl(rowImageUrl) ? null : rowImageUrl);
      setDbImageSource((row.image_source as string | null) ?? null);
      setDbInstructionsText((row.instructions as string | null) ?? null);
      setDbServings((row.servings as number) ?? recipe.servings);
      const mt = (row as { meal_type?: string[] | string | null }).meal_type;
      setDbMealType(
        Array.isArray(mt) ? mt : mt != null && mt !== "" ? [String(mt)] : null,
      );
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
  const sloeImageRuntimeEnabled = isFeatureEnabled("recipe_runtime_image_generation_v1");
  const heroImageSource = dbImageSource;
  const isAiGeneratedHero = sloeImageRuntimeEnabled && heroImageSource === "ai_generated";

  const generateHeroPreview = useCallback(async () => {
    if (!authUserId || !isMyRecipe || heroGenerating) return;
    setHeroGenerating(true);
    try {
      const res = await fetch("/api/recipe-import/image-hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipeId: recipe.id,
          title: recipe.title,
          ingredients: ingredients.map((ing) => ing.name).filter(Boolean).slice(0, 12),
          preview: true,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; message?: string; reason?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        // ENG-1328: image-gen error channel — the shared `pro_required`
        // copy describes photo IMPORTS; raw `reason` tokens never render.
        toast.error(userFacingImageGenError(json));
        return;
      }
      setHeroPreviewUrl(json.url);
    } catch {
      toast.error("Could not generate an image.");
    } finally {
      setHeroGenerating(false);
    }
  }, [authUserId, heroGenerating, ingredients, isMyRecipe, recipe.id, recipe.title]);

  const approveHeroPreview = useCallback(async () => {
    if (!authUserId || !isMyRecipe || !heroPreviewUrl || heroSaving) return;
    setHeroSaving(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({
          image_url: heroPreviewUrl,
          image_source: "ai_generated",
          image_model: "fal-ai/nano-banana-pro",
          image_generated_at: new Date().toISOString(),
        })
        .eq("id", recipe.id)
        .eq("author_id", authUserId);
      if (error) return void toast.error(userFacingImportError(mapPersistenceError(error)));
      setDbImageUrl(heroPreviewUrl);
      setDbImageSource("ai_generated");
      setHeroPreviewUrl(null);
      await refreshMyLibraryRecipes();
      toast.success("Sloe image saved");
    } finally {
      setHeroSaving(false);
    }
  }, [authUserId, heroPreviewUrl, heroSaving, isMyRecipe, recipe.id, refreshMyLibraryRecipes]);

  const removeGeneratedHero = useCallback(async () => {
    if (!authUserId || !isMyRecipe || heroSaving) return;
    setHeroSaving(true);
    try {
      const res = await fetch("/api/recipe-import/image-hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipeId: recipe.id, remove: true }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; reason?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.message?.trim() ? userFacingImportError(json) : "Could not remove the image.");
        return;
      }
      setDbImageUrl(null);
      setDbImageSource(null);
      setHeroPreviewUrl(null);
      await refreshMyLibraryRecipes();
      toast.success("Sloe image removed");
    } finally {
      setHeroSaving(false);
    }
  }, [authUserId, heroSaving, isMyRecipe, recipe.id, refreshMyLibraryRecipes]);

  // Sloe image system (2026-06-08) — hydrate the ingredient tile images
  // by `name_key`. Keyed on the joined names so it only re-fetches when
  // the ingredient set actually changes (not on every render). Degrades
  // to an empty map (calm placeholders) on any error; never throws.
  const ingredientNamesKey = ingredients.map((i) => i.name).join("");
  useEffect(() => {
    const names = ingredients.map((i) => i.name);
    if (names.length === 0) {
      setIngredientImageMap(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { map, missingKeys } = await fetchIngredientImages(supabase, names);
      if (cancelled) return;
      setIngredientImageMap(map);
      // Lazy generate-on-miss: enqueue the tiles that have no ready image
      // (fire-and-forget; never blocks render). The library fills itself.
      if (missingKeys.length > 0) {
        enqueueIngredientImages(names, (b) =>
          fetch("/api/ingredient-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(b),
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientNamesKey]);

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

  const recipeNeedsImportReview = useMemo(
    () => recipeIngredientsNeedReview(ingredients),
    [ingredients],
  );

  const baseServings = dbServings ?? recipe.servings;
  const ingredientsHaveNutrition = useMemo(
    () =>
      ingredients.some(
        (i) => i.calories > 0 || i.protein > 0 || i.carbs > 0 || i.fat > 0,
      ),
    [ingredients],
  );

  useEffect(() => {
    autoVerifySucceededForRecipeId.current = null;
  }, [recipe.id]);

  /** Auto-match unverified ingredient rows on open (mobile parity). */
  useEffect(() => {
    if (isCatalogRecipe || dbLoading || dbFetchFailed || ingredients.length === 0) return;
    if (!authUserId) return;
    if (autoVerifySucceededForRecipeId.current === recipe.id) return;
    if (ingredientsHaveNutrition) return;

    const macroCal = dbMacros?.calories ?? recipe.calories ?? 0;
    const macroPro = dbMacros?.protein ?? recipe.protein ?? 0;
    const macroCarb = dbMacros?.carbs ?? recipe.carbs ?? 0;
    const macroFat = dbMacros?.fat ?? recipe.fat ?? 0;
    if (macroCal <= 0 && macroPro <= 0 && macroCarb <= 0 && macroFat <= 0) return;

    let cancelled = false;
    const snap = ingredients;
    const snapIds = dbIngredientIds;

    (async () => {
      setAutoVerifyingIngredients(true);
      try {
        const res = await fetch("/api/nutrition/verify-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ingredients: structuredIngredientsForVerify(snap),
            servings: baseServings,
          }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        const rows = flatMacroRowsFromVerifyJson(json);
        const perServing = perServingFromVerifyJson(json, { servings: baseServings });
        if (!json.ok || !rows?.length || !perServing) return;

        setDbIngredients(
          mergeVerifiedMacroRows(snap as unknown as Record<string, unknown>[], rows) as unknown as IngredientRow[],
        );
        setDbMacros({
          calories: Math.round(perServing.calories),
          protein: Math.round(perServing.protein),
          carbs: Math.round(perServing.carbs),
          fat: Math.round(perServing.fat),
          fiberG: perServing.fiberG != null ? Math.round(perServing.fiberG * 10) / 10 : 0,
          sugarG: perServing.sugarG != null ? Math.round(perServing.sugarG * 10) / 10 : 0,
          sodiumMg: perServing.sodiumMg != null ? Math.round(perServing.sodiumMg) : 0,
        });

        if (isMyRecipe && snapIds.length > 0) {
          const ingredientUpdates = rows.slice(0, snapIds.length).map((r, i) => {
            const scrubbed = scrubFatSecretMacros({
              calories: Math.round(r.calories),
              protein: Math.round(r.protein),
              carbs: Math.round(r.carbs),
              fat: Math.round(r.fat),
              fiber_g: Math.round(r.fiber * 10) / 10,
              sugar_g: Math.round(r.sugar * 10) / 10,
              sodium_mg: Math.round(r.sodium),
              source: r.source,
              confidence: r.confidence,
              is_verified: isVerifiedFromVerifyRow(r.confidence, r.source ?? ""),
            });
            const ing = snap[i] as IngredientRow | undefined;
            const rowIsVerified = Boolean(scrubbed.is_verified);
            return {
              id: snapIds[i]!,
              name: String(ing?.name ?? ""),
              amount: ing?.amount ?? null,
              unit: ing?.unit ?? null,
              calories: scrubbed.calories as number,
              protein: scrubbed.protein as number,
              carbs: scrubbed.carbs as number,
              fat: scrubbed.fat as number,
              fiber_g: scrubbed.fiber_g as number,
              sugar_g: scrubbed.sugar_g as number,
              sodium_mg: scrubbed.sodium_mg as number,
              caffeine_mg: 0,
              alcohol_g: 0,
              is_verified: rowIsVerified,
              source: scrubbed.source as string | undefined,
              confidence: r.confidence ?? null,
              override_macros: ing?.overrideMacros ?? null,
              added_by_user: Boolean(ing?.addedByUser),
            };
          });

          const aggregateHasFs = recipeAggregateHasFatSecret(
            rows.map((r) => ({ source: r.source ?? null })),
          );
          const overallConf = overallConfidenceFromVerifyJson(json);
          const allRowsVerified =
            !aggregateHasFs &&
            ingredientUpdates.every((row) => row.is_verified) &&
            rows.every(
              (r) =>
                typeof r.confidence === "number" &&
                r.confidence >= RECIPE_INGREDIENT_REVIEW_CONFIDENCE &&
                isVerifiedFromVerifyRow(r.confidence, r.source ?? ""),
            );
          const inferredAllergens = inferAllergensFromIngredients(
            rows.map((r, i) => ({
              name: String((snap[i] as IngredientRow | undefined)?.name ?? ""),
              confidence: r.confidence ?? 0,
            })),
          );
          const rpcRecipeUpdate = aggregateHasFs
            ? {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber_g: 0,
                sugar_g: 0,
                sodium_mg: 0,
                caffeine_mg: 0,
                alcohol_g: 0,
                allergens: [],
              }
            : {
                calories: Math.round(perServing.calories),
                protein: Math.round(perServing.protein),
                carbs: Math.round(perServing.carbs),
                fat: Math.round(perServing.fat),
                fiber_g: perServing.fiberG != null ? Math.round(perServing.fiberG * 10) / 10 : 0,
                sugar_g: perServing.sugarG != null ? Math.round(perServing.sugarG * 10) / 10 : 0,
                sodium_mg: perServing.sodiumMg != null ? Math.round(perServing.sodiumMg) : 0,
                caffeine_mg: 0,
                alcohol_g: 0,
                allergens: inferredAllergens,
              };

          const rpcResult = await saveVerifiedIngredientsRpc(
            supabase,
            recipe.id,
            rpcRecipeUpdate,
            ingredientUpdates,
          );
          if ("error" in rpcResult && rpcResult.error) {
            console.error("[RecipeDetail] save_verified_ingredients failed:", rpcResult.error);
            return;
          }
        }

        autoVerifySucceededForRecipeId.current = recipe.id;
        const avg = json.avgIngredientConfidence;
        const min = json.minIngredientConfidence;
        // ENG-1305: shared helper folds in belowAcceptFloorCount.
        if (verifyJsonNeedsReview(json)) {
          track(AnalyticsEvents.recipe_verify_needs_review, {
            recipe_id: recipe.id,
            source: "auto_verify",
            platform: "web",
            avgIngredientConfidence: avg,
            minIngredientConfidence: min,
          });
        }
      } catch {
        /* silent — user can still verify manually */
      } finally {
        if (!cancelled) setAutoVerifyingIngredients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isCatalogRecipe,
    dbLoading,
    dbFetchFailed,
    ingredients,
    dbIngredientIds,
    authUserId,
    recipe.id,
    recipe.calories,
    recipe.protein,
    recipe.carbs,
    recipe.fat,
    ingredientsHaveNutrition,
    dbMacros,
    baseServings,
    isMyRecipe,
  ]);

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

  // Top-of-recipe "portions to view" macros — prefer live per-serving
  // ingredient totals scaled by the chosen portion count when we have real
  // nutrition rows; else fall back to the persisted per-serving macros. Seed/
  // catalog rows hydrate with 0 macros, so only prefer live totals when ≥1 macro
  // is non-zero (or there are no ingredients).
  const liveHasNutrition =
    !isCatalogRecipe &&
    ingredients.length > 0 &&
    (liveIngredientPerServing.calories > 0 ||
      liveIngredientPerServing.protein > 0 ||
      liveIngredientPerServing.carbs > 0 ||
      liveIngredientPerServing.fat > 0);
  const perServingBase = liveHasNutrition
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

  // ENG-1247 — does a REAL hero photo resolve? (Same ladder the hero IIFE
  // uses.) The v3 hero title overlay only rides a real photo; on the
  // placeholder fallback the title stays in the body block. Shared here so the
  // hero overlay + the body title-block `hideTitle` agree.
  const heroHasPhoto = (() => {
    const effectiveImage = heroPreviewUrl ?? dbImageUrl ?? recipe.image;
    const hasRealImage =
      typeof effectiveImage === "string" && effectiveImage !== "";
    const ladderSrc = pickHeroImageUrl({
      image_url: hasRealImage ? effectiveImage : null,
      source_url: recipe.sourceUrl ?? null,
    });
    return Boolean(ladderSrc ?? (hasRealImage ? effectiveImage : null));
  })();
  const heroOverlayActive = recipeDetailV3 && heroHasPhoto;

  // ENG-1247 — REAL "Log to today" (web parity with mobile
  // `addRecipeToTodayJournal`). Routes through the shared planned-meal log path
  // so the macro-coercion guard (P0-3 / T4) fires identically to the LogSheet
  // Library pick + the planner row → Log: a recipe with kcal but no
  // ingredient-resolved P/C/F is refused with a Verify prompt rather than
  // logging a fabricated split. Macros/micros are scaled to the viewing
  // servings (the stepper), so what you log matches what you're looking at.
  const logRecipeToToday = async () => {
    if (loggingRecipe) return; // no double-submit
    const kcal = Math.round(scaledMacros.calories);
    if (kcal <= 0 && scaledMacros.protein <= 0 && scaledMacros.carbs <= 0 && scaledMacros.fat <= 0) {
      if (typeof window !== "undefined") {
        window.alert(
          "Calories not yet computed.\n\nOpen the recipe and tap Verify to match ingredients before logging it.",
        );
      }
      return;
    }
    setLoggingRecipe(true);
    try {
      const microsRes = await fetchPlannedMealMicros(
        supabase as unknown as SupabaseLike,
        recipe.id,
        servings,
      );
      if (microsRes.macrosAreCoerced) {
        if (typeof window !== "undefined") {
          window.alert(
            "Verify this recipe first.\n\nThis recipe has calories but no ingredient macros yet. Logging now would save estimated values. Open the recipe and tap Verify to match ingredients for accurate nutrition.",
          );
        }
        return;
      }
      const slot = journalSlotFromMealTypes(
        Array.isArray(recipe.mealSlots) ? (recipe.mealSlots as string[]) : null,
      );
      const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      addLoggedMealForDate(
        dateKeyFromDate(new Date()),
        {
          name: slot,
          recipeTitle: normalizeRecipeTitle(recipe.title),
          time: timeLabel,
          calories: kcal,
          protein: scaledMacros.protein,
          carbs: scaledMacros.carbs,
          fat: scaledMacros.fat,
          ...(microsRes.fiberG != null ? { fiberG: microsRes.fiberG } : {}),
          ...(Object.keys(microsRes.micros).length > 0 ? { micros: microsRes.micros } : {}),
          source: "Recipe",
          recipeId: recipe.id,
        },
        "recipe",
      );
      try {
        toast.success(`Logged ${normaliseRecipeDisplayTitle(recipe.title)} to ${slot}.`);
      } catch {
        /* toast availability is not a blocker for the journal write */
      }
    } finally {
      setLoggingRecipe(false);
    }
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

  const handleRecipeEditSaved = useCallback(
    async (updated: RecipeEditDialogSavePayload) => {
      setDbDescription(updated.description);
      setDbInstructionsText(updated.instructions);
      setDbServings(updated.servings);
      setDbMealType(updated.meal_type);
      setDbPrepMin(updated.prep_time_min);
      setDbCookMin(updated.cook_time_min);
      setDbMacros({
        calories: updated.calories,
        protein: updated.protein,
        carbs: updated.carbs,
        fat: updated.fat,
        fiberG: updated.fiber_g,
        sugarG: updated.sugar_g,
        sodiumMg: updated.sodium_mg,
      });
      setRecipeYieldDraft(String(updated.servings));
      await refreshMyLibraryRecipes();
    },
    [refreshMyLibraryRecipes],
  );

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
        // ENG-1305: shared accept floor (0.55) — never label a row the
        // pipeline would exclude from totals as "verified".
        is_verified: payload.hasMatch && payload.confidence >= MIN_ACCEPT_CONFIDENCE,
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
        // match at/above MIN_ACCEPT_CONFIDENCE at insert time,
        // ENG-1305), which mirrors
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
    // Figma 332:2 — warm cream editorial page (`#F6F5F2`
    // `background-secondary`); the white slab cards below lift off it.
    // Mirrors the public-share page + mobile detail (cream page, white cards).
    <div className="max-w-4xl mx-auto bg-background-secondary min-h-screen pb-24">
      {/* 1. Full-bleed hero with overlaid controls (Figma 332:2 §1). The photo
          (or the deterministic cream/plum fallback) runs edge-to-edge; a top
          scrim darkens the controls; back (left) + bookmark / share / more
          (right) float as 40px frosted circles. Replaces the old cream sticky
          nav bar + rounded hero. */}
      {(() => {
        const effectiveImage = heroPreviewUrl ?? dbImageUrl ?? recipe.image;
        const hasRealImage =
          typeof effectiveImage === "string" && effectiveImage !== "";
        const ladderSrc = pickHeroImageUrl({
          image_url: hasRealImage ? effectiveImage : null,
          source_url: recipe.sourceUrl ?? null,
        });
        const heroSrc = ladderSrc ?? (hasRealImage ? effectiveImage : null);
        const heroCircle =
          "w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all";
        return (
          <div className="relative w-full" style={{ height: 375 }} data-testid="recipe-detail-hero">
            {heroSrc ? (
              <RecipeHeroImage
                src={heroSrc}
                alt={recipe.title}
                recipeId={recipe.id}
                recipeTitle={recipe.title}
                className="w-full h-full object-cover"
                style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
              />
            ) : (
              <div
                className="w-full h-full"
                style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                data-testid="recipe-detail-hero-fallback"
              >
                <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={56} />
              </div>
            )}
            {isAiGeneratedHero || heroPreviewUrl ? (
              <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Sloe image
              </div>
            ) : null}
            {sloeImageRuntimeEnabled && isMyRecipe && !heroSrc ? (
              <button
                type="button"
                onClick={() => void generateHeroPreview()}
                disabled={heroGenerating}
                className="absolute bottom-4 left-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {heroGenerating ? "Generating…" : "Generate an image"}
              </button>
            ) : null}
            {heroPreviewUrl ? (
              <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2 rounded-xl bg-black/55 p-3 text-white backdrop-blur-sm">
                <p className="mr-auto text-sm">Preview this Sloe image before saving.</p>
                <button
                  type="button"
                  onClick={() => setHeroPreviewUrl(null)}
                  className="rounded-full border border-white/50 px-3 py-1 text-sm"
                  disabled={heroSaving}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void approveHeroPreview()}
                  className="rounded-full bg-white px-3 py-1 text-sm text-foreground"
                  disabled={heroSaving}
                >
                  {heroSaving ? "Saving…" : "Approve"}
                </button>
              </div>
            ) : null}
            {/* Top scrim — rgba(0,0,0,0.4) → transparent. */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
            {/* ENG-1247 — bottom veil + title OVERLAY (prototype rd-veil +
                rd-title, Sloe-App.html L4336–4341). Only over a real photo, so
                gate on `heroSrc`; kicker + serif H1 + clock·flame·serves meta. */}
            {recipeDetailV3 && heroSrc ? (
              <>
                <div
                  className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none"
                  aria-hidden
                />
                <div
                  className="absolute inset-x-0 bottom-0 px-6 pb-6 flex flex-col gap-2 pointer-events-none"
                  data-testid="recipe-hero-title-overlay"
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/90"
                    data-testid="recipe-hero-kicker"
                  >
                    {saved ? "From your cookbook" : "Fits your day"}
                  </span>
                  <h1
                    className="text-white leading-tight"
                    style={{ fontFamily: "var(--font-headline)", fontSize: "30px", lineHeight: "36px", fontWeight: 400 }}
                    data-testid="recipe-hero-overlay-title"
                  >
                    {normaliseRecipeDisplayTitle(recipe.title)}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-[13px] font-medium text-white/90">
                    <span className="inline-flex items-center gap-1.5">
                      <Icons.timer className="w-3.5 h-3.5" aria-hidden />
                      {(() => {
                        const total = (dbPrepMin ?? 0) + (dbCookMin ?? 0);
                        return total > 0 ? `${total} min` : "—";
                      })()}
                    </span>
                    {Math.round(scaledMacros.calories) > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icons.calories className="w-3.5 h-3.5" aria-hidden />
                        {Math.round(scaledMacros.calories)} kcal
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <Icons.dinner className="w-3.5 h-3.5" aria-hidden />
                      Serves {servings}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
            {/* Overlaid controls. */}
            <div className="absolute inset-x-0 top-0 px-4 h-14 flex items-center justify-between">
              <button
                type="button"
                onClick={onBack}
                className={`${heroCircle} text-white shrink-0`}
                aria-label="Go back"
              >
                <Icons.back className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleSaveRecipe(recipe.id, userTier)}
                  className={`${heroCircle} ${saved ? "text-success" : "text-white"}`}
                  aria-label={saved ? "Remove from library" : "Save to library"}
                >
                  <Icons.save className="w-5 h-5" fill={saved ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void shareRecipeDeepLink({
                      id: recipe.id,
                      title: recipe.title,
                      calories: recipe.calories,
                      protein: recipe.protein,
                      isVerified: recipe.isVerified,
                      sourceName: recipe.sourceName,
                      creatorName: recipe.creatorName,
                      creatorId: recipe.creatorId,
                    })
                  }
                  className={`${heroCircle} text-white`}
                  aria-label="Share recipe link"
                >
                  <Icons.share className="w-5 h-5" />
                </button>
                {/* Always-rendered overflow menu: owner actions gated on
                    isMyRecipe; "Report an issue" (ENG-1225 #19) for everyone —
                    non-owners report others' recipes, which is the point. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More actions"
                      className={`${heroCircle} text-white`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isMyRecipe && !isCatalogRecipe ? (
                      <DropdownMenuItem onSelect={() => setRecipeEditOpen(true)}>Edit</DropdownMenuItem>
                    ) : null}
                    {isMyRecipe && isAiGeneratedHero ? (
                      <DropdownMenuItem disabled={heroSaving} onSelect={() => void removeGeneratedHero()}>
                        Remove Sloe image
                      </DropdownMenuItem>
                    ) : null}
                    {isMyRecipe && isPublished === false ? (
                      <DropdownMenuItem disabled={dbLoading} onSelect={() => setGoPublicMobileOpen(true)}>Go public</DropdownMenuItem>
                    ) : null}
                    {isMyRecipe && isPublished === true ? (
                      <DropdownMenuItem disabled={dbLoading} onSelect={() => setUnpublishOpen(true)}>Unpublish</DropdownMenuItem>
                    ) : null}
                    {showOfficialClaimAction ? (
                      <DropdownMenuItem
                        disabled={Boolean(officialClaimBlocker) || officialClaiming || dbLoading}
                        onSelect={() => void markRecipeOfficial()}
                      >
                        {officialClaiming ? "Marking official..." : "Mark macros official"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onSelect={report.openReport}>Report an issue</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })()}
      {isAiGeneratedHero ? (
        <div className="px-4 pt-3">
          <p className="rounded-xl bg-card px-4 py-3 text-xs text-muted-foreground">
            Sloe image is illustrative — generated from title + ingredients. Nutrition is
            estimated separately and may not match the image exactly.
          </p>
        </div>
      ) : null}
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
      {report.dialog}
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
      {isMyRecipe && authUserId && !isCatalogRecipe ? (
        <RecipeEditDialog
          open={recipeEditOpen}
          onOpenChange={setRecipeEditOpen}
          recipeId={recipe.id}
          authorId={authUserId}
          initial={{
            title: recipe.title,
            description: dbDescription,
            instructions: dbInstructionsText,
            servings: dbServings ?? recipe.servings,
            meal_type: dbMealType,
            prep_time_min: dbPrepMin,
            cook_time_min: dbCookMin,
          }}
          ingredients={ingredients}
          onSaved={handleRecipeEditSaved}
        />
      ) : null}

      {/* 2026-04-30 ui-product-designer recipe-detail audit: tightened
          page rhythm from `space-y-8` (32px) to `space-y-5` (20px) so
          the hero stack reads as one composed unit instead of five
          separate cards. Mobile parity in `apps/mobile/app/recipe/
          [id].tsx` body StyleSheet (Spacing.md = 12). */}
      {/* Body — single-scroll editorial stack (Figma 332:2 §2–7). The hero
          above is full-bleed; the body content begins at section 2. */}
      <div className="px-6 py-6 space-y-5">
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
          // Figma 332:2 §2 — title, attribution (`via @handle · See original`),
          // fits-your-day chip. Attribution shows only when a source/creator
          // exists; "See original" links to the source URL when present.
          // Route through displayAttribution (ENG-1084) so the byline calms the
          // legal seed string "Suppr Kitchen" → "Sloe Kitchen" (and drops
          // internal-seed strings) exactly like the Discover/Library card. Same
          // gating as before (skip the generic "Community" creator).
          const bylineLabel: string | null =
            displayAttribution({
              creatorName:
                recipe.creatorName && recipe.creatorName !== "Community"
                  ? recipe.creatorName
                  : null,
            }) || null;
          const originalHref =
            typeof recipe.sourceUrl === "string" && recipe.sourceUrl.trim()
              ? recipe.sourceUrl.trim()
              : null;
          const kcalForLine = Math.round(perServingBase.calories);
          const hasScaledAway = servings !== baseServings;
          const totalKcalForView = Math.round(perServingBase.calories * servings);
          const verdict = computeFitsYourDayVerdict({
            kcal: scaledMacros.calories,
            targetCals: nutritionTargets.calories,
          });
          const verdictChip = verdict
            ? verdict.tone === "success"
              ? { fg: "#5E7C5A", bg: "rgba(94,124,90,0.1)" }
              : verdict.tone === "destructive"
                ? { fg: "var(--destructive)", bg: "color-mix(in srgb, var(--destructive) 12%, transparent)" }
                : { fg: "var(--accent-warning-solid)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)" }
            : null;
          // ENG-1085 — confident SOLID verdict banner (white on a scheme-constant
          // dark tone, AA-safe in both schemes; mirrors mobile RecipeTitleBlock).
          // Flag default-ON; the legacy 10%-wash pill stays in the `else`.
          const verdictBannerOn = isFeatureEnabled("fit_verdict_banner_v1");
          const [verdictHead, ...verdictRest] = (verdict?.label ?? "").split(" · ");
          const verdictTail = verdictRest.join(" · ");
          const verdictBannerBg = verdict
            ? verdict.tone === "success"
              ? "var(--verdict-banner-success)"
              : verdict.tone === "warning"
                ? "var(--verdict-banner-warning)"
                : "var(--verdict-banner-destructive)"
            : null;
          return (
            <div className="space-y-3" data-testid="recipe-title-block">
              {/* ENG-1247 — when the v3 hero overlay shows the title, hide the
                  body H1 so it isn't duplicated (attribution + verdict stay). */}
              {heroOverlayActive ? null : (
                <h1
                  className="text-foreground-brand leading-tight"
                  style={{
                    fontFamily: "var(--font-headline)",
                    fontSize: "34px",
                    lineHeight: "42px",
                    fontWeight: 400,
                  }}
                  data-testid="recipe-body-title"
                >
                  {normaliseRecipeDisplayTitle(recipe.title)}
                </h1>
              )}
              {bylineLabel ? (
                <p className="text-sm text-muted-foreground" data-testid="recipe-attribution">
                  via{" "}
                  <span className="font-medium text-foreground">{bylineLabel}</span>
                  {originalHref ? (
                    <>
                      {"  ·  "}
                      <a
                        href={originalHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        See original
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {/*
                ENG-858 / ENG-1042 — import source-card disclaimer. Imported
                (non-first-party) recipes must carry the body-neutral legal
                line: facts extracted + nutrition estimated by Sloe, no
                affiliation/endorsement. Gated on a persisted source (url or
                name) and never shown on catalog/first-party recipes. Wording
                is the single shared constant (legal-approved); see
                `src/lib/recipes/importSourceDisclaimer.ts`.
              */}
              {!isCatalogRecipe &&
              isImportedRecipe({
                sourceUrl: recipe.sourceUrl,
                sourceName: recipe.sourceName ?? bylineLabel,
              }) ? (
                <p
                  className="text-[11px] leading-snug text-muted-foreground"
                  role="note"
                  data-testid="recipe-import-disclaimer"
                >
                  {importSourceDisclaimer(recipe.sourceName ?? bylineLabel)}
                </p>
              ) : null}
              {officialRecipeId ? (
                <div
                  className="rounded-xl border border-border bg-card p-4 text-sm"
                  role="status"
                  data-testid="recipe-official-version-card"
                >
                  <p className="font-semibold text-foreground">✓ Official version available</p>
                  <p className="mt-1 text-muted-foreground">
                    Imported from {recipe.sourceName ?? "the original source"} — not posted by the creator.
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => { window.location.href = `/recipe/${officialRecipeId}`; }}
                  >
                    Switch to official
                  </button>
                </div>
              ) : null}
              {verdict && verdictChip ? (
                verdictBannerOn ? (
                  <div
                    data-testid="recipe-fits-your-day"
                    role="status"
                    aria-label={verdict.a11y}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-white animate-in fade-in zoom-in-95 duration-300"
                    style={{ backgroundColor: verdictBannerBg ?? "var(--verdict-banner-success)" }}
                  >
                    {verdict.fits ? (
                      <Icons.check className="w-[18px] h-[18px]" strokeWidth={3} aria-hidden />
                    ) : null}
                    <span className="text-[15px] font-bold">{verdictHead}</span>
                    {verdictTail ? (
                      <span className="ml-auto text-[13px] font-medium text-white/80">
                        {verdictTail}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div
                    data-testid="recipe-fits-your-day"
                    role="status"
                    aria-label={verdict.a11y}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-xs font-bold"
                    style={{ color: verdictChip.fg, backgroundColor: verdictChip.bg }}
                  >
                    {verdict.fits ? (
                      <Icons.check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                    ) : null}
                    <span>{verdict.label}</span>
                  </div>
                )
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
            </div>
          );
        })()}

        {/* ENG-1247 — editorial serif standfirst headnote (prototype
            rd-standfirst, Sloe-App.html L4353). Uses the recipe description with
            a graceful protein-anchored fallback so the slot never reads empty.
            Flag-gated; not part of the legacy layout. */}
        {recipeDetailV3 && recipeNeedsImportReview ? (
          <RecipeImportReviewBanner
            sourceName={recipe.sourceName}
            sourceUrl={recipe.sourceUrl}
            onVerify={() => setActiveTab("ingredients")}
          />
        ) : recipeDetailV3 ? (
          <p
            data-testid="recipe-standfirst"
            className="leading-relaxed text-foreground-secondary"
            style={{ fontFamily: "var(--font-headline)", fontSize: "17px", lineHeight: "26px" }}
          >
            {(() => {
              const desc = dbDescription ? sanitizeRecipeDescription(dbDescription) : null;
              if (desc && desc.trim().length > 0) return desc.trim();
              const p = Math.round(scaledMacros.protein);
              return p > 0
                ? `A clean ${p}g of protein that sits comfortably inside what's left of today — quick enough for a weeknight, good enough to want again.`
                : "Quick enough for a weeknight, good enough to want again — and it sits comfortably inside what's left of your day.";
            })()}
          </p>
        ) : null}

        {/* 3. Action pills.
            Flag-OFF (legacy): Start Cooking (outline) / Log (cream) / Edit.
            ENG-1247 flag-ON: Cook + Log move to the consolidated sticky CTA bar
            at the foot of the page, so this row collapses to the owner-only Edit
            pill (rendered nothing for non-owners). The web Log is also now a
            REAL journal write (was a fake "Marked as made!" toast).
            Ask omitted: no AI-coach handler exists (net-new Figma 185:2). */}
        {recipeDetailV3 ? (
          isMyRecipe && !isCatalogRecipe ? (
            <div className="flex gap-3" data-testid="recipe-action-pills">
              <button
                type="button"
                onClick={() => setRecipeEditOpen(true)}
                data-testid="recipe-action-edit"
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-background-secondary border border-border text-foreground text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
              >
                <Icons.edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          ) : null
        ) : (
          <div className="flex gap-3" data-testid="recipe-action-pills">
            <button
              type="button"
              onClick={() => setCookModeOpen(true)}
              disabled={instructionSteps.length === 0}
              data-testid="recipe-action-start-cooking"
              // Aubergine OUTLINE (Sloe treatment §1): transparent ground + 1.5px
              // aubergine border + aubergine label, not a filled slab. The
              // everyday primary is an outline; fill is reserved for conversion
              // CTAs + the FAB.
              className={`flex-[1.6] flex items-center justify-center gap-2 h-11 rounded-full bg-transparent border-[1.5px] border-primary-solid text-primary-solid text-sm font-bold hover:bg-primary/5 transition-all disabled:opacity-50 ${commitCtaPayoffClass}`}
            >
              <Icons.cook className="w-4 h-4" />
              Start Cooking
            </button>
            <button
              type="button"
              onClick={() => toast.success("Marked as made!")}
              data-testid="recipe-action-log"
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-background-secondary border border-border text-foreground text-sm font-semibold hover:bg-muted transition-all ${commitCtaPayoffClass}`}
            >
              <Icons.check className="w-4 h-4" />
              Log
            </button>
            {isMyRecipe && !isCatalogRecipe ? (
              <button
                type="button"
                onClick={() => setRecipeEditOpen(true)}
                data-testid="recipe-action-edit"
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-background-secondary border border-border text-foreground text-sm font-semibold hover:bg-muted transition-all"
              >
                <Icons.edit className="w-4 h-4" />
                Edit
              </button>
            ) : null}
          </div>
        )}

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
          // ENG-748 (legal-reviewer P0): a PERSISTENT disclaimer caption
          // sits directly beneath the chip — not a tooltip/tap/global
          // ToS — whenever EITHER gluten chip renders. The chip is an
          // estimate from ingredient names on a coeliac-sensitive
          // surface; the caption must always be visible so the chip is
          // never read as a safety guarantee. The regulated term
          // "Gluten-free" is never rendered as a label (EU/UK Reg
          // 828/2014). Mirror: apps/mobile/app/recipe/[id].tsx.
          return (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Recipe tags">
                <TrustChip
                  variant={glutenResult.variant}
                  data-testid="recipe-detail-gluten-chip"
                />
              </div>
              <p
                className="text-[11px] leading-snug text-muted-foreground"
                data-testid="recipe-detail-gluten-disclaimer"
              >
                Estimated from ingredient names — not a guarantee. Always
                check labels and packaging if you avoid gluten for medical
                reasons.
              </p>
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
          // Design Direction 2026 — allergen callout routed through SupprCard.
          // Null state is QUIET (premium-audit 2026-06-09, gap 6 — mobile
          // parity): when an allergen IS tagged the full white-slab card
          // renders with the verify caveat; when nothing is tagged it collapses
          // to one quiet caption line, same calm-minimal class as the micros
          // collapse. Silence ≠ safety, so the caption still names the caveat.
          if (!containsLine) {
            return (
              <p
                className="text-xs text-muted-foreground/80 leading-snug"
                role="note"
                aria-label="Not tagged for allergens. We tag recipes from matched ingredients — always verify against the original source if an allergen is a safety concern."
                data-testid="recipe-allergen-callout"
              >
                Not tagged for allergens — always verify against the original source.
              </p>
            );
          }
          return (
            <SupprCard
              padding="md"
              radius="xl"
              className="text-xs"
              style={whiteSlabStyle}
              role="note"
              aria-label="Regulated-allergen information"
              data-testid="recipe-allergen-callout"
            >
              <p className="font-semibold text-foreground mb-1">{containsLine}</p>
              <p className="text-muted-foreground leading-snug">
                We tag recipes from matched ingredients at import and verify time. Always verify ingredients against the original source if an allergen is a safety concern.
              </p>
            </SupprCard>
          );
        })()}

        {/* Creator Info */}
        {/* Figma 332:2 — white slab on cream (was translucent cream-on-white). */}
        <div className="flex items-center gap-4 p-6 rounded-2xl" style={whiteSlabStyle}>
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
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              {followBusy ? "…" : isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {/* Owner inline yield-edit — authored "recipe makes N portions". The
            time display moved to the meta row above (Figma 332:2 §5); this row
            now carries only the owner's inline yield editor (also reachable via
            the Edit action pill → RecipeEditDialog). Owner-only, non-catalog. */}
        {(() => {
          const showOwnerEdit = isMyRecipe && !isCatalogRecipe;
          if (!showOwnerEdit) return null;
          return (
            <div
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
              data-testid="recipe-time-stats"
            >
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
                    className="text-xs font-semibold text-primary-solid hover:underline disabled:opacity-50"
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
        {/* Design Direction 2026 — servings stepper routed through SupprCard.
            ENG-1247: when the v3 sticky CTA bar is on, the canonical servings
            stepper lives in that bar (YIELD), so this mid-body card is hidden to
            avoid a duplicate control. Flag-OFF keeps it here. */}
        {recipeDetailV3 ? null : (
        <SupprCard
          padding="lg"
          radius="xl"
          className="flex items-center justify-between"
          style={whiteSlabStyle}
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
        </SupprCard>
        )}

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
        {/* Macro summary — Figma 332:2 (ENG-920, resolved 2026-06-07):
            FLAT NUMBER STRIP, not progress-bar tiles. ONE white slab on the
            cream page, four equal columns, each = a serif Newsreader VALUE +
            a small-caps label (CAL / PRO / CARB / FAT, calories first), no
            per-macro target bar/ring. Mirrors the verified public-share strip
            in `app/recipe/[id]/page.tsx` and the mobile detail so all three
            recipe-detail surfaces read identically.

            The four columns are Figma-fixed at CAL/PRO/CARB/FAT. Tracked
            micros (fiber/sugar/sodium) that the user follows are NOT dropped —
            they continue below the strip as a secondary chip row so no
            tracked nutrition value disappears with the layout change.

            Net-carbs lens preserved: the CARB column swaps to "NET" + the
            net-carbs value via the same `carbsLabel` / `netCarbsForRow`
            helpers when the lens is on and fibre is known. */}
        {(() => {
          // P3-30 (2026-04-25) net-carbs lens carried into the flat strip:
          // the CARB column label + value swap to net carbs from settings.
          const carbColLabel = carbsLabel(scaledMicros.fiberG, netCarbsLensEnabled);
          const carbColValue = netCarbsForRow(
            scaledMacros.carbs,
            scaledMicros.fiberG,
            netCarbsLensEnabled,
          );
          // Figma strip shows integer glance values (matches the verified
          // public-share strip `${Math.round(...)}`). Per-decimal precision
          // lives on the Nutrition tab; the hero strip is the at-a-glance read.
          // Figma 332:2 §4 — VALUES coloured per macro: Cal plum / Pro sage /
          // Carb clay / Fat amber. Net-carbs follows the carb (clay) hue.
          const macroStrip: Array<{ key: string; label: string; value: string; unit: string; color: string }> = [
            { key: "calories", label: "CAL", value: `${Math.round(scaledMacros.calories)}`, unit: "", color: "var(--foreground-brand)" },
            { key: "protein", label: "PRO", value: `${Math.round(scaledMacros.protein)}`, unit: "g", color: "var(--macro-protein)" },
            // Net-carbs lens: label reads "NET" small-caps when the lens is on
            // (carbsLabel returns "Net carbs"); strip uses the compact 3-letter
            // forms so we map it explicitly rather than uppercasing the long copy.
            {
              key: "carbs",
              label: carbColLabel.toLowerCase().startsWith("net") ? "NET" : "CARB",
              value: `${Math.round(carbColValue)}`,
              unit: "g",
              color: "var(--macro-carbs)",
            },
            { key: "fat", label: "FAT", value: `${Math.round(scaledMacros.fat)}`, unit: "g", color: "var(--macro-fat)" },
          ];
          return (
            <div
              data-testid="recipe-macros-grid"
              role="list"
              aria-label="Nutrition per serving"
              className={`grid grid-cols-4 ${
                recipeDetailV3
                  ? "border-y border-border py-4"
                  : "rounded-2xl"
              }`}
              style={recipeDetailV3 ? undefined : whiteSlabStyle}
            >
              {macroStrip.map((m, idx) => (
                <div
                  key={m.key}
                  role="listitem"
                  data-testid={`recipe-macro-tile-${m.key}`}
                  className={`flex flex-col items-center justify-center py-5 ${
                    idx > 0 ? "border-l border-border" : ""
                  }`}
                >
                  <p
                    className="tabular-nums"
                    style={{ fontFamily: "var(--font-headline)", fontSize: "24px", fontWeight: 400, color: m.color }}
                  >
                    {m.value}
                    {m.unit ? (
                      <span className="text-base font-normal text-foreground-secondary">{m.unit}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-secondary">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          );
        })()}
        {/* Tracked-micro overflow chips — fiber / sugar / sodium when the user
            tracks them AND the recipe has a value. Kept below the Figma-fixed
            four-column strip so the layout change drops no tracked value. */}
        {(() => {
          const microChips: Array<{ key: string; label: string; value: string }> = [];
          if (recipeMacrosToShow.includes("fiber") && scaledMicros.fiberG > 0) {
            microChips.push({ key: "fiber", label: "Fiber", value: `${formatMacroValue(scaledMicros.fiberG, "fiber")}g` });
          }
          if (recipeMacrosToShow.includes("sugar") && scaledMicros.sugarG > 0) {
            microChips.push({ key: "sugar", label: "Sugar", value: `${scaledMicros.sugarG}g` });
          }
          if (recipeMacrosToShow.includes("sodium") && scaledMicros.sodiumMg > 0) {
            microChips.push({ key: "sodium", label: "Sodium", value: `${scaledMicros.sodiumMg}mg` });
          }
          if (microChips.length === 0) return null;
          return (
            <div
              data-testid="recipe-macro-micro-chips"
              className="mb-2 flex flex-wrap gap-2"
              aria-label="Additional nutrition per serving"
            >
              {microChips.map((m) => (
                <span
                  key={m.key}
                  data-testid={`recipe-macro-chip-${m.key}`}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground"
                  style={whiteSlabStyle}
                >
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-semibold tabular-nums">{m.value}</span>
                </span>
              ))}
            </div>
          );
        })()}
        {/* 5. Meta row (Figma 332:2 §5) — time · item count. Rating +
            difficulty are intentionally hidden: the recipes table has no
            aggregate rating or difficulty column, and we never invent recipe
            metadata. Shared `composeRecipeMeta` keeps web == mobile. */}
        {(() => {
          const metaStats = composeRecipeMeta({
            prepMin: dbPrepMin,
            cookMin: dbCookMin,
            ingredientCount: ingredients.length,
          });
          if (metaStats.length === 0) return null;
          return (
            <div
              className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
              data-testid="recipe-meta-row"
              aria-label={metaStats.map((s) => s.label).join(", ")}
            >
              {metaStats.map((stat, idx) => (
                <span key={stat.key} className="inline-flex items-center gap-2">
                  {idx > 0 ? <span aria-hidden className="text-muted-foreground/60">·</span> : null}
                  {stat.key === "time" ? (
                    <Icons.timer className="w-4 h-4" aria-hidden />
                  ) : (
                    <Icons.recipe className="w-4 h-4" aria-hidden />
                  )}
                  <span>{stat.label}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {/* Creator Discrepancy */}
        {isCatalogRecipe &&
          recipe.creatorCalories &&
          Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
              <Icons.caution className="w-4 h-4 text-warning-solid mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-solid">
                  Creator stated {recipe.creatorCalories} kcal (
                  {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                </p>
                <p className="text-xs text-warning-solid/80 mt-0.5">Verified value calculated from ingredient data</p>
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
          {autoVerifyingIngredients ? (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Matching each line against the food database (USDA / Open Food Facts / FatSecret / Edamam when configured)…
            </p>
          ) : null}
          {cookIngredientChecklistEnabled && ingredients.length > 0 ? (
            <div className="mb-4">
              <CookIngredientChecklist
                recipeId={String(recipe.id)}
                items={ingredients.map((ingredient) => {
                  const amountLine = ingredient.amount
                    ? formatIngredientAmountUnit(
                        formatIngredientAmount((parseFloat(ingredient.amount) * servings) / baseServings),
                        ingredient.unit,
                      )
                    : ingredient.unit;
                  return {
                    name: cleanIngredientDisplayName(ingredient.name) || ingredient.name,
                    amountLabel: amountLine || null,
                  };
                })}
                surface="recipe_detail"
              />
            </div>
          ) : null}
          {/* Figma 332:2 — ingredient photo-card grid (mirrors the
              public-share + mobile detail). Each card is a white slab with a
              deterministic RecipeHeroFallback glyph image area (recipe rows
              carry NO per-ingredient image — never an empty box, no new
              imagery wired), then name + amount + kcal + confidence. The
              owner Fix/Override + Verify affordances are preserved per card. */}
          <div>
            {ingredients.length === 0 ? (
              <div
                className="rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm"
                style={whiteSlabStyle}
              >
                No ingredients listed yet.
              </div>
            ) : (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3" aria-label="Ingredients">
                {ingredients.map((ingredient, index) => {
                  // Use effective macros so per-row overrides take precedence (Batch 2.7).
                  const eff = effectiveMacros(ingredient);
                  const ingCal = Math.round((eff.calories * servings) / baseServings);
                  const rowHasOverride = hasOverride(ingredient);
                  const rowAddedByUser = Boolean(ingredient.addedByUser);
                  /**
                   * 2026-05-02 fix — derive verification tier from the
                   * persisted `{is_verified, confidence, source}` triple so the
                   * dot, badge, and Verify CTA agree with the row. Shared helper
                   * keeps web/mobile in sync.
                   */
                  const verificationTier = deriveIngredientVerificationTier({
                    isVerified: ingredient.isVerified ?? null,
                    confidence: ingredient.confidence ?? null,
                    source: ingredient.source ?? null,
                  });
                  const showVerifyCta = ingredientShouldShowVerifyCta(verificationTier);
                  const tierColorVar =
                    verificationTier === "verified"
                      ? "var(--success)"
                      : verificationTier === "partial"
                        ? "var(--warning)"
                        : verificationTier === "estimated"
                          ? "var(--destructive)"
                          : "var(--foreground-tertiary)";
                  const tierLabel =
                    verificationTier === "verified"
                      ? "Structured"
                      : verificationTier === "partial"
                        ? "Partial match"
                        : verificationTier === "estimated"
                          ? "Estimated"
                          : "Unverified";
                  const amountLine = ingredient.amount
                    ? formatIngredientAmountUnit(
                        formatIngredientAmount((parseFloat(ingredient.amount) * servings) / baseServings),
                        ingredient.unit,
                      )
                    : ingredient.unit;
                  // Sloe image system (2026-06-08) — on-brand tile image
                  // (Template B, white-bg) when `ingredient_images` has a
                  // ready row for this name's key, else a calm cream
                  // placeholder. Label uses the cleaned display name.
                  const tileImageUrl = resolveIngredientTileImage(ingredient.name, ingredientImageMap);
                  const tilePlaceholder = getIngredientTilePlaceholder(ingredient.name);
                  const displayName = cleanIngredientDisplayName(ingredient.name) || ingredient.name;
                  return (
                    <li
                      key={index}
                      className="group overflow-hidden rounded-3xl border border-border/70"
                      style={whiteSlabStyle}
                      data-testid={`recipe-ingredient-card-${index}`}
                    >
                      {/* Image area — on-brand ingredient tile (Sloe image
                          system, 2026-06-08). When `ingredient_images` has a
                          ready Template-B photo for this ingredient we render
                          it; otherwise a calm cream placeholder with the
                          ingredient's sage initial (never the loud gradient,
                          never an empty box). Confidence dot + kcal pill ride
                          the image corners. */}
                      <div className="relative h-[86px] w-full">
                        {tileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tileImageUrl}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            data-testid={`recipe-ingredient-image-${index}`}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ backgroundColor: tilePlaceholder.bg }}
                            data-testid={`recipe-ingredient-placeholder-${index}`}
                            aria-hidden
                          >
                            <span
                              className="text-2xl font-semibold"
                              style={{ color: tilePlaceholder.fg, fontFamily: "var(--font-headline)" }}
                            >
                              {tilePlaceholder.initial}
                            </span>
                          </div>
                        )}
                        <span
                          className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white"
                          style={{ backgroundColor: tierColorVar }}
                          aria-hidden
                        />
                        {/* P2-30: kcal pill suppressed at 0. */}
                        {ingCal > 0 ? (
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                            {ingCal} kcal
                          </span>
                        ) : null}
                      </div>
                      <div className="px-2.5 py-2">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold leading-snug text-foreground line-clamp-2">
                            {displayName}
                          </p>
                          {rowHasOverride ? (
                            <Badge variant="override" title="Manual macro override is pinned on this row.">
                              Override
                            </Badge>
                          ) : null}
                          {rowAddedByUser ? (
                            <Badge variant="added" title="Added by you after import.">
                              Added
                            </Badge>
                          ) : null}
                        </div>
                        {amountLine ? (
                          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{amountLine}</p>
                        ) : null}
                        <div className="mt-1 flex items-center gap-1.5">
                          {/* F-120: categorical tier label only (no opaque %). */}
                          <span className="text-[10px] font-semibold" style={{ color: tierColorVar }}>
                            {tierLabel}
                          </span>
                          {/* Phase 4 / B3.X — provenance SourceDot. */}
                          <SourceDot
                            source={mapMealSourceToDot(ingredient.source)}
                            size={6}
                            data-testid={`recipe-ingredient-source-${index}`}
                          />
                        </div>
                        {/* Phase 4 / B3.X — "Verify →" on estimated rows
                            (visibility follows the shared tier). */}
                        {dbIngredientIds[index] && showVerifyCta ? (
                          <button
                            type="button"
                            onClick={() => { setVerifyIndex(index); setVerifySearchOpen(true); }}
                            className="mt-1 text-[10px] font-bold text-primary-solid hover:underline"
                            aria-label={`Verify ${ingredient.name}`}
                            data-testid={`recipe-ingredient-verify-${index}`}
                          >
                            Verify →
                          </button>
                        ) : null}
                        {/* Owner Fix / Override — surfaced on card hover/focus
                            (preserves the existing per-ingredient owner edit
                            affordances inside the new card layout). */}
                        {dbIngredientIds[index] && (
                          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => { setVerifyIndex(index); setVerifySearchOpen(true); }}
                              className="rounded-full px-1.5 py-0.5 text-[10px] text-primary-solid hover:bg-primary/10"
                              aria-label={`Fix match for ${ingredient.name}`}
                            >
                              Fix
                            </button>
                            <button
                              type="button"
                              onClick={() => setOverrideIndex(index)}
                              className="rounded-full px-1.5 py-0.5 text-[10px] text-primary-solid hover:bg-primary/10"
                              aria-label={`Override nutrition for ${ingredient.name}`}
                            >
                              Override
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {isMyRecipe && !isCatalogRecipe && (
              <div className="mt-3 rounded-2xl px-4 py-3" style={whiteSlabStyle}>
                <button
                  type="button"
                  onClick={() => setAddIngOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-card px-4 py-2.5 text-sm font-semibold text-primary-solid hover:bg-primary/10 transition-colors"
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
          {/* ENG-943 — Add this recipe's ingredients to the shopping list
              (default-ON `recipe_shopping_list_v1`; OFF → plan-only list). */}
          {recipeShoppingListEnabled && ingredients.length > 0 ? (
            <AddToShoppingListAction
              recipeId={String(recipe.id)}
              recipeTitle={recipe.title}
              userId={appUserId}
              activeHouseholdId={activeHouseholdId}
              multiplier={baseServings > 0 ? servings / baseServings : 1}
              setShoppingItems={setShoppingItems}
              ingredients={ingredients.map((ing) => ({
                name: String(ing.name ?? ""),
                amount: ing.amount != null ? String(ing.amount) : "",
                unit: ing.unit != null ? String(ing.unit) : "",
              }))}
            />
          ) : null}
          </>
        )}

        {/* Steps Tab */}
        {activeTab === "steps" && (
          <div
            className={recipeDetailV3 ? "space-y-3" : "rounded-2xl p-5 space-y-4"}
            style={recipeDetailV3 ? undefined : whiteSlabStyle}
          >
            {recipeDetailV3 ? (
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">
                  Method
                </h3>
                <span className="text-xs text-foreground-tertiary">
                  {instructionSteps.length} steps
                  {(dbPrepMin ?? 0) + (dbCookMin ?? 0) > 0
                    ? ` · ${(dbPrepMin ?? 0) + (dbCookMin ?? 0)} min`
                    : ""}
                </span>
              </div>
            ) : null}
            {instructionSteps.length === 0 ? (
              <p className="text-muted-foreground text-sm">No instructions yet.</p>
            ) : recipeDetailV3 ? (
              <ol className="list-none m-0 p-0">
                {instructionSteps.map((step, index) => (
                  <li
                    key={index}
                    className="flex gap-4 border-b border-border py-3.5 last:border-b-0"
                  >
                    <span
                      className="w-[30px] shrink-0 text-[24px] font-medium leading-none tabular-nums"
                      style={{ fontFamily: "var(--font-headline)", color: "var(--accent-primary-soft)" }}
                    >
                      {index + 1}
                    </span>
                    <p className="m-0 flex-1 pt-0.5 text-[15px] leading-relaxed text-foreground">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              instructionSteps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
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
                // Figma 332:2 — nutrition stat tile is a white slab on cream.
                <SupprCard key={stat.label} padding="md" radius="xl" className="text-center" style={whiteSlabStyle}>
                  <span className="text-lg font-bold text-foreground tabular-nums">{stat.value}</span>
                  <span className="text-xs text-muted-foreground ml-0.5">{stat.unit}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </SupprCard>
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
                <div className="rounded-2xl p-4 space-y-3" style={whiteSlabStyle}>
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
        {/* ENG-819 — web analog of the mobile confirm haptic on the recipe-detail
            commit CTAs: a brief press payoff (scale + brightness lift) via
            `commitCtaPayoffClass`, gated on `redesign_winmoment`. Web has no
            Haptics API, so the press motion is the tactile substitute. Start
            Cooking stays the blue `bg-primary` commit colour. */}
        {/* Figma 332:2 reskin — action pills are radius-full (mirrors the
            mobile Start Cooking pill + the web public-share CTA). */}
        <div className="flex gap-3">
          {instructionSteps.length > 0 && (
            <button
              type="button"
              onClick={() => setCookModeOpen(true)}
              // Aubergine OUTLINE (Sloe treatment §1) — everyday primary as a
              // line, not a filled slab.
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-transparent border-[1.5px] border-primary-solid text-primary-solid font-bold text-sm hover:bg-primary/5 transition-all ${commitCtaPayoffClass}`}
            >
              <Icons.cook className="w-4 h-4" />
              Start Cooking
            </button>
          )}
          <button
            type="button"
            onClick={() => toast.success("Marked as made!")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-card border border-border text-foreground font-bold text-sm hover:bg-muted transition-all ${commitCtaPayoffClass}`}
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

      {/* ENG-1247 — consolidated sticky CTA bar (prototype sticky CTA,
          Sloe-App.html L4418–4421). YIELD stepper (left) · Cook Mode (outline
          SECONDARY) · Log (filled PRIMARY, dominant). Log is the single filled
          slab (one-filled-CTA rule). Flag-gated; flag-OFF keeps the in-row
          Cook/Log pills + the mid-body servings card. */}
      {recipeDetailV3 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm"
          data-testid="recipe-detail-sticky-footer"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-6 py-3">
            {/* Left — yield + servings stepper (canonical servings control). */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Yield
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleViewServingsStep(-1)}
                  disabled={servings <= RECIPE_VIEW_SERVINGS_MIN}
                  aria-label="Decrease servings"
                  data-testid="recipe-footer-servings-decrement"
                  className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span
                  className="min-w-6 text-center tabular-nums text-foreground-brand"
                  style={{ fontFamily: "var(--font-headline)", fontSize: "20px", fontWeight: 400 }}
                  role="status"
                  aria-live="polite"
                  aria-label={`${servings} servings`}
                  data-testid="recipe-footer-servings-value"
                >
                  {servings}
                </span>
                <button
                  type="button"
                  onClick={() => handleViewServingsStep(1)}
                  disabled={servings >= RECIPE_VIEW_SERVINGS_MAX}
                  aria-label="Increase servings"
                  data-testid="recipe-footer-servings-increment"
                  className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Right — Cook Mode (outline secondary) + Log (filled primary). */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCookModeOpen(true)}
                disabled={instructionSteps.length === 0}
                data-testid="recipe-cook-mode-cta"
                className={`flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-transparent border-[1.5px] border-primary-solid text-primary-solid text-sm font-bold hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all disabled:opacity-50 ${commitCtaPayoffClass}`}
              >
                <Icons.cook className="w-4 h-4" />
                Cook Mode
              </button>
              <button
                type="button"
                onClick={() => void logRecipeToToday()}
                disabled={loggingRecipe}
                data-testid="recipe-footer-log-cta"
                aria-busy={loggingRecipe}
                className={`flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all disabled:opacity-60 ${commitCtaPayoffClass}`}
              >
                <Icons.add className="w-4 h-4" />
                {loggingRecipe ? "Logging…" : "Log"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
