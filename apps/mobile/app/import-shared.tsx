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
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AlertCircle,
  Clipboard as ClipboardIcon,
  Camera as CameraIcon,
  Lock,
  Share2,
} from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Spacing, Radius, FontFamily, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useAuth } from "@/context/auth";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { decodeEntities } from "@/lib/decodeEntities";
import { resolveTargets } from "@/lib/calcTargets";
import { saveImportedRecipe, updateImportedRecipe, type ApiImportedRecipe, coercePositiveMinutes } from "@/lib/saveImportedRecipe";
import { classifyMealType } from "@/lib/classifyMealType";
import {
  IMPORT_ERROR_COPY,
  userFacingImportError,
} from "@suppr/shared/recipes/importErrorCopy";
import {
  fetchRecentImports,
  recentImportMonogram,
  type RecentImportItem,
} from "@suppr/shared/recipes/recentImports";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  buildRecipeShareCardMessage,
  creatorProfileUrl,
  formatRecipeCreatorCredit,
  formatRecipeShareMacroLine,
} from "@suppr/shared/share/buildRecipeShareCard";
import { webRecipeDeepLink } from "@suppr/shared/share/recipeDeepLink";
import { useImportQueue } from "@suppr/shared/recipes/useImportQueue";
import { ImportRunnerError } from "@suppr/shared/recipes/recipeImportScheduler";
import { importJobIdForUrl, importJobIdForImage } from "@suppr/shared/recipes/importProgressMachine";
import {
  mapImageImportResponseToRecipe,
  photoSeedTitle,
  BULK_PHOTO_IMPORT_MAX,
  type ImageImportApiResponse,
} from "@suppr/shared/recipes/photoImport";
import {
  IMPORT_SAVE_FIRST_FLAG,
  IMPORT_SAVE_FIRST_REVIEW_BANNER,
  IMPORT_SAVE_FIRST_TEST_ID,
  IMPORT_SAVE_FIRST_UPDATE_CTA,
} from "@suppr/shared/recipes/importSaveFirst";
import { ImportProgressDrawer } from "@/components/import/ImportProgressDrawer";
import MealTypePicker from "@/components/MealTypePicker";
import FoodSearchModal, { type SelectedFood } from "@/components/FoodSearchModal";
import OverrideIngredientSheet from "@/components/OverrideIngredientSheet";
import { ImportLoadingSkeleton } from "@/components/import/ImportLoadingSkeleton";
import { SupprMark } from "@/components/SupprMark";
import { SupprButton } from "@/components/ui/SupprButton";
import { scaleMacrosByGrams , parseIngredientForSearch, type BarcodeProduct } from "@/lib/verifyRecipe";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import {
  classifyImportSource,
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
  // Secondary accent (Frost flag → damson, else clay) for the import CTAs,
  // outline/text-link buttons, source/share callouts, and the various entry-
  // point glyphs (search, restaurant, clipboard, camera, person, bookmark).
  // Threaded into the memoised StyleSheet via the dep array below. Macros keep
  // `MacroColors`; success/warning/destructive states keep their own tokens.
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/discover");
  const params = useLocalSearchParams();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;

  // import-progress-v2 (2026-06-08) — staged-progress + queue import UX.
  // Flag-gated per CLAUDE.md; the legacy single-`importing`-state +
  // ImportLoadingSkeleton path stays live in the `else`. Resolved once at
  // mount (PostHog reads are imperative; the screen doesn't re-mount mid-import).
  const [importProgressV2] = useState(() => isFeatureEnabled("import-progress-v2"));
  const importQueue = useImportQueue("mobile", track);

  // recipe-import-redesign (ENG-997 import surface, 2026-06-09) — unboxes the
  // idle state into header + paste-field + trust-chip row + recent-imports
  // sections on the white page ground (design-system §3.2). Flag-gated per
  // CLAUDE.md; the legacy monolithic `panelCard` slab stays live in the `else`.
  // Resolved once at mount (PostHog reads are imperative; the screen doesn't
  // re-mount mid-flow).
  const [importRedesign] = useState(() => isFeatureEnabled("recipe-import-redesign"));

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
  // ENG-1159b — true when the post caption exceeded CAPTION_MAX (4000 chars)
  // and was truncated before LLM extraction.
  const [captionTruncated, setCaptionTruncated] = useState(false);
  // F-121 (TestFlight `AJK4VIZdlOwU_yQWVLn_9pc`, 2026-05-06): when the
  // server returns 429 with a `Retry-After` header, capture the absolute
  // timestamp at which retry becomes valid and disable the "Try again"
  // button until then. Stops the user-driven re-tap amplification of
  // OpenAI rate-limit exhaustion. `retryNow` is a derived tick (see
  // effect below) that re-renders the button label every second.
  const [retryAfterAt, setRetryAfterAt] = useState<number | null>(null);
  const [retryNow, setRetryNow] = useState<number>(() => Date.now());
  // Index of the ingredient row currently being edited via the
  // food-search modal (tap) or the override sheet (long-press). Null
  // when no sheet is open. Kept separate from `pendingRecipe` so
  // dismissing a sheet doesn't perturb the underlying recipe state.
  const [searchIngredientIdx, setSearchIngredientIdx] = useState<number | null>(null);
  // F-128 follow-up (Grace, 2026-05-07): barcode replace for the
  // imported-recipe preview. Same pattern as `recipe/verify.tsx` —
  // when the user pivots from search → barcode for a targeted row,
  // we hand off the index so the scan REPLACES the same row's match.
  const [barcodeIngredientIdx, setBarcodeIngredientIdx] = useState<number | null>(null);
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
  const [recentImports, setRecentImports] = useState<RecentImportItem[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const items = await fetchRecentImports(supabase, userId);
      if (!cancelled) setRecentImports(items);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // User tier for the photo-import Pro gate (gap #3, 2026-06-09). Photo OCR is
  // Pro-gated server-side (`/api/recipe-import/image` → 403 `pro_required` for
  // free), so we surface the gate BEFORE the tap: Free users get a Lock badge +
  // route to the paywall; Pro users get the picker. Hydrate synchronously from
  // the cached tier to avoid a gate flash for paid users (mirrors the planner
  // pattern, F-91), then reconcile against the live profile read.
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadCachedUserTier } = await import("@/lib/cachedUserTier");
      const cached = await loadCachedUserTier();
      if (!cancelled) setUserTier(cached);
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_tier")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const tier = (data?.user_tier as string | null) ?? null;
      const resolved: "free" | "base" | "pro" =
        tier === "free" || tier === "base" || tier === "pro" ? tier : "free";
      setUserTier(resolved);
      void import("@/lib/cachedUserTier").then(({ saveCachedUserTier }) =>
        saveCachedUserTier(resolved),
      );
    })();
    return () => { cancelled = true; };
  }, [userId]);
  const isFreeTier = userTier === "free";
  // ENG-735 — bulk photo import is the primary import path: when the queue UX
  // is on the picker is multi-select, so the affordance reads "Import from
  // photos" (plural). Flag-off keeps the single-photo "Import from photo".
  const photoImportLabel = importProgressV2 ? "Import from photos" : "Import from photo";

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

  // F-121: tick once a second while a Retry-After window is active so the
  // countdown re-renders. Cleared automatically when `retryAfterAt` is null.
  useEffect(() => {
    if (retryAfterAt == null) return;
    const t = setInterval(() => {
      const now = Date.now();
      setRetryNow(now);
      if (now >= retryAfterAt) {
        setRetryAfterAt(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfterAt]);
  const retrySecondsLeft =
    retryAfterAt != null ? Math.max(0, Math.ceil((retryAfterAt - retryNow) / 1000)) : 0;
  const retryDisabled = retrySecondsLeft > 0;

  /**
   * Apply a successful `/api/recipe-import` response into the review state
   * (meal-type classification, normalised recipe, title). Returns the parsed
   * payload so save-first (ENG-980) can persist before review edits land.
   */
  const applyImportedRecipeResult = useCallback(
    (
      recipe: ApiImportedRecipe,
      imageUsedFlag?: boolean,
      options?: { caption?: string; captionTruncated?: boolean },
    ): { normalized: ApiImportedRecipe; mealTags: string[]; title: string } => {
      setImageUsed(imageUsedFlag);
      setCaptionTruncated(Boolean(options?.captionTruncated));
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String) : [];
      const fromApi = recipe.mealType;
      const allowed = /^(breakfast|lunch|dinner|snack)$/;
      const fromApiNorm =
        Array.isArray(fromApi) && fromApi.every((x) => typeof x === "string")
          ? fromApi.map((x) => String(x).toLowerCase().trim()).filter((x) => allowed.test(x))
          : [];
      const autoTags =
        fromApiNorm.length > 0
          ? fromApiNorm
          : classifyMealType({
              title: recipe.title ?? "",
              ingredients,
              caloriesPerServing: recipe.calories ?? null,
              caption: options?.caption,
            });
      setMealTags(autoTags);
      const normalized = normalizeApiImportedRecipe(recipe as Record<string, unknown>);
      const decodedTitle = decodeEntities(
        (normalized.title ?? "Imported recipe").trim() || "Imported recipe",
      );
      setPendingRecipe(normalized);
      setTitle(decodedTitle);
      setState("review");
      return { normalized, mealTags: autoTags, title: decodedTitle };
    },
    [],
  );

  /** ENG-980 — optional save-first persistence immediately after parse. */
  const landImportedRecipeInReview = useCallback(
    async (
      recipe: ApiImportedRecipe,
      imageUsedFlag?: boolean,
      options?: { caption?: string; captionTruncated?: boolean },
    ) => {
      const { normalized, mealTags: tags, title: decodedTitle } = applyImportedRecipeResult(
        recipe,
        imageUsedFlag,
        options,
      );
      if (!isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG) || !userId) return;

      const saved = await saveImportedRecipe(userId, {
        ...normalized,
        title: decodedTitle,
        mealType: tags,
      });
      if ("recipeId" in saved) {
        setSavedRecipeId(saved.recipeId);
        track(AnalyticsEvents.recipe_import_saved_first, {
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
      }
    },
    [applyImportedRecipeResult, userId],
  );

  /**
   * Fetch + parse one URL import. Shared by the inline + queued paths.
   * Accepts an optional AbortSignal so the queue can cancel an in-flight
   * import. Throws `ImportRunnerError` (stable code) on failure so the queue
   * maps it to retry-eligible copy; resolves with the parsed recipe so the
   * caller decides how to surface it (inline → review; queued → drawer +
   * last-wins review).
   */
  const fetchImportedRecipe = useCallback(
    async (url: string, signal?: AbortSignal): Promise<{ recipe: ApiImportedRecipe; imageUsed?: boolean; captionTruncated?: boolean }> => {
      const res = await authedFetch(`${base}/api/recipe-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      });
      // F-121: read Retry-After before the body so a 429 can drive a countdown.
      const retryAfterHeader = res.headers.get("Retry-After");
      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: ApiImportedRecipe;
        message?: string;
        imageUsed?: boolean;
        captionTruncated?: boolean;
        error?: string;
      };
      if (!data.ok || !data.recipe) {
        if (res.status === 429 || data.error === "ai_rate_limited") {
          const sec = retryAfterHeader
            ? Math.max(1, Math.min(600, Number.parseInt(retryAfterHeader, 10) || 30))
            : 30;
          setRetryAfterAt(Date.now() + sec * 1000);
        }
        const code = (data.error as ImportRunnerError["code"] | undefined) ?? "no_recipe_extracted";
        throw new ImportRunnerError(code, data.message);
      }
      return { recipe: data.recipe, imageUsed: data.imageUsed, captionTruncated: data.captionTruncated };
    },
    [base],
  );

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

      // import-progress-v2 — enqueue into the shared scheduler so the import
      // runs with live per-stage progress + queue position in the persistent
      // drawer, and multiple shares can import concurrently. The screen stays
      // on `idle` (the drawer carries progress); the legacy inline
      // `importing` path below stays alive when the flag is OFF.
      if (importProgressV2) {
        setError(null);
        setSavedRecipeId(null);
        // Deterministic id so a duplicate concurrent share/clipboard/deep-link
        // of the SAME url is a scheduler no-op (mirrors the legacy
        // `importInFlightRef` dedupe).
        const id = importJobIdForUrl("url", trimmed);
        let seedTitle = "Recipe";
        try {
          seedTitle = new URL(trimmed).hostname.replace(/^www\./, "");
        } catch {
          /* keep default */
        }
        importQueue.enqueue({
          id,
          kind: "url",
          title: seedTitle,
          run: async (controls) => {
            controls.setStage("extracting");
            const { recipe, imageUsed: used, captionTruncated: truncated } = await fetchImportedRecipe(trimmed, controls.signal);
            if (controls.isCancelled()) throw new DOMException("Aborted", "AbortError");
            controls.setStage("organizing");
            controls.setTitle(recipe.title ?? seedTitle);
            // Last-wins: the most recent finished import populates the review
            // form; all imports remain listed in the drawer.
            await landImportedRecipeInReview(recipe, used, { captionTruncated: truncated });
            return { title: recipe.title ?? seedTitle };
          },
        });
        return;
      }

      setState("importing");
      setError(null);
      setSavedRecipeId(null);
      setCompletedSteps([]);

      try {
        const { recipe, imageUsed: used, captionTruncated: truncated } = await fetchImportedRecipe(trimmed);
        console.log("[import] API response - calories:", recipe.calories,
          "ingredientMacros:", recipe.ingredientMacros?.length,
          "first:", JSON.stringify(recipe.ingredientMacros?.[0])?.substring(0, 100));
        await landImportedRecipeInReview(recipe, used, { captionTruncated: truncated });
      } catch (e) {
        setState("error");
        if (e instanceof ImportRunnerError) {
          setError(IMPORT_ERROR_COPY[e.code]);
        } else {
          setError(IMPORT_ERROR_COPY.network_error);
        }
      }
    },
    [base, userId, importProgressV2, importQueue, fetchImportedRecipe, landImportedRecipeInReview],
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

        const normalized = normalizeApiImportedRecipe(data.recipe as Record<string, unknown>);
        await landImportedRecipeInReview(normalized, undefined, { caption: trimmedCaption });
      } catch {
        setState("error");
        setError(IMPORT_ERROR_COPY.network_error);
      }
    },
    [base, userId, runImport, landImportedRecipeInReview],
  );

  /**
   * Fetch + parse ONE photo through `/api/recipe-import/image`. Shared by the
   * legacy single-photo inline path and the bulk queued path (ENG-735).
   * Accepts an optional AbortSignal so the queue can cancel an in-flight photo;
   * throws `ImportRunnerError` (stable code) so the drawer maps it to
   * retry-eligible copy. Attribution from `manualUrl` is forwarded the same way
   * the single-photo path always has (ENG-748 #13).
   */
  const fetchImageImport = useCallback(
    async (
      asset: { uri: string; fileName?: string | null; mimeType?: string | null },
      signal?: AbortSignal,
    ): Promise<ApiImportedRecipe> => {
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);
      // F-156-recipe-wave (2026-05-10) / ENG-748 #13 (2026-05-27) — forward an
      // optional source for image-imported recipes so they carry attribution.
      // If the pasted text resolves to a real URL it's sent as `sourceUrl`
      // (linked); otherwise as `sourceName` so a creator note survives rather
      // than being silently dropped. Empty stays empty.
      const importSource = classifyImportSource(manualUrl);
      if (importSource.sourceUrl) form.append("sourceUrl", importSource.sourceUrl);
      if (importSource.sourceName) form.append("sourceName", importSource.sourceName);

      let res: Response;
      try {
        res = await authedFetch(`${base}/api/recipe-import/image`, {
          method: "POST",
          body: form,
          signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new ImportRunnerError("network_error");
      }
      const data = (await res.json()) as ImageImportApiResponse;
      if (!data.ok || !data.ingredients?.length) {
        const code = (data.error as ImportRunnerError["code"] | undefined) ?? "no_recipe_extracted";
        throw new ImportRunnerError(code, data.message);
      }
      return mapImageImportResponseToRecipe(data);
    },
    [base, manualUrl],
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

    // ENG-735 — bulk photo import is the primary import path. When the queue
    // UX is on, allow a multi-photo pick and enqueue ONE `image` job per photo
    // into the shared scheduler: each photo gets its own row in the drawer with
    // live progress / cancel / retry, photos import concurrently across the
    // scheduler's slots, and the most-recently-finished populates the review
    // form (last-wins, identical to the URL path). The legacy single-photo
    // inline path stays alive in the `else` (flag OFF) so nothing regresses.
    if (importProgressV2) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: false,
        allowsMultipleSelection: true,
        selectionLimit: BULK_PHOTO_IMPORT_MAX,
      });
      if (result.canceled || !result.assets?.length) return;

      setError(null);
      setSavedRecipeId(null);
      // Trim a too-large pick to the ceiling so a single multi-select can't
      // fan out an unbounded number of paid AI-vision calls. Calm notice only.
      const assets = result.assets.slice(0, BULK_PHOTO_IMPORT_MAX);
      if (result.assets.length > BULK_PHOTO_IMPORT_MAX) {
        Alert.alert(
          "Importing the first " + BULK_PHOTO_IMPORT_MAX,
          `You picked ${result.assets.length} photos — Sloe will import the first ${BULK_PHOTO_IMPORT_MAX}. Import the rest in another batch.`,
        );
      }
      const total = assets.length;
      assets.forEach((asset, i) => {
        importQueue.enqueue({
          id: importJobIdForImage(asset.assetId ?? asset.uri),
          kind: "image",
          title: photoSeedTitle(i + 1, total),
          run: async (controls) => {
            controls.setStage("extracting");
            const recipe = await fetchImageImport(asset, controls.signal);
            if (controls.isCancelled()) throw new DOMException("Aborted", "AbortError");
            controls.setStage("organizing");
            controls.setTitle(recipe.title ?? photoSeedTitle(i + 1, total));
            // Last-wins: the most recent finished photo populates the review
            // form; every photo remains listed in the drawer regardless.
            await landImportedRecipeInReview(recipe);
            return { title: recipe.title ?? photoSeedTitle(i + 1, total) };
          },
        });
      });
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
      const recipe = await fetchImageImport(result.assets[0]);
      await landImportedRecipeInReview(recipe);
    } catch (e) {
      setState("error");
      if (e instanceof ImportRunnerError) {
        setError(IMPORT_ERROR_COPY[e.code]);
      } else {
        setError(IMPORT_ERROR_COPY.network_error);
      }
    }
  }, [
    base,
    userId,
    importProgressV2,
    importQueue,
    fetchImageImport,
    landImportedRecipeInReview,
  ]);

  /**
   * Photo-import entry point (gap #3, 2026-06-09). Photo OCR is Pro-gated
   * server-side (403 `pro_required`). Surface the gate before the tap: Free
   * users route to the paywall; Pro users open the picker. Stops the
   * tap-then-fail-at-request-time dead end for free users.
   */
  const onPhotoImportPress = useCallback(() => {
    if (isFreeTier) {
      router.push("/paywall?from=import_photo" as any);
      return;
    }
    void runImageImport();
  }, [isFreeTier, router, runImageImport]);

  useEffect(() => {
    if (!pendingRecipe || state !== "review") return;
    setReviewServingsDraft(String(pendingRecipe.servings ?? 1));
  }, [pendingRecipe, state]);

  /** Per-serving macros rescaled from recipe yield (`reviewServingsDraft`). */
  const previewNutrition = useMemo(() => {
    if (!pendingRecipe) return null;
    return nutritionRescale(pendingRecipe, reviewServingsDraft);
  }, [pendingRecipe, reviewServingsDraft]);

  const appOrigin = useMemo(() => {
    const extra = Constants.expoConfig?.extra as Extra | undefined;
    return (extra?.supprApiUrl ?? "https://suppr-club.com").replace(/\/$/, "");
  }, []);

  const successShareCard = useMemo(() => {
    if (!isFeatureEnabled("recipe_share_card_v1") || !savedRecipeId || !pendingRecipe || !title) {
      return null;
    }
    const nutrition = nutritionRescale(pendingRecipe, reviewServingsDraft);
    const estimated =
      pendingRecipe.primarySource === "Unverified" ||
      pendingRecipe.primarySource === "Estimated" ||
      pendingRecipe.primarySource == null;
    const creditLine = formatRecipeCreatorCredit({ sourceName: pendingRecipe.sourceName });
    const macroLine = formatRecipeShareMacroLine({
      calories: nutrition.calories,
      protein: nutrition.protein,
      estimated,
    });
    return {
      macroLine,
      creditLine,
      profileUrl: creatorProfileUrl({ creatorId: null, appOrigin }),
      message: buildRecipeShareCardMessage({
        recipeId: savedRecipeId,
        title: decodeEntities(title),
        calories: nutrition.calories,
        protein: nutrition.protein,
        estimated,
        sourceName: pendingRecipe.sourceName,
        appOrigin,
      }),
    };
  }, [savedRecipeId, pendingRecipe, title, reviewServingsDraft, appOrigin]);

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
          : scaleMacrosByGrams(result.macrosPer100g!, grams);
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

  /** F-128 follow-up: barcode-scanned product replaces the targeted
   *  ingredient row's match. Mirrors `onIngredientSearchSelected` but
   *  uses the BarcodeProduct payload (per-100g already, no portion
   *  picker). 100 g default portion, OFF source, replace-not-append
   *  because the user opened the search/scan flow on a specific row. */
  const onIngredientBarcodeScanned = useCallback(
    (_barcode: string, product: BarcodeProduct) => {
      const idx = barcodeIngredientIdx;
      if (idx == null) return;
      const grams = product.servingSizeG ?? 100;
      const f = grams / 100;
      setPendingRecipe((prev) => {
        if (!prev || !Array.isArray(prev.ingredientMacros)) return prev;
        const next = prev.ingredientMacros.map((row, i) =>
          i === idx
            ? {
                ...row,
                name: row.name,
                amount: String(grams),
                unit: "g",
                calories: Math.round(product.calories * f),
                protein: Math.round(product.protein * f * 10) / 10,
                carbs: Math.round(product.carbs * f * 10) / 10,
                fat: Math.round(product.fat * f * 10) / 10,
                fiberG: Math.round(product.fiberG * f * 10) / 10,
                sugarG: 0,
                sodiumMg: 0,
                source: "OFF",
              }
            : row,
        );
        return { ...prev, ingredientMacros: next };
      });
      setBarcodeIngredientIdx(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [barcodeIngredientIdx],
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
    const recipeWithTags = {
      ...pendingRecipe,
      title: title ?? undefined,
      mealType: mealTags,
      servings: servingsParsed,
    };
    const saved = savedRecipeId
      ? await updateImportedRecipe(userId, savedRecipeId, recipeWithTags)
      : await saveImportedRecipe(userId, recipeWithTags);
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
  }, [pendingRecipe, userId, mealTags, reviewServingsDraft, savedRecipeId, title]);

  const handleShareSuccessCard = useCallback(async () => {
    if (!successShareCard?.message) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await Share.share({
        message: successShareCard.message,
        title: decodeEntities(title ?? "Recipe"),
        url: webRecipeDeepLink(savedRecipeId ?? "", appOrigin),
      });
      if (result.action !== Share.sharedAction) return;
      track(AnalyticsEvents.recipe_share_card_shared, {
        surface: "import_success",
        platform: "mobile",
        hasCreatorCredit: Boolean(successShareCard.creditLine),
      });
    } catch {
      /* user dismissed share sheet */
    }
  }, [successShareCard, title, savedRecipeId, appOrigin]);

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
    // Top-bar title = section-eyebrow token (design-system §2.2): Inter 11pt,
    // weight 600, +0.08em tracking, sage. The old 800/3px-tracking read as a
    // shouty label rather than the calm editorial eyebrow used elsewhere.
    topTitle: {
      ...Type.label,
      color: colors.textSecondary,
    },
    scroll: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: 120,
      paddingTop: Spacing.lg,
      gap: Spacing.xxl,
    },
    scrollCentered: { flexGrow: 1, justifyContent: "center", paddingTop: 0 },

    // SLOE DS reskin (2026-06-07): the import panel is a cream `surface-card`
    // slab at the 24px Sloe radius (Radius.xl * 2); the panel title moves to
    // the plum serif voice. Presentation only — the paste / parse / save logic
    // is unchanged.
    panelCard: {
      alignSelf: "stretch",
      backgroundColor: colors.card,
      borderRadius: Radius.xl * 2,
      borderWidth: 1,
      borderColor: colors.border,
      // gap #8 — was Spacing.xxxl (40), far looser than the system card
      // padding; the dead cream amplified the placeholder feel. Tightened to
      // Spacing.xl (24) — the max the audit allows for any retained slab.
      padding: Spacing.xl,
      alignItems: "center",
      gap: Spacing.md,
    },
    // brandCircle / brandLetter removed (audit 2026-04-30) — replaced by
    // the canonical `<SupprMark>` component (was rendering a "P" letter
    // pre-rebrand). See `apps/mobile/components/SupprMark.tsx`.
    loaderGap: { marginVertical: Spacing.sm },
    panelTitle: {
      fontFamily: FontFamily.serifSemibold,
      fontSize: 22,
      color: colors.navPrimary,
      textAlign: "center",
      letterSpacing: -0.3,
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
      backgroundColor: accent.primary + "18",
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
    // L4 import error — recipe-import-redesign unboxed editorial (import.md §3.10).
    errorRedesignSection: {
      alignSelf: "stretch",
      gap: Spacing.lg,
    },
    errorRedesignHeader: {
      alignItems: "center",
      gap: Spacing.sm,
    },
    errorRedesignTitle: {
      ...Type.headline,
      fontSize: 18,
      color: colors.text,
      textAlign: "center",
    },
    errorRedesignBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    errorRedesignAltHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },

    // SLOE DS (M6 import-success, frame 304:2): the success surface is a
    // cream `surface-card` slab with the 24px Sloe radius and a soft
    // plum-tinted lift. Sage check + sage kicker keep the "saved / on
    // track" semantic; the recipe title moves to the plum serif voice.
    successSheet: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      backgroundColor: colors.card,
      borderRadius: Radius.xl * 2,
      borderWidth: 1,
      borderColor: Accent.success + "35",
      paddingVertical: Spacing.xxxl,
      paddingHorizontal: Spacing.xxl,
      alignItems: "center",
      gap: Spacing.md,
      // subtle "sheet" depth — Sloe ink (plum) penumbra, not a cheap drop.
      shadowColor: "#221B26",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
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
    // Plum serif recipe title — the Sloe display voice.
    successRecipeTitle: {
      fontFamily: FontFamily.serifSemibold,
      fontSize: 24,
      color: colors.navPrimary,
      textAlign: "center",
      lineHeight: 30,
      letterSpacing: -0.3,
      paddingHorizontal: Spacing.sm,
    },
    successMacroLine: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "center",
    },
    successCreditLine: {
      fontSize: 14,
      fontWeight: "600",
      color: accent.primary,
      textAlign: "center",
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

    // Paste-link field — cream fill, Radius.xl (12) per spec §3.2 (was the
    // orphan 16, off the sm4/md6/lg8/xl12/full scale). ~52px tall on the 4pt
    // grid (paddingVertical Spacing.md + 16pt text).
    input: {
      alignSelf: "stretch",
      backgroundColor: colors.inputBg,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    primaryBtn: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: accent.primary,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.md,
      marginTop: Spacing.xs,
    },
    btnPressed: { opacity: 0.88 },
    primaryBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16 },
    btnIconRight: { marginLeft: 2 },
    // Import CTA layout — Sloe button-system canon (2026-06-12): the import
    // action is the SOLID aubergine `SupprButton variant="primary"`. Only the
    // layout (full-bleed + top margin) lives here; fill / radius / label colour
    // come from the primitive.
    importBtnLayout: {
      alignSelf: "stretch",
      marginTop: Spacing.xs,
    },
    outlineBtn: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: accent.primary + "55",
      marginTop: Spacing.xs,
    },
    outlineBtnPressed: { backgroundColor: accent.primary + "12" },
    outlineBtnText: { color: accent.primary, fontWeight: "700", fontSize: 15 },

    textLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: Spacing.md,
    },
    textLinkLabel: { color: accent.primary, fontWeight: "600", fontSize: 15 },

    // Inline platform hint (gap #13) — calm advisory note, NOT a clay box.
    // Design-system §6.2 'recovery / note' variant: white-on-card fill +
    // 2pt sage left-border, Inter 12pt sage. Stops two clay elements (the old
    // tinted hint + the Import CTA below it) stacking.
    platformHint: {
      alignSelf: "stretch",
      marginTop: -Spacing.xs,
      marginBottom: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.card,
      borderLeftWidth: 2,
      borderLeftColor: Accent.success,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
    },
    platformHintText: {
      flex: 1,
      color: Accent.successSolid,
      fontSize: 12,
      lineHeight: 18,
    },

    // Section eyebrow (gap #5) — the design-system §2.2 section-eyebrow role:
    // Inter 11pt, weight 600, +0.08em tracking, uppercase, sage. Shared by
    // 'WORKS WITH' and 'RECENT IMPORTS' so all-caps labels read identically.
    sectionEyebrow: {
      ...Type.label,
      color: colors.textSecondary,
    },

    // ── recipe-import-redesign: unboxed idle (design-system §3.2) ──
    // The idle state renders header + paste-field + trust-chip row +
    // recent-imports as DISTINCT sections on the white page ground. No outer
    // panelCard slab. Sections are separated by Spacing.xxl via the scroll
    // container's `gap`.
    idleHeader: {
      gap: Spacing.sm,
    },
    idleTitle: {
      ...Type.title,
      color: colors.navPrimary,
    },
    idleSub: {
      ...Type.bodyMuted,
      color: colors.textSecondary,
    },
    idlePasteSection: {
      gap: Spacing.sm,
    },
    // Tertiary affordance rows below the field (clipboard / photo). Left-
    // aligned text-link rows, not boxed buttons.
    tertiaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    tertiaryLabel: {
      ...Type.body,
      color: accent.primary,
    },
    // Pro pill on the photo affordance (gap #3) — amber lock + "(Pro)" so the
    // gate is visible before the tap. Amber background tint keeps the amber
    // off white-text (accessibility: amber as fill, not text).
    proPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full, // tags census 2026-06-10
      backgroundColor: Accent.warning + "1F",
    },
    proPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: Accent.warningSolid,
    },

    // Trust-affordance row (gap #2 + #9) — non-tappable "WORKS WITH" chips:
    // small cream chips holding only the platform monogram. NOT buttons (the
    // old tinted-icon grid was a fake four-way router). Calm + honest.
    trustSection: {
      gap: Spacing.sm,
    },
    trustChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    trustChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      height: 24,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.lg,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    trustChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },

    // Recent imports
    recentSection: {
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
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
    // Neutral mono source badge (gap #10) — one calm treatment for all four
    // source types (TT/IG/YT/W) per spec §3.2: cream fill, ink text, hairline
    // border, 6px radius. Replaces the loud solid-black / IG-pink raw-brand
    // hexes that sat outside the palette.
    recentBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.md,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    recentBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.text,
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

    // Macro-check reassurance card (Figma 177:81) — the "how this fits your
    // day" sage slab. Sloe 24px radius keeps it consistent with the cream
    // panel it sits inside.
    macroCardContainer: {
      alignSelf: "stretch",
      backgroundColor: Accent.success + "18",
      borderRadius: Radius.xl * 2,
      borderWidth: 1,
      borderColor: Accent.success + "30",
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
  }), [colors, accent]);

  /**
   * Inline platform hint (audit I08, restyled gap #13). When the pasted URL is
   * IG/TT/YouTube, surface a calm sage note pointing the user at the share-sheet
   * caption flow (which respects the IG/TT legal posture in
   * docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md by only
   * feeding the LLM text the user actually shared). Detection runs live on
   * every keystroke via the derived platform token. Shared by the redesigned
   * + legacy idle paths so the hint stays identical across the flag.
   */
  const renderPlatformHint = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return null;
    const platform = detectSourcePlatform(trimmed);
    if (platform !== "instagram" && platform !== "tiktok" && platform !== "youtube") return null;
    const platformLabel =
      platform === "instagram" ? "Instagram" : platform === "tiktok" ? "TikTok" : "YouTube";
    return (
      <View testID={`import-platform-hint-${platform}`} style={styles.platformHint}>
        <Share2 size={16} color={Accent.success} style={{ marginTop: 1 }} />
        <Text style={styles.platformHintText}>
          {platformLabel} link detected. For best results, open the post in {platformLabel} and use the share sheet → Sloe — that captures the caption text directly.
        </Text>
      </View>
    );
  };

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
            <Text style={styles.panelTitle}>Looking for a link…</Text>
            <Text style={[styles.panelSub, { marginBottom: Spacing.lg }]}>
              {`Instagram, TikTok, or any recipe page — we'll save it to your library.`}
            </Text>
            <ImportLoadingSkeleton phase="checking" onCancel={goBack} />
          </View>
        )}

        {/* import-progress-v2 OFF → inline skeleton. ON → the persistent
            ImportProgressDrawer (mounted below the ScrollView) carries
            live per-stage progress + queue position instead. */}
        {state === "importing" && !importProgressV2 && (
          <View style={styles.panelCard}>
            <Text style={[styles.panelTitle, { fontSize: 15, marginBottom: Spacing.xs }]}>
              Extracting recipe…
            </Text>
            <Text style={[styles.panelSub, { marginBottom: Spacing.lg }]}>
              Parsing ingredients and calculating macros
            </Text>
            <ImportLoadingSkeleton
              phase="importing"
              completedSteps={completedSteps}
              onCancel={goBack}
            />
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
              color={accent.primary}
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
              <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
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
            {savedRecipeId && isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG) ? (
              <View
                testID={IMPORT_SAVE_FIRST_TEST_ID}
                style={{
                  alignSelf: "stretch",
                  backgroundColor: `${Accent.success}14`,
                  borderColor: `${Accent.success}4D`,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  marginBottom: Spacing.md,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                }}
                accessibilityRole="text"
                accessibilityLabel={IMPORT_SAVE_FIRST_REVIEW_BANNER.a11yLabel}
              >
                <Text
                  style={{
                    color: Accent.successSolid,
                    fontFamily: FontFamily.sansMedium,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  {IMPORT_SAVE_FIRST_REVIEW_BANNER.label}
                </Text>
              </View>
            ) : null}
            <Ionicons name="restaurant-outline" size={36} color={accent.primary} />
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
                <Ionicons name="create-outline" size={22} color={accent.primary} />
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
                    backgroundColor: accent.primary + "18",
                  }}
                >
                  <Text style={{ color: accent.primary, fontWeight: "800", fontSize: 14 }}>Done</Text>
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
              const captionWasTruncated = captionTruncated;
              if (!aggregateUnverified && !imageDropped && !captionWasTruncated) return null;
              const headline = imageDropped
                ? "Image couldn't be analysed"
                : captionWasTruncated
                  ? "Long caption was shortened"
                  : "Estimates only — review before saving";
              const body = imageDropped
                ? "The recipe was extracted from the caption alone. Macros are best-effort — review or replace before saving."
                : captionWasTruncated
                  ? "Only the first part of this post was analysed. If the recipe continues below, add missing ingredients manually."
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
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="bookmark" size={18} color={colors.primaryForeground} />
                  <Text style={styles.primaryBtnText}>
                    {savedRecipeId && isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG)
                      ? IMPORT_SAVE_FIRST_UPDATE_CTA
                      : "Save to Library"}
                  </Text>
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
            {successShareCard?.macroLine ? (
              <Text style={styles.successMacroLine}>{successShareCard.macroLine}</Text>
            ) : null}
            {successShareCard?.creditLine ? (
              <Text style={styles.successCreditLine}>{successShareCard.creditLine}</Text>
            ) : null}
            <View style={styles.libraryChip}>
              <Ionicons name="bookmark" size={18} color={accent.primary} />
              <Text style={styles.libraryChipText}>In your library</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => router.replace(`/recipe/${savedRecipeId}`)}
            >
              <Text style={styles.primaryBtnText}>View recipe</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primaryForeground} style={styles.btnIconRight} />
            </Pressable>
            {successShareCard ? (
              <Pressable
                style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
                onPress={() => void handleShareSuccessCard()}
                accessibilityRole="button"
                accessibilityLabel="Share recipe card"
              >
                <Share2 size={18} color={accent.primary} style={{ marginRight: 6 }} />
                <Text style={styles.outlineBtnText}>Share card</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
              onPress={() => router.replace(`/recipe/verify?id=${savedRecipeId}`)}
            >
              <Ionicons name="nutrition-outline" size={18} color={accent.primary} style={{ marginRight: 6 }} />
              <Text style={styles.outlineBtnText}>Review ingredients</Text>
            </Pressable>
          </View>
        )}

        {!authLoading && !userId && state === "idle" && (
          <View style={styles.panelCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="person-outline" size={40} color={accent.primary} />
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
          importRedesign ? (
            <View style={styles.errorRedesignSection} accessibilityRole="alert">
              <View style={styles.errorRedesignHeader}>
                <AlertCircle size={40} color={Accent.warning} strokeWidth={1.75} />
                <Text style={styles.errorRedesignTitle}>Something went wrong</Text>
                <Text style={styles.errorRedesignBody}>
                  {error ?? "Something went wrong."}
                </Text>
              </View>
              <TextInput
                value={manualUrl}
                onChangeText={(t) => {
                  setManualUrl(t);
                  if (state === "error") setState("idle");
                }}
                placeholder="https://…"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <PressableScale
                haptic="confirm"
                style={[styles.primaryBtn, retryDisabled && { opacity: 0.5 }]}
                onPress={retryDisabled ? undefined : onManualImport}
                disabled={retryDisabled}
                accessibilityState={{ disabled: retryDisabled }}
              >
                <Text style={styles.primaryBtnText}>
                  {retryDisabled ? `Try again in ${retrySecondsLeft}s` : "Try again"}
                </Text>
              </PressableScale>
              <Text style={styles.errorRedesignAltHint}>Or paste a different link</Text>
              <PressableScale
                haptic="selection"
                style={styles.tertiaryRow}
                onPress={onPasteFromClipboard}
                accessibilityRole="button"
              >
                <ClipboardIcon size={18} color={accent.primary} />
                <Text style={styles.tertiaryLabel}>Use clipboard</Text>
              </PressableScale>
            </View>
          ) : (
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
              <Pressable
                style={[styles.primaryBtn, retryDisabled && { opacity: 0.5 }]}
                onPress={retryDisabled ? undefined : onManualImport}
                disabled={retryDisabled}
                accessibilityState={{ disabled: retryDisabled }}
              >
                <Text style={styles.primaryBtnText}>
                  {retryDisabled ? `Try again in ${retrySecondsLeft}s` : "Try again"}
                </Text>
              </Pressable>
              <Pressable style={styles.textLinkBtn} onPress={onPasteFromClipboard}>
                <ClipboardIcon size={18} color={accent.primary} />
                <Text style={styles.textLinkLabel}>Paste from clipboard</Text>
              </Pressable>
            </View>
          )
        )}

        {!authLoading && userId && state === "idle" && (
          importRedesign ? (
            /* ── recipe-import-redesign: unboxed editorial idle (§3.2) ──
               Header + paste field + tertiary affordances + 'WORKS WITH'
               trust-chip row + RECENT IMPORTS, each a distinct section on the
               white page ground (sections separated by the scroll `gap`,
               Spacing.xxl). No outer panelCard slab — that was the dominant
               reason the surface read as a placeholder modal (gap #1). */
            <>
              {/* Header — serif H1 + sub-copy. The 'IMPORT' eyebrow already
                  lives in the top bar, so the in-card wordmark is dropped on
                  this sub-screen (gap #11). */}
              <View style={styles.idleHeader}>
                <Text style={styles.idleTitle}>Import a recipe</Text>
                <Text style={styles.idleSub}>From any link, social post or website.</Text>
              </View>

              {/* Paste field + inline platform hint + Import + tertiary rows */}
              <View style={styles.idlePasteSection}>
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
                {renderPlatformHint()}
                <SupprButton
                  variant="primary"
                  style={styles.importBtnLayout}
                  onPress={onManualImport}
                  accessibilityLabel="Import recipe from link"
                  testID="import-shared-import"
                  label="Import"
                />

                {/* Tertiary affordances — left-aligned text-link rows below the
                    field (gap #1). Lucide glyphs for the abstract controls
                    (gap #6); brand monograms stay only on the trust chips. */}
                <PressableScale
                  haptic="selection"
                  style={styles.tertiaryRow}
                  onPress={onPasteFromClipboard}
                  accessibilityRole="button"
                >
                  <ClipboardIcon size={18} color={accent.primary} />
                  <Text style={styles.tertiaryLabel}>Use clipboard</Text>
                </PressableScale>
                {ImagePicker && (
                  <PressableScale
                    haptic="selection"
                    style={styles.tertiaryRow}
                    onPress={onPhotoImportPress}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFreeTier
                        ? `${photoImportLabel} (Pro)`
                        : photoImportLabel
                    }
                    testID="import-photo-affordance"
                  >
                    <CameraIcon size={18} color={accent.primary} />
                    <Text style={styles.tertiaryLabel}>{photoImportLabel}</Text>
                    {isFreeTier && (
                      <View style={styles.proPill}>
                        <Lock size={12} color={Accent.warningSolid} />
                        <Text style={styles.proPillText}>Pro</Text>
                      </View>
                    )}
                  </PressableScale>
                )}
              </View>

              {/* Trust-affordance row (gap #2 + #9) — non-tappable. Honest:
                  these are sources we work with, not four separate routes. */}
              <View style={styles.trustSection}>
                <Text style={styles.sectionEyebrow}>WORKS WITH</Text>
                <View style={styles.trustChipsRow}>
                  {[
                    { mono: "TT", label: "TikTok" },
                    { mono: "IG", label: "Instagram" },
                    { mono: "YT", label: "YouTube" },
                    { mono: "W", label: "Website" },
                  ].map((s) => (
                    <View key={s.label} style={styles.trustChip} accessibilityLabel={`Works with ${s.label}`}>
                      <Text style={styles.trustChipText}>{s.mono}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {recentImports.length > 0 && (
                <View style={styles.recentSection}>
                  <Text style={styles.sectionEyebrow}>RECENT IMPORTS</Text>
                  {recentImports.map((item, idx) => (
                    <View key={idx} style={styles.recentItem}>
                      <View style={styles.recentBadge}>
                        <Text style={styles.recentBadgeText}>
                          {recentImportMonogram(item.source)}
                        </Text>
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentTitle}>{item.name}</Text>
                        <Text style={styles.recentTime}>{item.time}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            /* Legacy boxed idle (flag OFF) — kept alive until
               recipe-import-redesign holds 100% for two weeks (CLAUDE.md). */
            <>
              <View style={styles.panelCard}>
                <SupprMark size={56} />
                <Text style={styles.panelTitle}>Paste a recipe link</Text>
                <Text style={styles.panelSub}>
                  From Instagram, TikTok, or any recipe site. If you just shared to Sloe, the link may already be on
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
                {renderPlatformHint()}
                <SupprButton
                  variant="primary"
                  style={styles.importBtnLayout}
                  onPress={onManualImport}
                  accessibilityLabel="Import recipe from link"
                  testID="import-shared-import-legacy"
                  label="Import"
                />
                <Pressable style={styles.textLinkBtn} onPress={onPasteFromClipboard}>
                  <Ionicons name="clipboard-outline" size={18} color={accent.primary} />
                  <Text style={styles.textLinkLabel}>Use clipboard</Text>
                </Pressable>
                {ImagePicker && (
                  <Pressable
                    style={styles.textLinkBtn}
                    onPress={onPhotoImportPress}
                    accessibilityLabel={
                      isFreeTier ? `${photoImportLabel} (Pro)` : photoImportLabel
                    }
                  >
                    <Ionicons name="camera-outline" size={18} color={accent.primary} />
                    <Text style={styles.textLinkLabel}>{photoImportLabel}</Text>
                    {isFreeTier && (
                      <View style={styles.proPill}>
                        <Lock size={12} color={Accent.warningSolid} />
                        <Text style={styles.proPillText}>Pro</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Works-with trust chips (legacy path now shares the calm,
                  non-tappable chip row + sage eyebrow — gap #2/#5/#9/#10). */}
              <View style={[styles.trustSection, { marginBottom: Spacing.lg }]}>
                <Text style={styles.sectionEyebrow}>WORKS WITH</Text>
                <View style={styles.trustChipsRow}>
                  {[
                    { mono: "TT", label: "TikTok" },
                    { mono: "IG", label: "Instagram" },
                    { mono: "YT", label: "YouTube" },
                    { mono: "W", label: "Website" },
                  ].map((s) => (
                    <View key={s.label} style={styles.trustChip} accessibilityLabel={`Works with ${s.label}`}>
                      <Text style={styles.trustChipText}>{s.mono}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Recent imports */}
              {recentImports.length > 0 && <View style={styles.recentSection}>
                <Text style={styles.sectionEyebrow}>RECENT IMPORTS</Text>
                {recentImports.map((item, idx) => (
                  <View key={idx} style={styles.recentItem}>
                    <View style={styles.recentBadge}>
                      <Text style={styles.recentBadgeText}>
                        {recentImportMonogram(item.source)}
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
          )
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
        // F-128 follow-up (Grace, 2026-05-07): pivot from search →
        // barcode for the SAME row. Hand off `searchIngredientIdx`
        // to `barcodeIngredientIdx` so the scan replaces the targeted
        // ingredient via the existing `onIngredientBarcodeScanned`.
        onScanBarcode={() => {
          if (searchIngredientIdx == null) return;
          const i = searchIngredientIdx;
          setSearchIngredientIdx(null);
          setBarcodeIngredientIdx(i);
        }}
      />

      <BarcodeScannerModal
        visible={barcodeIngredientIdx != null}
        onScan={onIngredientBarcodeScanned}
        onClose={() => setBarcodeIngredientIdx(null)}
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

      {/* import-progress-v2 — persistent, non-blocking queue drawer anchored
          above the footer. Renders nothing until there's import activity. */}
      {importProgressV2 ? (
        <ImportProgressDrawer
          queue={importQueue}
          onOpenRecipe={(id) => router.push(`/recipe/${id}`)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
