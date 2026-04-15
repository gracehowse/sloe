import { useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { IngredientRow, RecipeCard, UserTier } from "../../types/recipe.ts";
import { GoPublicDialog } from "./GoPublicDialog.tsx";
import { CookMode } from "./CookMode.tsx";
import { FoodSearch, type FoodSearchSelection } from "./FoodSearch.tsx";
import { MacroCard } from "./suppr/macro-card";
import { ConfidenceDot } from "./suppr/confidence-dot";
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
    source: row.source ?? "Manual",
  };
}

export function RecipeDetail({ recipe, userTier, onBack, autoOpenCookMode, initialServings, onViewTracker }: RecipeDetailProps) {
  const {
    toggleSaveRecipe,
    isRecipeSaved,
    refreshDiscoverRecipes,
    refreshMyLibraryRecipes,
    addNotification,
    notificationPrefs,
  } = useAppData();
  const router = useRouter();
  const saved = isRecipeSaved(recipe.id);
  const [servings, setServings] = useState(
    initialServings != null && initialServings > 0
      ? Math.round(recipe.servings * initialServings * 10) / 10
      : recipe.servings,
  );
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");
  const [cookModeOpen, setCookModeOpen] = useState(Boolean(autoOpenCookMode));

  const isCatalogRecipe = false;
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
  } | null>(null);
  const [dbIngredients, setDbIngredients] = useState<IngredientRow[]>([]);
  const [dbIngredientIds, setDbIngredientIds] = useState<string[]>([]);
  const [dbFetchFailed, setDbFetchFailed] = useState(false);
  const [verifySearchOpen, setVerifySearchOpen] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState<number | null>(null);

  const [followCreatorId, setFollowCreatorId] = useState<string | null>(null);
  const [recipeAuthorId, setRecipeAuthorId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
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
  }, [recipe.id, isCatalogRecipe]);

  const ingredients = dbIngredients;
  const instructionSteps = useMemo(() => {
    const text = dbInstructionsText?.trim() ?? "";
    if (!text) return [];
    return text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [dbInstructionsText]);

  const baseServings = dbServings ?? recipe.servings;
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
      fiberG: acc.fiberG + (ing.fiberG ?? 0),
      sugarG: acc.sugarG + (ing.sugarG ?? 0),
      sodiumMg: acc.sodiumMg + (ing.sodiumMg ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  // Scaled micronutrients — from ingredient sum or recipe-level fallback
  const scaledMicros = {
    fiberG: Math.round(((ingredientTotal.fiberG || displayRecipe.fiberG || 0) * servings) / baseServings * 10) / 10,
    sugarG: Math.round(((ingredientTotal.sugarG || displayRecipe.sugarG || 0) * servings) / baseServings * 10) / 10,
    sodiumMg: Math.round(((ingredientTotal.sodiumMg || displayRecipe.sodiumMg || 0) * servings) / baseServings),
  };

  // macroAccuracy available if needed: Math.abs(ingredientTotal.calories - displayRecipe.calories)

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
        servings={baseServings}
        onExit={() => setCookModeOpen(false)}
        onViewTracker={onViewTracker}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-xl bg-card/80 border-b border-border/50 px-6 py-4 flex items-center gap-4 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all">
          <Icons.back className="w-5 h-5" />
        </button>
        <h2 className="flex-1 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">{recipe.title}</h2>
        {isMyRecipe ? (
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
              router.replace(`/?${q}`, { scroll: false });
            }}
            className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/60 font-semibold"
          >
            Edit
          </button>
        ) : null}
        {isMyRecipe && isPublished === false ? (
          <GoPublicDialog
            recipeTitle={recipe.title}
            disabled={dbLoading}
            onConfirmPublish={() => void setPublished(true)}
            triggerLabel="Go public"
          />
        ) : null}
        {isMyRecipe && isPublished === true ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={dbLoading}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/60 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            <Icons.cook className="w-4 h-4" />
            Cook
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleSaveRecipe(recipe.id, userTier)}
          className={`p-2.5 rounded-xl transition-all ${
            saved
              ? "text-primary bg-primary/10 shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted/60"
          }`}
          aria-label={saved ? "Remove from library" : "Save to library"}
        >
          <Icons.save className="w-5 h-5" fill={saved ? "currentColor" : "none"} />
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
          className="p-2.5 text-muted-foreground hover:bg-muted/60 rounded-xl transition-all"
          aria-label="Copy share link"
        >
          <Icons.share className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-8 space-y-8">
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
        <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
          <img src={recipe.image} alt={recipe.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
        </div>

        {!isCatalogRecipe && dbDescription && (
          <p className="text-muted-foreground leading-relaxed">{dbDescription}</p>
        )}

        {/* Creator Info */}
        <div className="flex items-center gap-4 p-6 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 shadow-lg">
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

        {/* Info Row — Prep / Cook / Servings / Confidence (matches mobile) */}
        <div className="flex gap-3">
          {[
            { icon: Icons.timer, label: "Prep", value: recipe.prepTime ?? "—" },
            { icon: Icons.time, label: "Cook", value: recipe.cookTime ?? "—" },
            { icon: Icons.target, label: "Servings", value: `${servings}` },
            { icon: Icons.verified, label: "Confidence", value: isCatalogRecipe ? "Verified" : "Estimated" },
          ].map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-card border border-border">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">{item.value}</span>
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Servings Selector */}
        <div className="bg-card rounded-2xl p-4 flex items-center justify-between border border-border">
          <span className="font-semibold text-foreground text-sm">Servings</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-all flex items-center justify-center"
            >
              −
            </button>
            <span className="w-8 text-center font-bold text-foreground tabular-nums">{servings}</span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Macro Cards Row (3 macros + kcal badge — matches mobile) */}
        <div className="flex gap-2">
          <MacroCard macro="protein" value={scaledMacros.protein} target={undefined} />
          <MacroCard macro="carbs" value={scaledMacros.carbs} target={undefined} />
          <MacroCard macro="fat" value={scaledMacros.fat} target={undefined} />
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl p-2.5 border border-border" style={{ backgroundColor: "var(--macro-calories)", color: "#fff" }}>
            <span className="text-base font-bold tabular-nums">{Math.round(scaledMacros.calories)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">kcal</span>
          </div>
        </div>

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
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {ingredients.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">No ingredients listed yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {ingredients.map((ingredient, index) => {
                  const ingCal = Math.round((ingredient.calories * servings) / baseServings);
                  const ingP = Math.round((ingredient.protein * servings) / baseServings);
                  const ingC = Math.round((ingredient.carbs * servings) / baseServings);
                  const ingF = Math.round((ingredient.fat * servings) / baseServings);
                  const macroTotal = ingP + ingC + ingF || 1;
                  return (
                    <div key={index} className="px-4 py-3 flex items-center gap-3 group">
                      <ConfidenceDot level={ingredient.isVerified ? "high" : "medium"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ingredient.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ingredient.amount
                            ? `${(parseFloat(ingredient.amount) * servings) / baseServings} ${ingredient.unit}`.trim()
                            : ingredient.unit}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{ingCal} kcal</span>
                      {/* Stacked P/C/F bar */}
                      <div className="w-12 h-2 rounded-full overflow-hidden flex shrink-0">
                        <div style={{ width: `${(ingP / macroTotal) * 100}%`, backgroundColor: "var(--macro-protein)" }} />
                        <div style={{ width: `${(ingC / macroTotal) * 100}%`, backgroundColor: "var(--macro-carbs)" }} />
                        <div style={{ width: `${(ingF / macroTotal) * 100}%`, backgroundColor: "var(--macro-fat)" }} />
                      </div>
                      {dbIngredientIds[index] && (
                        <button
                          onClick={() => { setVerifyIndex(index); setVerifySearchOpen(true); }}
                          className="text-xs text-primary hover:bg-primary/10 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Fix
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                { label: "Carbs", value: `${Math.round(scaledMacros.carbs)}`, unit: "g" },
                { label: "Fat", value: `${Math.round(scaledMacros.fat)}`, unit: "g" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <span className="text-lg font-bold text-foreground tabular-nums">{stat.value}</span>
                  <span className="text-xs text-muted-foreground ml-0.5">{stat.unit}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Micronutrient bars — real data from ingredients */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Micronutrients</h4>
              {[
                { name: "Fiber", pct: Math.min(100, Math.round((scaledMicros.fiberG / 28) * 100)), value: `${scaledMicros.fiberG}g` },
                { name: "Sugar", pct: Math.min(100, Math.round((scaledMicros.sugarG / 50) * 100)), value: `${scaledMicros.sugarG}g` },
                { name: "Sodium", pct: Math.min(100, Math.round((scaledMicros.sodiumMg / 2300) * 100)), value: `${scaledMicros.sodiumMg}mg` },
              ].map((micro) => (
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
      </div>

      {/* Food search dialog for ingredient verification */}
      <FoodSearch
        open={verifySearchOpen}
        onClose={() => { setVerifySearchOpen(false); setVerifyIndex(null); }}
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

          const grams = selection.chosenPortion.gramWeight * selection.quantity;
          const f = grams / 100;
          const macros = {
            calories: Math.round(selection.macrosPer100g.calories * f),
            protein: Math.round(selection.macrosPer100g.protein * f * 10) / 10,
            carbs: Math.round(selection.macrosPer100g.carbs * f * 10) / 10,
            fat: Math.round(selection.macrosPer100g.fat * f * 10) / 10,
          };

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
              fiber_g: Math.round(selection.macrosPer100g.fiberG * f * 10) / 10,
              sugar_g: Math.round(selection.macrosPer100g.sugarG * f * 10) / 10,
              sodium_mg: Math.round(selection.macrosPer100g.sodiumMg * f),
              is_verified: true,
              source: selection.source,
            })
            .eq("id", ingId);

          if (error) {
            toast.error("Failed to update ingredient");
            return;
          }

          // Update local state
          setDbIngredients((prev) =>
            prev.map((ing, i) =>
              i === verifyIndex
                ? { ...ing, name: selection.name, amount: String(selection.quantity), unit: selection.chosenPortion.label, ...macros, isVerified: true, source: selection.source }
                : ing,
            ),
          );
          toast.success(`Updated to ${selection.name}`);
          setVerifyIndex(null);
        }}
      />
    </div>
  );
}
