import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import {
  Alert,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useAuth } from "@/context/auth";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { decodeEntities } from "@/lib/decodeEntities";
import { resolveTargets } from "@/lib/calcTargets";
import { saveImportedRecipe, type ApiImportedRecipe, coercePositiveMinutes } from "@/lib/saveImportedRecipe";
import { classifyMealType } from "@/lib/classifyMealType";
import {
  IMPORT_ERROR_COPY,
  userFacingImportError,
} from "../../../src/lib/recipes/importErrorCopy";
import MealTypePicker from "@/components/MealTypePicker";
import FoodSearchModal, { type SelectedFood } from "@/components/FoodSearchModal";
import OverrideIngredientSheet from "@/components/OverrideIngredientSheet";
import { SupprMark } from "@/components/SupprMark";
import { scaleMacros , parseIngredientForSearch } from "@/lib/verifyRecipe";
import {
  extractUrlFromShareText,
  urlFromDeepLink,
  urlFromRouterParams,
} from "@/lib/resolveImportUrl";
import {
  detectSourcePlatform,
  isCaptionTextPlatform,
} from "@/lib/sourcePlatform";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try { ImagePicker = require("expo-image-picker"); } catch { /* native build only */ }

type Extra = { supprApiUrl?: string };

/** Parse servings draft; clamps 1–99. */
function parseRecipeYieldDraft(draft: string, fallback: number): number {
  return Math.max(1, Math.min(99, Math.round(parseFloat(draft.replace(",", ".")) || fallback)));
}

/**
 * Rescale per-serving macros when the user fixes total portions.
 * Assumes API values are per-serving at `recipe.servings` (whole-dish total = per × base).
 */
/** Map API JSON (camelCase or snake_case, string minutes) into our import shape. */
function normalizeApiImportedRecipe(raw: Record<string, unknown>): ApiImportedRecipe {
  const r = raw as Record<string, unknown>;
  return {
    ...(r as unknown as ApiImportedRecipe),
    prepTimeMin: coercePositiveMinutes(r.prepTimeMin ?? r.prep_time_min),
    cookTimeMin: coercePositiveMinutes(r.cookTimeMin ?? r.cook_time_min),
    sourceUrl:
      (typeof r.sourceUrl === "string" && r.sourceUrl.trim()
        ? r.sourceUrl.trim()
        : typeof r.source_url === "string" && r.source_url.trim()
          ? r.source_url.trim()
          : undefined) as string | undefined,
    sourceName:
      (typeof r.sourceName === "string" && r.sourceName.trim()
        ? r.sourceName.trim()
        : typeof r.source_name === "string" && r.source_name.trim()
          ? r.source_name.trim()
          : undefined) as string | undefined,
  };
}

function nutritionRescale(recipe: ApiImportedRecipe, draftStr: string) {
  const base = Math.max(1, recipe.servings ?? 1);
  const draft = parseRecipeYieldDraft(draftStr, base);
  // When the user has edited ingredient matches (tap-to-search or
  // override on the preview), recipe-level `calories` is the stale
  // import-time number. Prefer the live sum over `ingredientMacros`
  // so the preview header reflects whatever the user just did.
  const macros = Array.isArray(recipe.ingredientMacros) ? recipe.ingredientMacros : [];
  const hasEdited = macros.some((m) => (m.calories ?? 0) > 0);
  if (hasEdited) {
    const total = macros.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      draft,
      factor: 1 / draft,
      calories: Math.round(total.calories / draft),
      protein: Math.round((total.protein / draft) * 10) / 10,
      carbs: Math.round((total.carbs / draft) * 10) / 10,
      fat: Math.round((total.fat / draft) * 10) / 10,
    };
  }
  const factor = base / draft;
  return {
    draft,
    factor,
    calories: Math.round((recipe.calories ?? 0) * factor),
    protein: Math.round((recipe.protein ?? 0) * factor),
    carbs: Math.round((recipe.carbs ?? 0) * factor),
    fat: Math.round((recipe.fat ?? 0) * factor),
  };
}

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
}

type ImportState =
  | "idle"
  | "checking"
  | "importing"
  | "review"
  | "saving"
  | "success"
  | "error"
  /**
   * `captionPreview` — IG/TT/YouTube share-sheet caption flow only.
   * The user has shared a URL + caption text; we show them the caption
   * before kicking off the LLM extractor so they can spot truncation
   * (the iOS share sheet sometimes clips long captions) and confirm.
   * Decision doc:
   * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
   */
  | "captionPreview";
type ProgressStep = "ingredients" | "nutrition" | "macros";

export default function ImportSharedScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/discover");
  const params = useLocalSearchParams();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;

  const [state, setState] = useState<ImportState>("idle");
  const [title, setTitle] = useState<string | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [pendingRecipe, setPendingRecipe] = useState<ApiImportedRecipe | null>(null);
  // Audit I05 (2026-05-05) — `false` when the server-side OpenAI
  // image step rejected the image and silently fell back to text-only.
  // `true` when the image was actually used. `undefined` when no image
  // was supplied. Surfaces the dropped-image fact on the import
  // preview so users know the recipe was extracted from caption alone.
  const [imageUsed, setImageUsed] = useState<boolean | undefined>(undefined);
  // Index of the ingredient row currently being edited via the
  // food-search modal (tap) or the override sheet (long-press). Null
  // when no sheet is open. Kept separate from `pendingRecipe` so
  // dismissing a sheet doesn't perturb the underlying recipe state.
  const [searchIngredientIdx, setSearchIngredientIdx] = useState<number | null>(null);
  const [overrideIngredientIdx, setOverrideIngredientIdx] = useState<number | null>(null);
  const [reviewServingsDraft, setReviewServingsDraft] = useState("1");
  const [servingsEditorOpen, setServingsEditorOpen] = useState(false);
  const [mealTags, setMealTags] = useState<string[]>([]);
  const [completedSteps, setCompletedSteps] = useState<ProgressStep[]>([]);
  /**
   * Caption-text path state (IG/TT/YouTube). When the iOS share sheet
   * supplies BOTH a URL and the post caption, we hold the caption here
   * so the user can review/edit it before the LLM extractor runs.
   * `captionPlatform` is the detected platform classification used to
   * label the preview header ("Import from Instagram"). When null, the
   * caption-text path is inactive and the legacy URL path runs.
   */
  const [captionDraft, setCaptionDraft] = useState<string>("");
  const [captionPlatform, setCaptionPlatform] = useState<
    "instagram" | "tiktok" | "youtube" | null
  >(null);
  const [captionUrl, setCaptionUrl] = useState<string>("");
  const [captionEditing, setCaptionEditing] = useState<boolean>(false);
  const base = apiBase();
  const runImportRef = useRef<(url: string) => Promise<void>>(async () => {});
  /** Same URL can be delivered via router + Linking + clipboard; avoid parallel duplicate imports. */
  const importInFlightRef = useRef<string | null>(null);

  // Profile targets for "How this fits your day"
  const [profileTargets, setProfileTargets] = useState({
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
  });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const d = data as any;
      const t = resolveTargets(
        { target_calories: d.target_calories, target_protein: d.target_protein, target_carbs: d.target_carbs, target_fat: d.target_fat, target_fiber_g: d.target_fiber_g },
        {
          weight_kg: d.weight_kg,
          height_cm: d.height_cm,
          sex: d.sex,
          activity_level: d.activity_level,
          goal: d.goal,
          dob: d.dob,
          age: d.age != null ? Number(d.age) : null,
          plan_pace: d.plan_pace,
        },
      );
      setProfileTargets({
        calories: t.calories,
        protein: t.protein,
        carbs: t.carbs,
        fat: t.fat,
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Fetch recent imported recipes
  const [recentImports, setRecentImports] = useState<{ name: string; source: string; time: string }[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("recipes")
        .select("title, source_name, created_at")
        .eq("author_id", userId)
        .not("source_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);
      if (cancelled || !data) return;
      const now = Date.now();
      setRecentImports(data.map((r: any) => {
        const diffDays = Math.floor((now - new Date(r.created_at).getTime()) / 86400000);
        const time = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
        const src = (r.source_name ?? "").toLowerCase();
        const source = src.includes("tiktok") ? "tiktok" : src.includes("instagram") ? "instagram" : src.includes("youtube") ? "youtube" : "web";
        return { name: r.title, source, time };
      }));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Animate progress steps during import
  useEffect(() => {
    if (state !== "importing") return;
    const timers = [
      setTimeout(() => setCompletedSteps(["ingredients"]), 400),
      setTimeout(() => setCompletedSteps(["ingredients", "nutrition"]), 1200),
      setTimeout(() => setCompletedSteps(["ingredients", "nutrition", "macros"]), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [state]);

  const runImport = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;

      if (!base) {
        setState("error");
        // Audit I07 (2026-05-05) — was a dev-jargon string ("Set
        // supprApiUrl in app config"). Surface a user-actionable
        // message instead; the dev-only diagnostic should be a log,
        // not toast copy.
        console.warn("[import-shared] API base URL not configured");
        setError(IMPORT_ERROR_COPY.import_failed);
        return;
      }

      if (!userId) {
        setState("error");
        setError(IMPORT_ERROR_COPY.client_signin_required_to_save);
        return;
      }

      setState("importing");
      setError(null);
      setSavedRecipeId(null);
      setCompletedSteps([]);

      try {
        const res = await authedFetch(`${base}/api/recipe-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          recipe?: ApiImportedRecipe;
          message?: string;
          imageUsed?: boolean;
        };

        if (!data.ok || !data.recipe) {
          setState("error");
          setError(userFacingImportError(data));
          return;
        }
        // Audit I05 (2026-05-05) — record the imageUsed signal so the
        // preview can flag silent text-only fallback to the user.
        setImageUsed(data.imageUsed);

        console.log("[import] API response - calories:", data.recipe.calories,
          "ingredientMacros:", data.recipe.ingredientMacros?.length,
          "first:", JSON.stringify(data.recipe.ingredientMacros?.[0])?.substring(0, 100));

        // Auto-classify meal type as default, let user edit
        const ingredients = Array.isArray(data.recipe.ingredients)
          ? data.recipe.ingredients.map(String)
          : [];
        const fromApi = data.recipe.mealType;
        const allowed = /^(breakfast|lunch|dinner|snack)$/;
        const fromApiNorm =
          Array.isArray(fromApi) && fromApi.every((x) => typeof x === "string")
            ? fromApi
                .map((x) => String(x).toLowerCase().trim())
                .filter((x) => allowed.test(x))
            : [];
        const autoTags =
          fromApiNorm.length > 0
            ? fromApiNorm
            : classifyMealType({
                title: data.recipe.title ?? "",
                ingredients,
                caloriesPerServing: data.recipe.calories ?? null,
              });
        setMealTags(autoTags);
        const normalized = normalizeApiImportedRecipe(data.recipe as Record<string, unknown>);
        setPendingRecipe(normalized);
        setTitle(
          decodeEntities((normalized.title ?? "Imported recipe").trim() || "Imported recipe"),
        );
        setState("review");
      } catch {
        setState("error");
        setError(IMPORT_ERROR_COPY.network_error);
      }
    },
    [base, userId],
  );

  /**
   * Caption-text import path (IG/TT/YouTube). Sends `{url, captionText}` to
   * `/api/recipe-import/caption`. Server enforces the `IG_TT_IMPORT_ENABLED`
   * flag; when OFF the route returns 404 and we fall back to the legacy
   * URL-based importer at `/api/recipe-import` so the user still gets some
   * result (caption-less, possibly degraded). Decision doc:
   * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
   */
  const runCaptionImport = useCallback(
    async (url: string, captionText: string) => {
      const trimmedUrl = url.trim();
      const trimmedCaption = captionText.trim();
      if (!trimmedUrl || !trimmedCaption) return;

      if (!base) {
        setState("error");
        console.warn("[import-shared] API base URL not configured");
        setError(IMPORT_ERROR_COPY.import_failed);
        return;
      }
      if (!userId) {
        setState("error");
        setError(IMPORT_ERROR_COPY.client_signin_required_to_save);
        return;
      }

      setState("importing");
      setError(null);
      setSavedRecipeId(null);
      setCompletedSteps([]);

      try {
        const res = await authedFetch(`${base}/api/recipe-import/caption`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl, captionText: trimmedCaption }),
        });

        // Feature-flag-off → 404. Fall back to URL importer (which today
        // hits the legacy IG/TT path; in the long term that path is
        // stripped, but for this PR it remains as the OFF fallback).
        if (res.status === 404) {
          await runImport(trimmedUrl);
          return;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          recipe?: ApiImportedRecipe;
          message?: string;
          sourcePlatform?: "instagram" | "tiktok" | "youtube";
        };

        if (!data.ok || !data.recipe) {
          setState("error");
          setError(data.message ?? "Could not extract a recipe from this caption.");
          return;
        }

        const ingredients = Array.isArray(data.recipe.ingredients)
          ? data.recipe.ingredients.map(String)
          : [];
        const fromApi = data.recipe.mealType;
        const allowed = /^(breakfast|lunch|dinner|snack)$/;
        const fromApiNorm =
          Array.isArray(fromApi) && fromApi.every((x) => typeof x === "string")
            ? fromApi
                .map((x) => String(x).toLowerCase().trim())
                .filter((x) => allowed.test(x))
            : [];
        const autoTags =
          fromApiNorm.length > 0
            ? fromApiNorm
            : classifyMealType({
                title: data.recipe.title ?? "",
                ingredients,
                caloriesPerServing: data.recipe.calories ?? null,
                caption: trimmedCaption,
              });
        setMealTags(autoTags);
        const normalized = normalizeApiImportedRecipe(data.recipe as Record<string, unknown>);
        setPendingRecipe(normalized);
        setTitle(
          decodeEntities((normalized.title ?? "Imported recipe").trim() || "Imported recipe"),
        );
        setState("review");
      } catch {
        setState("error");
        setError(IMPORT_ERROR_COPY.network_error);
      }
    },
    [base, userId, runImport],
  );

  const runImageImport = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert("Not available", "Image import requires a native build (not Expo Go).");
      return;
    }
    if (!base || !userId) {
      setState("error");
      setError(!base ? "API not configured." : "Sign in to import.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setState("importing");
    setError(null);
    setCompletedSteps([]);
    try {
      const asset = result.assets[0];
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);

      const res = await authedFetch(`${base}/api/recipe-import/image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json() as {
        ok?: boolean;
        title?: string | null;
        ingredients?: string[];
        steps?: string[];
        notes?: string | null;
        nutrition?: { perServing?: any } | null;
        error?: string;
        message?: string;
      };
      if (!data.ok || !data.ingredients?.length) {
        setState("error");
        setError(userFacingImportError(data));
        return;
      }

      const recipe: ApiImportedRecipe = {
        title: data.title ?? "Photo Import",
        ingredients: data.ingredients,
        instructions: data.steps?.length ? data.steps : undefined,
        servings: 1,
        calories: data.nutrition?.perServing?.calories ?? null,
        protein: data.nutrition?.perServing?.protein ?? null,
        carbs: data.nutrition?.perServing?.carbs ?? null,
        fat: data.nutrition?.perServing?.fat ?? null,
      };
      const captionHint = Array.isArray(data.steps) ? data.steps.map((s) => String(s)).join("\n") : "";
      const autoTags = classifyMealType({
        title: recipe.title ?? "",
        ingredients: data.ingredients,
        caloriesPerServing: recipe.calories,
        caption: captionHint.trim() ? captionHint : undefined,
      });
      setMealTags(autoTags);
      setPendingRecipe(recipe);
      setTitle(decodeEntities(recipe.title ?? "Photo Import"));
      setState("review");
    } catch {
      setState("error");
      setError(IMPORT_ERROR_COPY.network_error);
    }
  }, [base, userId]);

  useEffect(() => {
    if (!pendingRecipe || state !== "review") return;
    setReviewServingsDraft(String(pendingRecipe.servings ?? 1));
  }, [pendingRecipe, state]);

  /** Per-serving macros rescaled from recipe yield (`reviewServingsDraft`). */
  const previewNutrition = useMemo(() => {
    if (!pendingRecipe) return null;
    return nutritionRescale(pendingRecipe, reviewServingsDraft);
  }, [pendingRecipe, reviewServingsDraft]);

  /** Replace one ingredient's match with a food-search result (tap path). */
  const onIngredientSearchSelected = useCallback(
    (result: SelectedFood) => {
      const idx = searchIngredientIdx;
      if (idx == null) return;
      setPendingRecipe((prev) => {
        if (!prev || !Array.isArray(prev.ingredientMacros)) return prev;
        // 2026-05-06: per-serving-only FatSecret foods don't have a
        // per-100g basis. Compute scaled macros from `macrosPerServing
        // × quantity` directly when that's the case.
        const isPerServingOnly =
          result.macrosPer100g === null && Boolean(result.macrosPerServing);
        const ps = result.macrosPerServing;
        const q = result.quantity;
        const grams = isPerServingOnly ? 0 : result.chosenPortion.gramWeight * result.quantity;
        const scaled = isPerServingOnly && ps
          ? {
              calories: Math.round(ps.calories * q),
              protein: Math.round(ps.protein * q * 10) / 10,
              carbs: Math.round(ps.carbs * q * 10) / 10,
              fat: Math.round(ps.fat * q * 10) / 10,
              fiberG: 0,
              sugarG: 0,
              sodiumMg: 0,
            }
          : scaleMacros(result.macrosPer100g!, grams);
        const next = prev.ingredientMacros.map((row, i) =>
          i === idx
            ? {
                ...row,
                name: row.name, // preserve original raw line for reference
                amount: String(result.quantity),
                unit: result.chosenPortion.label,
                calories: scaled.calories,
                protein: scaled.protein,
                carbs: scaled.carbs,
                fat: scaled.fat,
                fiberG: scaled.fiberG,
                sugarG: scaled.sugarG,
                sodiumMg: scaled.sodiumMg,
                source: result.source,
              }
            : row,
        );
        return { ...prev, ingredientMacros: next };
      });
      setSearchIngredientIdx(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [searchIngredientIdx],
  );

  /** Directly overwrite one row's macros (long-press / override path). */
  const onIngredientOverrideSaved = useCallback(
    (override: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }) => {
      const idx = overrideIngredientIdx;
      if (idx == null) return;
      setPendingRecipe((prev) => {
        if (!prev || !Array.isArray(prev.ingredientMacros)) return prev;
        const next = prev.ingredientMacros.map((row, i) =>
          i === idx
            ? {
                ...row,
                calories: Math.round(override.calories),
                protein: Math.round(override.protein * 10) / 10,
                carbs: Math.round(override.carbs * 10) / 10,
                fat: Math.round(override.fat * 10) / 10,
                ...(override.fiber != null
                  ? { fiberG: Math.round(override.fiber * 10) / 10 }
                  : {}),
                source: "Override",
              }
            : row,
        );
        return { ...prev, ingredientMacros: next };
      });
      setOverrideIngredientIdx(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [overrideIngredientIdx],
  );

  const confirmSave = useCallback(async () => {
    if (!pendingRecipe || !userId) return;
    setState("saving");
    const servingsParsed = Math.max(
      1,
      Math.min(99, Math.round(parseFloat(reviewServingsDraft.replace(",", ".")) || pendingRecipe.servings || 1)),
    );
    const recipeWithTags = { ...pendingRecipe, mealType: mealTags, servings: servingsParsed };
    const saved = await saveImportedRecipe(userId, recipeWithTags);
    if ("error" in saved) {
      setState("error");
      // Audit I01 (2026-05-05) — saveImportedRecipe now returns a
      // pre-mapped string from IMPORT_ERROR_COPY (PR 2). Defensively
      // re-sanitise via userFacingImportError to catch any future
      // path that bypasses the mapper.
      setError(userFacingImportError(saved.error));
      return;
    }
    setSavedRecipeId(saved.recipeId);
    setState("success");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingRecipe, userId, mealTags, reviewServingsDraft]);

  runImportRef.current = runImport;

  const runImportOnce = useCallback(async (url: string) => {
    if (importInFlightRef.current === url) return;
    importInFlightRef.current = url;
    try {
      await runImportRef.current(url);
    } finally {
      importInFlightRef.current = null;
    }
  }, []);

  const routerUrl = useMemo(
    () => urlFromRouterParams(params as Record<string, string | string[] | undefined>),
    [
      params.url,
      params.link,
      params.sharedUrl,
      (params as { shared_url?: string | string[] }).shared_url,
      params.u,
      params.text,
    ],
  );

  /**
   * Caption text passed alongside the URL via the iOS share sheet — we
   * read it directly so we don't accidentally pick it up as a URL via
   * `params.text` (which `urlFromRouterParams` already handles).
   */
  const routerCaptionText = useMemo(() => {
    const raw = (params as Record<string, string | string[] | undefined>).captionText;
    if (raw == null) return "";
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === "string" ? v : "";
  }, [(params as { captionText?: string | string[] }).captionText]);

  /** Keep pasted/deep link visible before sign-in so the URL survives the login flow mentally. */
  useEffect(() => {
    if (routerUrl) setManualUrl(routerUrl);
  }, [routerUrl]);

  /** Router / navigation params (e.g. ?url= after ForwardSocialSharesToImport or share extension). */
  useEffect(() => {
    if (authLoading || !userId) return;
    if (!routerUrl) return;
    let cancelled = false;
    (async () => {
      setManualUrl(routerUrl);
      // Caption-text path: when the share sheet provided caption text and the
      // URL is IG/TT/YouTube, show the preview instead of running the
      // legacy URL importer. The user can edit + confirm; on confirm we POST
      // to /api/recipe-import/caption (gated by IG_TT_IMPORT_ENABLED).
      const platform = detectSourcePlatform(routerUrl);
      const captionTrimmed = routerCaptionText.trim();
      if (captionTrimmed && isCaptionTextPlatform(platform)) {
        // `platform` is now narrowed to "instagram" | "tiktok" | "youtube"
        // by `isCaptionTextPlatform`'s type guard.
        setCaptionUrl(routerUrl);
        setCaptionDraft(captionTrimmed);
        setCaptionPlatform(platform);
        setCaptionEditing(false);
        setState("captionPreview");
        return;
      }
      if (!cancelled) await runImportOnce(routerUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, routerUrl, routerCaptionText, runImportOnce]);

  /**
   * No ?url= yet: read suppr:// initial link, then clipboard (delayed retries for iOS pasteboard).
   * https:// social opens are forwarded from root layout with params — avoids double import.
   */
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setState("idle");
      return;
    }
    if (routerUrl) return;

    let cancelled = false;
    setState("checking");

    const readClipboard = async () => {
      const t = await safeGetClipboardString();
      return t ? extractUrlFromShareText(t) : null;
    };

    const tick = async () => {
      const initialHref = await Linking.getInitialURL();
      if (cancelled) return;

      let url = urlFromDeepLink(initialHref);
      if (!url) url = await readClipboard();
      if (!url && !cancelled) {
        await new Promise((r) => setTimeout(r, 450));
        if (!cancelled) url = await readClipboard();
      }
      if (!url && !cancelled) {
        await new Promise((r) => setTimeout(r, 600));
        if (!cancelled) url = await readClipboard();
      }

      if (cancelled) return;
      if (url) {
        setManualUrl(url);
        await runImportOnce(url);
        return;
      }
      setState("idle");
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, routerUrl, runImportOnce]);

  /** Warm app: custom scheme only (https shares are handled in root layout). */
  useEffect(() => {
    if (authLoading || !userId) return;
    const sub = Linking.addEventListener("url", ({ url: href }) => {
      if (!/^suppr:/i.test(href)) return;
      const u = urlFromDeepLink(href);
      if (u) {
        setManualUrl(u);
        void runImportOnce(u);
      }
    });
    return () => sub.remove();
  }, [authLoading, userId, runImportOnce]);

  const onManualImport = () => {
    const url = extractUrlFromShareText(manualUrl.trim());
    if (!url) {
      setError(IMPORT_ERROR_COPY.client_url_required);
      setState("error");
      return;
    }
    void runImport(url);
  };

  const onPasteFromClipboard = async () => {
    const t = await safeGetClipboardString();
    if (!t) {
      // Audit I07 (2026-05-05) — was a multi-line dev-jargon string
      // ("Run a fresh native build (expo run:ios / run:android)").
      // Surface a calm user-facing message; the dev hint stays in the log.
      console.warn("[import-shared] safeClipboard returned empty (Expo Go or unsupported build)");
      setError(IMPORT_ERROR_COPY.client_clipboard_empty);
      setState("error");
      return;
    }
    const url = extractUrlFromShareText(t);
    if (url) {
      setManualUrl(url);
      setError(null);
      setState("idle");
      void runImport(url);
      return;
    }
    setManualUrl(t.trim());
    setError(IMPORT_ERROR_COPY.client_unsupported_url);
    setState("error");
  };

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backHit: { paddingVertical: 6, paddingHorizontal: 6 },
    backText: { color: colors.text, fontSize: 17, fontWeight: "600" },
    topTitle: {
      color: Accent.primary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 3,
    },
    scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, paddingTop: Spacing.lg, gap: Spacing.lg },
    scrollCentered: { flexGrow: 1, justifyContent: "center", paddingTop: 0 },

    panelCard: {
      alignSelf: "stretch",
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xxxl,
      alignItems: "center",
      gap: Spacing.md,
    },
    // brandCircle / brandLetter removed (audit 2026-04-30) — replaced by
    // the canonical `<SupprMark>` component (was rendering a "P" letter
    // pre-rebrand). See `apps/mobile/components/SupprMark.tsx`.
    loaderGap: { marginVertical: Spacing.sm },
    panelTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    panelSub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    errorIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Accent.primary + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    errorBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: Spacing.sm,
    },

    successSheet: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      backgroundColor: colors.card,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: Accent.success + "35",
      paddingVertical: Spacing.xxxl,
      paddingHorizontal: Spacing.xxl,
      alignItems: "center",
      gap: Spacing.md,
      // subtle "sheet" depth
      shadowColor: Accent.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    },
    successIconWrap: {
      marginBottom: Spacing.xs,
    },
    successKicker: {
      fontSize: 11,
      fontWeight: "800",
      color: Accent.success,
      letterSpacing: 3,
      marginTop: Spacing.xs,
    },
    successRecipeTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      lineHeight: 28,
      paddingHorizontal: Spacing.sm,
    },
    libraryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Accent.success + "15",
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Accent.success + "35",
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    libraryChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: Accent.success,
    },

    input: {
      alignSelf: "stretch",
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 16,
    },
    primaryBtn: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      marginTop: Spacing.xs,
    },
    btnPressed: { opacity: 0.88 },
    primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    btnIconRight: { marginLeft: 2 },
    outlineBtn: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Accent.primary + "55",
      marginTop: Spacing.xs,
    },
    outlineBtnPressed: { backgroundColor: Accent.primary + "12" },
    outlineBtnText: { color: Accent.primary, fontWeight: "700", fontSize: 15 },

    textLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: Spacing.md,
    },
    textLinkLabel: { color: Accent.primary, fontWeight: "600", fontSize: 15 },

    // Import from grid
    importSourcesSection: {
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    importSourcesLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: Spacing.xs,
    },
    importSourcesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.md,
    },
    sourceButton: {
      // Audit 2026-04-29 papercut #7: Instagram / YouTube labels were
      // wrapping mid-word ("Instagr/am", "YouTu/be") because the
      // button was too narrow at horizontal padding 14 + icon 32 +
      // gap 8 (effective text width < label intrinsic width). Switch
      // to `flex: 1` with a `minWidth` so 4 buttons distribute evenly
      // across the row, drop horizontal padding from 14 to 8 to give
      // the label more breathing room. Combined with `numberOfLines:
      // 1` on the label, "Instagram" + "YouTube" fit cleanly.
      flex: 1,
      minWidth: 64,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 14,
      alignItems: "center",
      gap: Spacing.sm,
    },
    sourceButtonPressed: { opacity: 0.7 },
    sourceIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: Accent.primary + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    sourceLabel: {
      // Audit 2026-05-04 #35: at 13pt the "Instagram" label still
      // truncated to "Instagr…" on narrower iPhones (16 Pro at 390pt
      // gives ~80pt per button after grid gaps). Drop one step to
      // 12pt — tighter than ideal but unambiguous, and the icon
      // already carries the brand identity.
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },

    // Recent imports
    recentSection: {
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    recentLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    recentItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    recentBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    recentBadgeTT: { backgroundColor: "#000" },
    recentBadgeIG: { backgroundColor: "#E4405F" },
    recentBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },
    recentInfo: { flex: 1 },
    recentTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    recentTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    // Progress steps
    progressStepsContainer: {
      gap: Spacing.md,
      marginVertical: Spacing.lg,
    },
    progressStep: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    stepIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    stepIconPending: {
      backgroundColor: colors.border,
    },
    stepIconDone: {
      backgroundColor: Accent.success,
    },
    stepLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },

    // Macro impact card
    macroCardContainer: {
      backgroundColor: Accent.success + "18",
      borderRadius: Radius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    macroCardTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: Accent.success,
      letterSpacing: 2,
      marginBottom: Spacing.xs,
    },
    macroRow: {
      flexDirection: "row",
      justifyContent: "space-evenly",
    },
    macroItem: {
      alignItems: "center",
      gap: 1,
      minWidth: 60,
    },
    macroValue: {
      fontSize: 18,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    macroLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    macroTarget: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
    },

    // Ingredient count
    ingredientCountLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },

    // Editable ingredient list on the import preview (pre-save).
    // Rows are tap-to-search / long-press-to-override, so they need to
    // read as interactive — not just as a static list.
    importIngList: {
      alignSelf: "stretch",
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
      gap: 8,
    },
    importIngHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    importIngHeaderTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: 0.3,
    },
    importIngHeaderHint: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    importIngRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
    },
    importIngRowNeedsReview: {
      borderColor: Accent.warning,
      backgroundColor: Accent.warning + "10",
    },
    importIngRowPressed: {
      opacity: 0.75,
    },
    importIngName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    importIngDetail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
  }), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backHit}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>IMPORT</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          state === "success" && title && savedRecipeId ? styles.scrollCentered : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {(authLoading || state === "checking") && (
          <View style={styles.panelCard}>
            <SupprMark size={56} />
            <ActivityIndicator size="large" color={Accent.primary} style={styles.loaderGap} />
            <Text style={styles.panelTitle}>Looking for a link…</Text>
            <Text style={styles.panelSub}>
              {`Instagram, TikTok, or any recipe page — we'll save it to your library.`}
            </Text>
          </View>
        )}

        {state === "importing" && (
          <View style={styles.panelCard}>
            <Text style={[styles.panelTitle, { fontSize: 15, marginBottom: Spacing.xs }]}>
              Extracting recipe…
            </Text>
            <Text style={[styles.panelSub, { marginBottom: Spacing.lg }]}>
              Parsing ingredients and calculating macros
            </Text>

            <View style={styles.progressStepsContainer}>
              {(["ingredients", "nutrition", "macros"] as ProgressStep[]).map((step, idx) => {
                const isDone = completedSteps.includes(step);
                const stepLabels: Record<ProgressStep, string> = {
                  ingredients: "Extracting ingredients",
                  nutrition: "Matching nutrition data",
                  macros: "Calculating macros",
                };
                return (
                  <View key={step} style={styles.progressStep}>
                    <View
                      style={[
                        styles.stepIcon,
                        isDone ? styles.stepIconDone : styles.stepIconPending,
                      ]}
                    >
                      {isDone && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.stepLabel}>{stepLabels[step]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {state === "captionPreview" && captionPlatform && (
          <View style={styles.panelCard}>
            <Ionicons
              name={
                captionPlatform === "tiktok"
                  ? "logo-tiktok"
                  : captionPlatform === "youtube"
                    ? "logo-youtube"
                    : "logo-instagram"
              }
              size={36}
              color={Accent.primary}
            />
            <Text style={styles.panelTitle}>
              Import from {captionPlatform === "tiktok"
                ? "TikTok"
                : captionPlatform === "youtube"
                  ? "YouTube"
                  : "Instagram"}
            </Text>
            <Text style={styles.panelSub}>
              We never fetch the post itself &mdash; this is the caption text
              you shared. Check it looks right, then import.
            </Text>

            {!captionEditing ? (
              <ScrollView
                style={{
                  alignSelf: "stretch",
                  maxHeight: 240,
                  backgroundColor: colors.inputBg,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.md,
                }}
                showsVerticalScrollIndicator={true}
                accessibilityLabel="Shared caption text preview"
                testID="caption-preview-scroll"
              >
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                  {captionDraft}
                </Text>
              </ScrollView>
            ) : (
              <TextInput
                value={captionDraft}
                onChangeText={setCaptionDraft}
                multiline
                style={{
                  alignSelf: "stretch",
                  minHeight: 160,
                  maxHeight: 320,
                  backgroundColor: colors.inputBg,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.md,
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 20,
                  textAlignVertical: "top",
                }}
                placeholder="Paste the post caption here..."
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Edit caption text"
                testID="caption-preview-editor"
              />
            )}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => void runCaptionImport(captionUrl, captionDraft)}
              accessibilityLabel="Looks right, import"
              testID="caption-preview-confirm"
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Looks right? Import</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
              onPress={() => setCaptionEditing((v) => !v)}
              accessibilityLabel="Edit caption text"
              testID="caption-preview-edit-toggle"
            >
              <Text style={styles.outlineBtnText}>
                {captionEditing ? "Done editing" : "Edit caption"}
              </Text>
            </Pressable>
          </View>
        )}

        {(state === "review" || state === "saving") && pendingRecipe && (
          <View style={styles.panelCard}>
            <Ionicons name="restaurant-outline" size={36} color={Accent.primary} />
            <Text style={styles.panelTitle}>{decodeEntities(title ?? "Imported recipe")}</Text>
            {previewNutrition != null && pendingRecipe.calories != null && (
              <Text style={styles.panelSub}>
                {previewNutrition.calories} kcal · {previewNutrition.protein}g protein · recipe yields{" "}
                {previewNutrition.draft} serving{previewNutrition.draft !== 1 ? "s" : ""}
              </Text>
            )}

            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, marginTop: Spacing.md }}>
              SERVINGS (RECIPE YIELD)
            </Text>
            {!servingsEditorOpen ? (
              <Pressable
                onPress={() => setServingsEditorOpen(true)}
                style={{
                  alignSelf: "stretch",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.inputBg,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: 14,
                  marginBottom: Spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                    {previewNutrition?.draft ?? pendingRecipe.servings ?? 1} portions
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Per-serving macros scale when you change portions.
                  </Text>
                </View>
                <Ionicons name="create-outline" size={22} color={Accent.primary} />
              </Pressable>
            ) : (
              <View style={{ alignSelf: "stretch", marginBottom: Spacing.md, gap: Spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                  How many portions does the full recipe make? Values below rescale to stay consistent with the same
                  total dish.
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 12,
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                  keyboardType="number-pad"
                  value={reviewServingsDraft}
                  onChangeText={setReviewServingsDraft}
                  placeholder="e.g. 6"
                  placeholderTextColor={colors.textTertiary}
                />
                <Pressable
                  onPress={() => setServingsEditorOpen(false)}
                  style={{
                    alignSelf: "flex-start",
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary + "18",
                  }}
                >
                  <Text style={{ color: Accent.primary, fontWeight: "800", fontSize: 14 }}>Done</Text>
                </Pressable>
              </View>
            )}

            {/* Confidence banner (audit I04 + I05, 2026-05-05).
                Aggregates the two ways an import preview can leave
                the user with a draft they should review before saving:
                  * verifyIngredients failed or returned all-zero macros
                    (primarySource = Unverified) — banner says "estimates only"
                  * the OpenAI image step rejected the post image and
                    silently fell back to text-only (imageUsed === false)
                Tapping the banner does nothing — it's an inline
                advisory; users can still save and edit individual
                rows below. */}
            {(() => {
              const macros = Array.isArray(pendingRecipe.ingredientMacros) ? pendingRecipe.ingredientMacros : [];
              const aggregateUnverified =
                pendingRecipe.primarySource === "Unverified" ||
                pendingRecipe.primarySource === "Estimated" ||
                (macros.length > 0 && macros.every((m) => (m.calories ?? 0) === 0));
              const imageDropped = imageUsed === false;
              if (!aggregateUnverified && !imageDropped) return null;
              const headline = imageDropped
                ? "Image couldn't be analysed"
                : "Estimates only — review before saving";
              const body = imageDropped
                ? "The recipe was extracted from the caption alone. Macros are best-effort — review or replace before saving."
                : "We couldn't verify these ingredients against a nutrition database. Tap a row to swap matches, or long-press to edit macros manually.";
              return (
                <View
                  testID="import-preview-confidence-banner"
                  accessibilityRole="text"
                  style={{
                    marginTop: Spacing.md,
                    padding: Spacing.md,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.warning + "1A",
                    borderWidth: 1,
                    borderColor: Accent.warning + "55",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={20} color={Accent.warning} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, marginBottom: 2 }}>
                      {headline}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                      {body}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Macro breakdown */}
            {previewNutrition != null && pendingRecipe.calories != null && (
              <View style={styles.macroCardContainer}>
                <Text style={styles.macroCardTitle}>HOW THIS FITS YOUR DAY</Text>
                <View style={styles.macroRow}>
                  {[
                    { val: previewNutrition.calories, unit: "", label: "kcal", target: profileTargets.calories, color: MacroColors.calories },
                    { val: previewNutrition.protein, unit: "g", label: "protein", target: profileTargets.protein, color: MacroColors.protein },
                    { val: previewNutrition.carbs, unit: "g", label: "carbs", target: profileTargets.carbs, color: MacroColors.carbs },
                    { val: previewNutrition.fat, unit: "g", label: "fat", target: profileTargets.fat, color: MacroColors.fat },
                  ].map((m) => (
                    <View key={m.label} style={styles.macroItem}>
                      <Text style={[styles.macroValue, { color: m.color }]} numberOfLines={1}>
                        {m.val}{m.unit}
                      </Text>
                      <Text style={styles.macroLabel} numberOfLines={1}>
                        {m.label}
                      </Text>
                      <Text style={styles.macroTarget} numberOfLines={1}>
                        of {m.target}{m.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Editable ingredient list — tap a row to search for a
                different match, long-press to override macros manually.
                Sheets are rendered at screen root (below) so they don't
                nest inside the card's ScrollView. */}
            {Array.isArray(pendingRecipe.ingredientMacros) && pendingRecipe.ingredientMacros.length > 0 ? (
              <View style={styles.importIngList}>
                <View style={styles.importIngHeader}>
                  <Text style={styles.importIngHeaderTitle}>
                    Ingredients ({pendingRecipe.ingredientMacros.length})
                  </Text>
                  <Text style={styles.importIngHeaderHint}>
                    Tap to change match · Long-press to edit macros
                  </Text>
                </View>
                {pendingRecipe.ingredientMacros.map((m, i) => {
                  const needsReview = !m.source || m.source === "Estimated" || m.source === "Unverified";
                  const displayName = decodeEntities((m.name ?? "").trim() || "Ingredient");
                  const amountStr =
                    m.amount && m.unit
                      ? `${m.amount} × ${m.unit}`
                      : m.amount ?? "";
                  return (
                    <Pressable
                      key={`imping-${i}-${displayName}`}
                      onPress={() => setSearchIngredientIdx(i)}
                      onLongPress={() => setOverrideIngredientIdx(i)}
                      delayLongPress={300}
                      style={({ pressed }) => [
                        styles.importIngRow,
                        needsReview && styles.importIngRowNeedsReview,
                        pressed && styles.importIngRowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit match for ${displayName}`}
                      accessibilityHint="Tap to search a different food. Long-press to edit macros manually."
                    >
                      {needsReview && (
                        <Ionicons
                          name="alert-circle"
                          size={18}
                          color={Accent.warning}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.importIngName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={styles.importIngDetail} numberOfLines={1}>
                          {amountStr ? `${amountStr} · ` : ""}
                          {Math.round(m.calories ?? 0)} kcal
                          {m.source ? ` · ${m.source}` : ""}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : Array.isArray(pendingRecipe.ingredients) ? (
              <Text style={styles.ingredientCountLabel}>
                Parsed ingredients ({pendingRecipe.ingredients.length})
              </Text>
            ) : null}

            <MealTypePicker
              selected={mealTags}
              onChange={setMealTags}
              label="MEAL TYPE"
            />

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, state === "saving" && { opacity: 0.6 }]}
              onPress={confirmSave}
              disabled={state === "saving"}
            >
              {state === "saving" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="bookmark" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Save to Library</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {state === "success" && title && savedRecipeId && (
          <View style={styles.successSheet}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={72} color={Accent.success} />
            </View>
            <Text style={styles.successKicker}>SAVED</Text>
            <Text style={styles.successRecipeTitle} numberOfLines={4}>
              {decodeEntities(title)}
            </Text>
            <View style={styles.libraryChip}>
              <Ionicons name="bookmark" size={18} color={Accent.primary} />
              <Text style={styles.libraryChipText}>In your library</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => router.replace(`/recipe/${savedRecipeId}`)}
            >
              <Text style={styles.primaryBtnText}>View recipe</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.btnIconRight} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
              onPress={() => router.replace(`/recipe/verify?id=${savedRecipeId}`)}
            >
              <Ionicons name="nutrition-outline" size={18} color={Accent.primary} style={{ marginRight: 6 }} />
              <Text style={styles.outlineBtnText}>Review ingredients</Text>
            </Pressable>
          </View>
        )}

        {!authLoading && !userId && state === "idle" && (
          <View style={styles.panelCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="person-outline" size={40} color={Accent.primary} />
            </View>
            <Text style={styles.panelTitle}>Sign in to import</Text>
            <Text style={styles.panelSub}>
              We save imports to your personal library. Your link is below — after signing in, open Import again or tap
              Import here.
            </Text>
            {manualUrl.trim() ? (
              <TextInput
                value={manualUrl}
                onChangeText={setManualUrl}
                placeholder="https://…"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : null}
            <Pressable style={styles.primaryBtn} onPress={() => router.replace("/login")}>
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </Pressable>
          </View>
        )}

        {state === "error" && (
          <View style={styles.panelCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="alert-circle" size={44} color={Accent.destructive} />
            </View>
            <Text style={styles.panelTitle}>{`Couldn't import`}</Text>
            <Text style={styles.errorBody}>{error ?? "Something went wrong."}</Text>
            <TextInput
              value={manualUrl}
              onChangeText={(t) => {
                setManualUrl(t);
                if (state === "error") setState("idle");
              }}
              placeholder="Paste recipe URL"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Pressable style={styles.primaryBtn} onPress={onManualImport}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.textLinkBtn} onPress={onPasteFromClipboard}>
              <Ionicons name="clipboard-outline" size={18} color={Accent.primary} />
              <Text style={styles.textLinkLabel}>Paste from clipboard</Text>
            </Pressable>
          </View>
        )}

        {!authLoading && userId && state === "idle" && (
          <>
            <View style={styles.panelCard}>
              <SupprMark size={56} />
              <Text style={styles.panelTitle}>Paste a recipe link</Text>
              <Text style={styles.panelSub}>
                From Instagram, TikTok, or any recipe site. If you just shared to Suppr, the link may already be on
                your clipboard — tap below.
              </Text>
              <TextInput
                value={manualUrl}
                onChangeText={setManualUrl}
                placeholder="https://…"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {/* Audit I08 (2026-05-05) — when the pasted URL is
                  Instagram / TikTok / YouTube, surface an inline hint
                  pointing the user at the share-sheet flow. The
                  legacy URL importer still works (server scrapes
                  og:title / og:description), but the share-sheet
                  caption flow respects the IG/TT legal posture in
                  docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md
                  by only feeding the LLM text the user actually shared.
                  Detection runs live on every keystroke via the derived
                  platform token. */}
              {(() => {
                const trimmed = manualUrl.trim();
                if (!trimmed) return null;
                const platform = detectSourcePlatform(trimmed);
                if (platform !== "instagram" && platform !== "tiktok" && platform !== "youtube") return null;
                const platformLabel =
                  platform === "instagram" ? "Instagram" : platform === "tiktok" ? "TikTok" : "YouTube";
                return (
                  <View
                    testID={`import-platform-hint-${platform}`}
                    style={{
                      marginTop: -Spacing.xs,
                      marginBottom: Spacing.xs,
                      padding: Spacing.sm,
                      borderRadius: Radius.sm,
                      backgroundColor: Accent.primary + "12",
                      borderWidth: 1,
                      borderColor: Accent.primary + "33",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Ionicons name="share-outline" size={16} color={Accent.primary} style={{ marginTop: 2 }} />
                    <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 }}>
                      {platformLabel} link detected. For best results, open the post in {platformLabel} and use the share sheet → Suppr — that captures the caption text directly.
                    </Text>
                  </View>
                );
              })()}
              <Pressable style={styles.primaryBtn} onPress={onManualImport}>
                <Text style={styles.primaryBtnText}>Import</Text>
              </Pressable>
              <Pressable style={styles.textLinkBtn} onPress={onPasteFromClipboard}>
                <Ionicons name="clipboard-outline" size={18} color={Accent.primary} />
                <Text style={styles.textLinkLabel}>Use clipboard</Text>
              </Pressable>
              {ImagePicker && (
                <Pressable style={styles.textLinkBtn} onPress={() => void runImageImport()}>
                  <Ionicons name="camera-outline" size={18} color={Accent.primary} />
                  <Text style={styles.textLinkLabel}>Import from photo</Text>
                </Pressable>
              )}
            </View>

            {/* Import from sources */}
            <View style={styles.importSourcesSection}>
              <Text style={styles.importSourcesLabel}>IMPORT FROM</Text>
              <View style={styles.importSourcesGrid}>
                {[
                  { icon: "logo-tiktok", label: "TikTok" },
                  { icon: "logo-instagram", label: "Instagram" },
                  { icon: "logo-youtube", label: "YouTube" },
                  { icon: "globe-outline", label: "Website" },
                ].map((source) => (
                  <Pressable
                    key={source.label}
                    style={({ pressed }) => [
                      styles.sourceButton,
                      pressed && styles.sourceButtonPressed,
                    ]}
                    onPress={() => {
                      // These trigger the paste/import flow
                      onPasteFromClipboard();
                    }}
                  >
                    <View style={styles.sourceIconBox}>
                      <Ionicons
                        name={source.icon as any}
                        size={24}
                        color={Accent.primary}
                      />
                    </View>
                    <Text style={styles.sourceLabel} numberOfLines={1}>
                      {source.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Recent imports */}
            {recentImports.length > 0 && <View style={styles.recentSection}>
              <Text style={styles.recentLabel}>RECENT IMPORTS</Text>
              {recentImports.map((item, idx) => (
                <View key={idx} style={styles.recentItem}>
                  <View
                    style={[
                      styles.recentBadge,
                      item.source === "tiktok"
                        ? styles.recentBadgeTT
                        : styles.recentBadgeIG,
                    ]}
                  >
                    <Text style={styles.recentBadgeText}>
                      {item.source === "tiktok" ? "TT" : item.source === "instagram" ? "IG" : item.source === "youtube" ? "YT" : "W"}
                    </Text>
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle}>{item.name}</Text>
                    <Text style={styles.recentTime}>{item.time}</Text>
                  </View>
                </View>
              ))}
            </View>}
          </>
        )}
      </ScrollView>

      {/* Food-search modal — opened when the user taps an ingredient
          row on the import preview to replace a bad automatic match
          (e.g. "blonde or white chocolate" matching wrong branch). */}
      <FoodSearchModal
        visible={searchIngredientIdx != null && Boolean(pendingRecipe?.ingredientMacros?.[searchIngredientIdx])}
        initialQuery={
          searchIngredientIdx != null
            ? parseIngredientForSearch(
                pendingRecipe?.ingredientMacros?.[searchIngredientIdx]?.name ?? "",
              ).searchTerm
            : ""
        }
        initialAmount={
          searchIngredientIdx != null
            ? Number(pendingRecipe?.ingredientMacros?.[searchIngredientIdx]?.amount ?? 0) || null
            : null
        }
        initialUnit={
          searchIngredientIdx != null
            ? pendingRecipe?.ingredientMacros?.[searchIngredientIdx]?.unit ?? null
            : null
        }
        originalDescription={
          searchIngredientIdx != null
            ? pendingRecipe?.ingredientMacros?.[searchIngredientIdx]?.name ?? null
            : null
        }
        supabase={supabase}
        userId={userId}
        onSelect={onIngredientSearchSelected}
        onClose={() => setSearchIngredientIdx(null)}
      />

      {/* Manual macro override sheet — long-press path. Lets users
          type exact label values when no DB match is close enough. */}
      <OverrideIngredientSheet
        visible={overrideIngredientIdx != null && Boolean(pendingRecipe?.ingredientMacros?.[overrideIngredientIdx])}
        onClose={() => setOverrideIngredientIdx(null)}
        ingredientName={
          overrideIngredientIdx != null
            ? pendingRecipe?.ingredientMacros?.[overrideIngredientIdx]?.name ?? ""
            : ""
        }
        currentMacros={
          overrideIngredientIdx != null && pendingRecipe?.ingredientMacros?.[overrideIngredientIdx]
            ? {
                calories: pendingRecipe.ingredientMacros[overrideIngredientIdx]!.calories ?? 0,
                protein: pendingRecipe.ingredientMacros[overrideIngredientIdx]!.protein ?? 0,
                carbs: pendingRecipe.ingredientMacros[overrideIngredientIdx]!.carbs ?? 0,
                fat: pendingRecipe.ingredientMacros[overrideIngredientIdx]!.fat ?? 0,
                fiber: pendingRecipe.ingredientMacros[overrideIngredientIdx]!.fiberG ?? 0,
              }
            : { calories: 0, protein: 0, carbs: 0, fat: 0 }
        }
        hasExistingOverride={false}
        onSave={onIngredientOverrideSaved}
        onReset={() => setOverrideIngredientIdx(null)}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}
