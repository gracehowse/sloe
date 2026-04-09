import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Share2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { getIngredientsForRecipe, getInstructionsForRecipe, getRecipeById } from "../../data/recipeCatalog.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { IngredientRow, RecipeCard, UserTier } from "../../types/recipe.ts";

interface RecipeDetailProps {
  recipe: RecipeCard;
  userTier: UserTier;
  onBack: () => void;
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
  is_verified: boolean;
  source: string | null;
};

function mapDbIngredientToRow(row: DbIngredientRow): IngredientRow {
  return {
    name: row.name,
    amount: row.amount != null ? String(row.amount) : "",
    unit: row.unit ?? "",
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    isVerified: row.is_verified,
    source: "Manual",
  };
}

export function RecipeDetail({ recipe, userTier, onBack }: RecipeDetailProps) {
  const { toggleSaveRecipe, isRecipeSaved } = useAppData();
  const saved = isRecipeSaved(recipe.id);
  const [servings, setServings] = useState(recipe.servings);
  const [showIngredients, setShowIngredients] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);

  const isCatalogRecipe = Boolean(getRecipeById(recipe.id));

  const [dbLoading, setDbLoading] = useState(!isCatalogRecipe);
  const [dbDescription, setDbDescription] = useState<string | null>(null);
  const [dbInstructionsText, setDbInstructionsText] = useState<string | null>(null);
  const [dbServings, setDbServings] = useState<number | null>(null);
  const [dbMacros, setDbMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  const [dbIngredients, setDbIngredients] = useState<IngredientRow[]>([]);
  const [dbFetchFailed, setDbFetchFailed] = useState(false);

  const [followCreatorId, setFollowCreatorId] = useState<string | null>(null);
  const [recipeAuthorId, setRecipeAuthorId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMetaLoaded, setFollowMetaLoaded] = useState(false);
  const [publicSaveCount, setPublicSaveCount] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

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
      const { data: row, error: recipeError } = await supabase
        .from("recipes")
        .select(
          "description, instructions, servings, calories, protein, carbs, fat, is_verified",
        )
        .eq("id", recipe.id)
        .maybeSingle();

      if (cancelled) return;
      if (recipeError || !row) {
        setDbFetchFailed(true);
        setDbLoading(false);
        return;
      }

      setDbDescription((row.description as string | null) ?? null);
      setDbInstructionsText((row.instructions as string | null) ?? null);
      setDbServings((row.servings as number) ?? recipe.servings);
      setDbMacros({
        calories: (row.calories as number) ?? 0,
        protein: (row.protein as number) ?? 0,
        carbs: (row.carbs as number) ?? 0,
        fat: (row.fat as number) ?? 0,
      });

      const { data: ingRows, error: ingError } = await supabase
        .from("recipe_ingredients")
        .select("id, name, amount, unit, calories, protein, carbs, fat, is_verified, source")
        .eq("recipe_id", recipe.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (!ingError && ingRows?.length) {
        setDbIngredients(ingRows.map((r) => mapDbIngredientToRow(r as DbIngredientRow)));
      } else {
        setDbIngredients([]);
      }
      setDbLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id, isCatalogRecipe]);

  const catalogIngredients = useMemo(() => getIngredientsForRecipe(recipe.id), [recipe.id]);
  const catalogInstructions = useMemo(() => getInstructionsForRecipe(recipe.id), [recipe.id]);

  const ingredients = isCatalogRecipe ? catalogIngredients : dbIngredients;
  const instructionSteps = useMemo(() => {
    if (isCatalogRecipe) {
      return catalogInstructions;
    }
    const text = dbInstructionsText?.trim() ?? "";
    if (!text) return [];
    return text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [isCatalogRecipe, catalogInstructions, dbInstructionsText]);

  const baseServings = isCatalogRecipe ? recipe.servings : (dbServings ?? recipe.servings);
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
    };
  }, [recipe, isCatalogRecipe, dbMacros, baseServings]);

  const scaledMacros = {
    calories: Math.round((displayRecipe.calories * servings) / baseServings),
    protein: Math.round((displayRecipe.protein * servings) / baseServings),
    carbs: Math.round((displayRecipe.carbs * servings) / baseServings),
    fat: Math.round((displayRecipe.fat * servings) / baseServings),
  };

  const ingredientTotal = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const macroAccuracy = Math.abs(ingredientTotal.calories - displayRecipe.calories);
  const showVerifiedAccuracy = isCatalogRecipe && ingredients.length > 0;

  if (!isCatalogRecipe && dbLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <div className="h-8 w-48 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="aspect-video w-full rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-4/6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">Loading recipe…</p>
      </div>
    );
  }

  if (!isCatalogRecipe && dbFetchFailed) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <p className="text-slate-700 dark:text-slate-300">This recipe could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center gap-4 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="flex-1 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">{recipe.title}</h2>
        <button
          type="button"
          onClick={() => toggleSaveRecipe(recipe.id, userTier)}
          className={`p-2.5 rounded-xl transition-all ${
            saved
              ? "text-violet-600 bg-violet-100 dark:bg-violet-950/30 shadow-lg shadow-violet-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-label={saved ? "Remove from library" : "Save to library"}
        >
          <Bookmark className="w-5 h-5" fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}?recipe=${encodeURIComponent(recipe.id)}`;
            void navigator.clipboard.writeText(url).then(
              () => toast.success("Share link copied"),
              () => toast.error("Could not copy link"),
            );
          }}
          className="p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          aria-label="Copy share link"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-8 space-y-8">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
          {isCatalogRecipe ? (
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Verified curated recipe.</span> Macros and
              ingredients are checked against structured sources in our catalog.
            </p>
          ) : (
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Community recipe.</span> Macros are as
              published by the author; ingredient nutrition may be mixed verified and estimated — review before relying on
              it for medical goals.
            </p>
          )}
        </div>

        {/* Hero Image */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
          <img src={recipe.image} alt={recipe.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
        </div>

        {!isCatalogRecipe && dbDescription && (
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{dbDescription}</p>
        )}

        {/* Creator Info */}
        <div className="flex items-center gap-4 p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg">
          <img src={recipe.creatorImage} alt={recipe.creatorName} className="w-14 h-14 rounded-full object-cover ring-2 ring-violet-500/20" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{recipe.creatorName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {!followMetaLoaded && !isCatalogRecipe ? (
                <span className="text-slate-400">Loading reach…</span>
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
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              {followBusy ? "…" : isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {/* Servings Selector */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 backdrop-blur-sm rounded-2xl p-5 flex items-center justify-between border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <span className="font-semibold text-slate-900 dark:text-white">Servings</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
            >
              −
            </button>
            <span className="w-10 text-center font-bold text-lg text-slate-900 dark:text-white">{servings}</span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Macros */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 px-6 py-4 flex items-center gap-3 border-b border-green-200/50 dark:border-green-800/50">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white flex-1">
              {isCatalogRecipe ? "Verified Nutrition" : "Nutrition (per recipe)"}
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Scaled for {servings} serving{servings === 1 ? "" : "s"} (base {baseServings})
              </span>
            </span>
            {showVerifiedAccuracy && macroAccuracy <= 1 && (
              <span className="px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/50 rounded-full border border-green-200/50 dark:border-green-800/50">
                ±{macroAccuracy} kcal accuracy
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800">
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent mb-1">{scaledMacros.calories}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Calories</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.protein}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Protein</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.carbs}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Carbs</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.fat}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Fat</p>
            </div>
          </div>

          {/* Creator Discrepancy */}
          {isCatalogRecipe &&
            recipe.creatorCalories &&
            Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-t border-orange-200 dark:border-orange-900 px-6 py-4 flex items-start gap-3">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                    Creator stated {recipe.creatorCalories} kcal (
                    {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Verified value calculated from ingredient data
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Ingredients Section */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <button
            type="button"
            onClick={() => setShowIngredients(!showIngredients)}
            className="w-full bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 px-6 py-4 flex items-center justify-between hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-800/70 dark:hover:to-slate-800/50 transition-all"
          >
            <span className="font-semibold text-slate-900 dark:text-white">Ingredients</span>
            {showIngredients ? (
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          {showIngredients && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {ingredients.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No ingredients listed yet.
                </div>
              ) : (
                ingredients.map((ingredient, index) => (
                  <div key={index} className="px-6 py-4 flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">{ingredient.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {ingredient.amount
                          ? `${(parseFloat(ingredient.amount) * servings) / baseServings} ${ingredient.unit}`.trim()
                          : ingredient.unit}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-950/30 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-medium text-green-700 dark:text-green-400">{ingredient.source}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {Math.round((ingredient.calories * servings) / baseServings)} kcal
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        P: {Math.round((ingredient.protein * servings) / baseServings)}g · C:{" "}
                        {Math.round((ingredient.carbs * servings) / baseServings)}g · F:{" "}
                        {Math.round((ingredient.fat * servings) / baseServings)}g
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Instructions Section */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 px-6 py-4 flex items-center justify-between hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-800/70 dark:hover:to-slate-800/50 transition-all"
          >
            <span className="font-semibold text-slate-900 dark:text-white">Instructions</span>
            {showInstructions ? (
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          {showInstructions && (
            <div className="px-6 py-6 space-y-5">
              {instructionSteps.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">No instructions yet.</p>
              ) : (
                instructionSteps.map((step, index) => (
                  <div key={index} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-lg shadow-violet-500/20">
                      {index + 1}
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 pt-1">{step}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
