import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { SupprMark } from "./ui/suppr-mark";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { useSearchParams } from "next/navigation";
import { parseIngredientLine } from "../../lib/recipe-ingredients/parseIngredientLine.ts";
import { consumePendingImportText } from "../../lib/recipe-import/pendingImportText.ts";
import { resolveStructuredIngredient } from "../../lib/recipe-ingredients/structuredIngredientsForVerify.ts";
import { isStructuredSource } from "../../lib/nutrition/structuredSourceGate.ts";
import { matchedAliasKeyForRow } from "../../lib/recipe/matchedAliasPersist.ts";
import { estimateLineMacros, sumMacros } from "../../lib/nutrition/estimateIngredientMacros.ts";
import { effectiveFoodSearchQuery } from "../../lib/nutrition/foodSearchQuery.ts";
import { inferAllergensFromIngredients } from "../../lib/nutrition/inferAllergens.ts";
import {
  recipeAggregateHasFatSecret,
  scrubFatSecretMacros,
  ZEROED_RECIPE_AGGREGATE,
} from "../../lib/nutrition/fatsecretCacheGuard.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { uploadRecipeImage } from "../../lib/supabase/uploadRecipeImage.ts";
import { track, isFeatureEnabled } from "../../lib/analytics/track.ts";
import { useImportQueue } from "../../lib/recipes/useImportQueue.ts";
import { ImportRunnerError } from "../../lib/recipes/recipeImportScheduler.ts";
import { importJobIdForUrl, importJobIdForImage } from "../../lib/recipes/importProgressMachine.ts";
import { buildUrlImportJob, extractAllHttpUrls } from "../../lib/recipes/urlImportJob.ts";
import {
  mapImageImportResponseToRecipe,
  photoSeedTitle,
  BULK_PHOTO_IMPORT_MAX,
  type ImageImportApiResponse,
} from "../../lib/recipes/photoImport.ts";
import { RecipeImportQueueDrawer } from "./suppr/recipe-import-queue-drawer.tsx";
import { GoPublicDialog } from "./GoPublicDialog.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { normaliseInstructions } from "../../lib/recipes/normaliseInstructions.ts";
import { isRetiredStockImageUrl } from "../../lib/recipes/heroImageFallback.ts";
import { roundCalories, roundMacro } from "../../lib/recipes/createRecipeWizard.ts";
import { normaliseSource } from "../../lib/recipes/persistSourceAttribution.ts";
import { importQualityProps, type ImportQualityProps, type ImportQualityRecipe } from "../../lib/recipes/importQualitySignal.ts";
import { ImportReviewFlaggedNote } from "./import/ImportReviewFlaggedNote.tsx";
import { normalizeRecipeTitle } from "../../lib/recipes/normalizeRecipeTitle.ts";
import { parseRawIngredients } from "../../lib/recipe-ingredients/parseRawIngredients.ts";
import { splitPastedIngredientLines } from "../../lib/recipe-ingredients/splitPastedIngredientLines.ts";
import { verifyJsonNeedsReview } from "../../lib/nutrition/verifyRecipeResponse.ts";
import { persistVerifiedRecipeAggregate } from "../../lib/recipes/persistVerifiedRecipeAggregate.ts";
import { stripSectionPrefix } from "../../lib/recipe-import/socialUrlHelpers.ts";
import { ImportLoadingSkeleton } from "./suppr/import-loading-skeleton.tsx";
import { ImportSuccessSheet } from "./suppr/import-success-sheet.tsx";
import { ImportRecentImports } from "./suppr/import-recent-imports.tsx";
import { SupprButton } from "./suppr/suppr-button.tsx";
import {
  IMPORT_ERROR_COPY,
  coerceImportErrorCode,
  mapPersistenceError,
  userFacingImportError,
} from "../../lib/recipes/importErrorCopy.ts";
import {
  IMPORT_SAVE_FIRST_FLAG,
  IMPORT_SAVE_FIRST_REVIEW_BANNER,
  IMPORT_SAVE_FIRST_TEST_ID,
  IMPORT_SAVE_FIRST_UPDATE_CTA,
} from "../../lib/recipes/importSaveFirst.ts";
import {
  saveImportedRecipe as persistImportedRecipeDraft,
  type ApiImportedRecipe,
} from "../../lib/recipes/persistImportedRecipe.ts";
import { fetchRecentImports, type RecentImportItem } from "../../lib/recipes/recentImports.ts";
import {
  detectSourcePlatform,
  isCaptionTextPlatform,
  type CaptionTextPlatform,
} from "../../lib/recipes/resolveImportUrl.ts";
import { ImportCaptionPreviewCard } from "./import/ImportCaptionPreviewCard.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";

/**
 * ENG-1211 — method hint passed from an import method tile to the create view
 * so each tile DELIVERS its method instead of dropping the user on a generic
 * screen. `paste` → open the paste-ingredient-list dialog on arrival;
 * `scan` → open the barcode scanner on arrival. Mobile parity: `?autoPaste=1`
 * / `?autoBarcode=1` on `/create-recipe`.
 */
export type CreateMethodHint = "paste" | "scan";

interface RecipeUploadProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  /** Create = your original recipe (manual entry, your photos). Import = third-party / cookbook / URL / scan for your library only. */
  mode: "create" | "import";
  onSwitchToImport?: () => void;
  /**
   * Switch to the create view. ENG-1211: an optional method hint lets a method
   * tile (Paste text / Scan) ask the create view to auto-activate the matching
   * affordance on arrival rather than landing the user on a generic form.
   */
  onSwitchToCreate?: (method?: CreateMethodHint) => void;
  /**
   * ENG-1211: when the create view is opened from an import method tile, this
   * tells it which affordance to auto-open on mount (paste dialog / scanner).
   * Consumed once per mount via a ref-guard so a re-render can't re-fire it.
   */
  createInitialMethod?: CreateMethodHint;
}

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

type VerifiedLine = {
  input?: { name: string; amount: string; unit: string };
  resolved?: { name: string; amount: string; unit: string };
  fatSecretFoodId: string | null;
  matchedName: string | null;
  confidence: number;
  source?: "USDA" | "FatSecret" | "Unverified";
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  } | null;
  /** ENG-1299 — absolute micros panel at the row's scaled grams (optional). */
  micros?: Record<string, number>;
};

// ENG-1287: the old DEFAULT_COVER_IMAGE stock salad is retired — photo-less recipes persist image_url NULL.

type UsdaHit = { fdcId: number; description: string; dataType?: string; brandName?: string; score?: number };

function MacroWheel(props: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}) {
  const fallback = [{ name: "—", value: 1, color: "var(--macro-fat-soft)" }];
  const data = [
    { name: "Protein", value: Math.max(0, props.proteinG), color: "var(--macro-protein)" },
    { name: "Carbs", value: Math.max(0, props.carbsG), color: "var(--macro-carbs)" },
    { name: "Fat", value: Math.max(0, props.fatG), color: "var(--macro-fat)" },
  ].filter((d) => d.value > 0);
  const chartData = data.length ? data : fallback;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[92px] w-[92px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" innerRadius={30} outerRadius={42} stroke="transparent">
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-extrabold text-foreground leading-none">{Math.round(props.calories)}</div>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            kcal
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--macro-protein)]" />
            Protein
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.proteinG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--macro-carbs)]" />
            Carbs
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.carbsG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--macro-fat)]" />
            Fat
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.fatG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--macro-fiber)]" />
            Fiber
          </span>
          <span className="font-semibold tabular-nums">{Math.round((props.fiberG ?? 0) * 10) / 10}g</span>
        </div>
      </div>
    </div>
  );
}

function amountToNumeric(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const range = t.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const v = Number.parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

export function RecipeUpload({ userTier, onUpgrade, mode, onSwitchToImport, onSwitchToCreate, createInitialMethod }: RecipeUploadProps) {
  const router = useRouter();
  const { refreshDiscoverRecipes, ensureRecipeInLibraryWithKind, refreshMyLibraryRecipes, nutritionTargets, userId } = useAppData();
  const searchParams = useSearchParams();
  // import-progress-v2 (2026-06-08) — staged-progress + queue import UX.
  // Flag-gated per CLAUDE.md; the legacy inline-skeleton path stays live in
  // the `else`. Resolved once at mount (PostHog reads are imperative).
  const [importProgressV2] = useState(() => isFeatureEnabled("import-progress-v2"));
  // recipe-import-redesign (ENG-898 import surface) — gates the new L4 inline
  // amber error banner + the 3-method source tiles (Photo / Paste text / Scan).
  // MIRROR of the mobile flag at `apps/mobile/app/import-shared.tsx` (the same
  // flag name; NOT in REDESIGN_DEFAULT_ON, so OFF in production until ramped).
  // Flag-gated per CLAUDE.md; the legacy toast-on-error + small destructive
  // hint line stays live in the `else`. Resolved once at mount (PostHog reads
  // are imperative; the screen doesn't re-mount mid-flow).
  const [importRedesign] = useState(() => isFeatureEnabled("recipe-import-redesign"));
  const [importCaptionPreviewFlag] = useState(() =>
    isFeatureEnabled("import_caption_preview_v1"),
  );
  // ENG-1283 — import review honesty (flag-off = today's silent-success render).
  const [importReviewHonesty] = useState(() => isFeatureEnabled("import_review_flagged_ingredients_v1"));
  const importQueue = useImportQueue("web", track);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(1);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(30);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "1", name: "", amount: "", unit: "g" }
  ]);
  const [instructions, setInstructions] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [dietary, setDietary] = useState<string[]>([]);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [, setLoadingRecipe] = useState(false);
  const [importUrl, setImportUrl] = useState(() => (mode === "import" ? searchParams.get("importUrl") ?? "" : "")); // ENG-1225 #3: prefill from ?importUrl=
  const [importBusy, setImportBusy] = useState(false);
  // Captured at URL-import time so the upsert persists `recipes.source_url` +
  // `recipes.source_name`. F-5 fix (`AI-CNKcmy7y`, 2026-04-19): previously the
  // import path dropped both columns and the source card rendered as text.
  const [importedSourceUrl, setImportedSourceUrl] = useState<string | null>(null);
  const [importedSourceName, setImportedSourceName] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);
  /** Audit I05 — `false` when image step fell back to caption-only. */
  const [importImageUsed, setImportImageUsed] = useState<boolean | undefined>(undefined);
  /** ENG-1159b — true when caption exceeded CAPTION_MAX before extraction. */
  const [importCaptionTruncated, setImportCaptionTruncated] = useState(false);
  // ENG-1283 — macro quality shape retained at apply-time (the form drops
  // `ingredientMacros`) so the honest note derives from the analytics rows.
  const [importFlaggedRecipe, setImportFlaggedRecipe] = useState<ImportQualityRecipe | null>(null);
  /** ENG-980 — true when save-first already landed this import in Library. */
  const [importSaveFirstActive, setImportSaveFirstActive] = useState(false);
  /** ENG-901 M6 — import-success sheet after library save (web parity). */
  const [importSuccess, setImportSuccess] = useState<{
    recipeId: string;
    title: string;
    macroLine: string | null;
  } | null>(null);
  /** ENG-898 — recent URL imports (web parity with mobile import-shared). */
  const [recentImports, setRecentImports] = useState<RecentImportItem[]>([]);
  const [importCaptionPreviewOpen, setImportCaptionPreviewOpen] = useState(false);
  const [captionPreviewPlatform, setCaptionPreviewPlatform] =
    useState<CaptionTextPlatform | null>(null);
  const [captionPreviewUrl, setCaptionPreviewUrl] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [captionEditing, setCaptionEditing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedLines, setVerifiedLines] = useState<VerifiedLine[] | null>(null);
  const [verifiedTotals, setVerifiedTotals] = useState<{
    totals: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    perServing: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    avgConfidence: number;
    minConfidence: number;
    primarySource?: string;
    /** ENG-1299 — per-serving micros panel from the verify response. */
    microsPerServing?: Record<string, number>;
  } | null>(null);
  const [lineOverrides, setLineOverrides] = useState<
    Record<number, { kind: "USDA"; fdcId: number; description: string } | { kind: "OFF"; barcode: string; description: string }>
  >({});
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [matchPickerIdx, setMatchPickerIdx] = useState<number | null>(null);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchHits, setMatchHits] = useState<UsdaHit[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<{ name: string; calories: number; servingLabel: string } | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [attestOriginalWork, setAttestOriginalWork] = useState(false);
  const [loadedPublished, setLoadedPublished] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStopRef = useRef<(() => void) | null>(null);
  const photoMethodInputRef = useRef<HTMLInputElement | null>(null);
  const isFreeTier = userTier === "free";

  const verifiedMacroByKey = useMemo(() => {
    if (!verifiedLines) return null;
    const m = new Map<string, { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number }>();
    for (const v of verifiedLines) {
      if (!v.macros) continue;
      const key = `${v.resolved?.name ?? ""}||${v.resolved?.amount ?? ""}||${v.resolved?.unit ?? ""}`.toLowerCase();
      m.set(key, v.macros);
    }
    return m;
  }, [verifiedLines]);

  const reloadRecentImports = useCallback(async () => {
    if (!userId) {
      setRecentImports([]);
      return;
    }
    try {
      const items = await fetchRecentImports(supabase, userId);
      setRecentImports(items);
    } catch {
      setRecentImports([]);
    }
  }, [userId]);

  useEffect(() => {
    if (mode !== "import") return;
    void reloadRecentImports();
  }, [mode, reloadRecentImports]);

  const openMatchPicker = (idx: number, suggested: string) => {
    setMatchPickerIdx(idx);
    setMatchQuery(suggested);
    setMatchHits(null);
  };

  // Auto-search USDA when matchQuery changes (debounced 400ms)
  const matchSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (matchPickerIdx == null) return;
    const raw = matchQuery.trim();
    if (!raw || raw.length < 2) return;
    const q = effectiveFoodSearchQuery(raw);
    if (!q.trim() || q.length < 2) return;
    if (matchSearchTimerRef.current) clearTimeout(matchSearchTimerRef.current);
    matchSearchTimerRef.current = setTimeout(() => {
      void (async () => {
        setMatchLoading(true);
        try {
          const res = await fetch(`/api/usda/search?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { ok?: boolean; hits?: UsdaHit[]; message?: string };
          if (data.ok && data.hits) setMatchHits(data.hits);
        } finally {
          setMatchLoading(false);
        }
      })();
    }, 400);
    return () => { if (matchSearchTimerRef.current) clearTimeout(matchSearchTimerRef.current); };
  }, [matchQuery, matchPickerIdx]);

  const runUsdaSearch = async () => {
    const raw = matchQuery.trim();
    if (!raw) return;
    const q = effectiveFoodSearchQuery(raw);
    if (!q.trim()) return;
    setMatchLoading(true);
    try {
      const res = await fetch(`/api/usda/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { ok?: boolean; hits?: UsdaHit[]; message?: string };
      if (!data.ok || !data.hits) {
        toast.error(data.message ?? "USDA search failed");
        return;
      }
      setMatchHits(data.hits);
    } finally {
      setMatchLoading(false);
    }
  };

  const runBarcodeLookup = useCallback(async (code?: string) => {
    const c = (code ?? barcode).trim();
    if (!c) return;
    setBarcodeLoading(true);
    try {
      const res = await fetch(`/api/off/barcode?code=${encodeURIComponent(c)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        product?: { name: string; calories: number; servingLabel: string };
        message?: string;
      };
      if (!data.ok || !data.product) {
        toast.error(data.message ?? "Barcode not found");
        return;
      }
      setBarcodeResult(data.product);
    } finally {
      setBarcodeLoading(false);
    }
  }, [barcode]);

  const stopScanner = useCallback(() => {
    scanStopRef.current?.();
    scanStopRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError(null);
    stopScanner();
    const BarcodeDetectorCtor = (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector as
      | (new (opts: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<{ rawValue?: string }[]> })
      | undefined;
    if (!BarcodeDetectorCtor) {
      setScannerError("Barcode scanning isn't supported in this browser. Paste the barcode instead.");
      return;
    }
    const el = videoRef.current;
    if (!el) {
      setScannerError("Scanner not ready. Try again.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      el.srcObject = stream;
      await el.play();
    } catch (e) {
      setScannerError(e instanceof Error ? e.message : "Camera permission denied");
      if (stream) stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const detector = new BarcodeDetectorCtor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
    let stopped = false;
    let raf = 0;

    const loop = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(el);
        const raw = codes?.[0]?.rawValue?.replace(/\D/g, "") ?? "";
        if (raw.length >= 8) {
          setBarcode(raw);
          setScannerOpen(false);
          stopScanner();
          void runBarcodeLookup(raw);
          return;
        }
      } catch {
        // ignore transient detector errors
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    scanStopRef.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (el.srcObject) el.srcObject = null;
    };
  }, [runBarcodeLookup, stopScanner]);

  useEffect(() => () => stopScanner(), [stopScanner]);

  // ENG-1211 — opened from an import method tile (`createInitialMethod`),
  // auto-activate the promised affordance once on mount (ref-guarded so a
  // re-render can't re-fire). Mobile parity: `/create-recipe?autoPaste=1` /
  // `?autoBarcode=1`. paste → paste-ingredient-list dialog; scan → barcode
  // match picker on the first row (form seeds one) + camera scanner.
  const initialMethodFiredRef = useRef(false);
  useEffect(() => {
    if (initialMethodFiredRef.current) return;
    if (mode !== "create" || !createInitialMethod) return;
    initialMethodFiredRef.current = true;
    if (createInitialMethod === "paste") {
      // ENG-1245 #3 — prefill from the unified Import sheet (consumed once).
      const pending = consumePendingImportText();
      if (pending) setPasteDraft(pending);
      setPasteDialogOpen(true);
    } else if (createInitialMethod === "scan") {
      setMatchPickerIdx(0);
      setScannerOpen(true);
      // Defer to next tick so the <video> element the scanner attaches to has
      // mounted (the picker + scanner UI render conditionally on this state).
      setTimeout(() => void startScanner(), 0);
    }
  }, [mode, createInitialMethod, startScanner]);

  const resetForm = () => {
    setRecipeId(null);
    setAttestOriginalWork(false);
    setTitle("");
    setDescription("");
    setServings(1);
    setPrepTime(15);
    setCookTime(30);
    setIngredients([{ id: "1", name: "", amount: "", unit: "g" }]);
    setInstructions("");
    setMealType("lunch");
    setDietary([]);
    setCoverImageUrl("");
    setCoverImageFile(null);
    setImportUrl("");
    setImportHint(null);
    setImportSaveFirstActive(false);
    setImportedSourceUrl(null);
    setImportedSourceName(null);
    setVerifiedLines(null);
    setVerifiedTotals(null);
  };

  const applyImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setCoverImageFile(file);
    setCoverImageUrl(URL.createObjectURL(file));
    setImportHint("Cover image set from file — review title and ingredients before publish.");
  };

  const runOcrFromImage = async () => {
    setOcrBusy(true);
    try {
      let file: File | null = coverImageFile;
      if (!file) {
        const url = coverImageUrl;
        if (url.startsWith("blob:") || url.startsWith("data:")) {
          const blob = await fetch(url).then((r) => r.blob());
          file = new File([blob], "recipe.jpg", { type: blob.type || "image/jpeg" });
        }
      }
      if (!file) {
        toast.error("Choose or paste a recipe photo first (file or screenshot).");
        return;
      }
      const fd = new FormData();
      fd.append("image", file);
      // F-156-recipe-wave (2026-05-10) — forward an optional source for
      // image-imported recipes so they carry attribution. Reuses the
      // same `importUrl` field the URL-import branch already collects.
      //
      // ENG-748 #13 (2026-05-27) — previously we sent the raw pasted text
      // as `sourceUrl` unconditionally; the server's `normaliseSource`
      // then NULLed anything that didn't parse as a URL, and because we
      // never sent a `sourceName`, malformed pastes lost the creator's
      // attribution entirely with no feedback. Fix (mirrors mobile
      // import-shared.tsx): classify the pasted text via `normaliseSource`.
      // If it resolves to a valid URL, send it as `sourceUrl` (linked
      // attribution). If it's non-empty but doesn't parse, send it as
      // `sourceName` so the creator's note survives as a non-linked source
      // note rather than being silently dropped.
      const rawSource = importUrl.trim();
      if (rawSource) {
        const classified = normaliseSource({ url: rawSource });
        if (classified.source_url) {
          fd.append("sourceUrl", classified.source_url);
        } else {
          fd.append("sourceName", rawSource);
        }
      }
      const res = await fetch("/api/recipe-import/image", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok?: boolean;
        ingredients?: string[];
        steps?: string[];
        title?: string | null;
        message?: string;
        sourceUrl?: string | null;
        sourceName?: string | null;
        nutrition?: { perServing?: unknown } | null;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Could not extract text from this image.");
        return;
      }
      track(AnalyticsEvents.recipe_imported, { ingredientCount: data.ingredients?.length ?? 0, source: "image" as const });
      track(AnalyticsEvents.recipe_create_photo_extracted, {
        ingredientCount: data.ingredients?.length ?? 0,
        platform: "web",
        hasServerNutrition: Boolean(data.nutrition?.perServing),
      });
      if (data.title) setTitle(data.title);
      if (data.ingredients?.length) {
        setIngredients(
          data.ingredients.map((line, idx) => {
            const p = parseIngredientLine(line);
            const name = p.name.trim() || line.trim();
            return { id: `ocr-${idx}`, name, amount: p.amount, unit: p.unit };
          }),
        );
      }
      if (data.steps?.length) {
        setInstructions(data.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"));
      }
      // F-156-recipe-wave — persist sanitised source attribution from
      // the response. Empty values mean the user didn't supply a URL
      // (or it failed normalisation); we leave existing imported-state
      // untouched so a subsequent URL re-import doesn't lose the link.
      if (data.sourceUrl) setImportedSourceUrl(data.sourceUrl);
      if (data.sourceName) setImportedSourceName(data.sourceName);
      toast.success("Extracted text from image — review amounts and steps.");
    } finally {
      setOcrBusy(false);
    }
  };

  /**
   * ENG-735 — fetch + parse ONE photo through `/api/recipe-import/image`.
   * Shared shape with mobile via `mapImageImportResponseToRecipe`. Accepts an
   * AbortSignal so the queue can cancel an in-flight photo; throws
   * `ImportRunnerError` (stable code) so the drawer maps it to retry-eligible
   * copy. Source attribution is forwarded from the URL field the same way the
   * single-image OCR path does (ENG-748 #13).
   */
  const fetchPhotoImport = useCallback(
    async (file: File, signal?: AbortSignal): Promise<ApiImportedRecipe> => {
      const fd = new FormData();
      fd.append("image", file);
      const rawSource = importUrl.trim();
      if (rawSource) {
        const classified = normaliseSource({ url: rawSource });
        if (classified.source_url) fd.append("sourceUrl", classified.source_url);
        else fd.append("sourceName", rawSource);
      }
      let res: Response;
      try {
        res = await fetch("/api/recipe-import/image", { method: "POST", body: fd, signal });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new ImportRunnerError("network_error");
      }
      const data = (await res.json()) as ImageImportApiResponse;
      if (!res.ok || !data.ok || !data.ingredients?.length) {
        const code = coerceImportErrorCode(data.error, "no_recipe_extracted");
        throw new ImportRunnerError(code, data.message);
      }
      return mapImageImportResponseToRecipe(data);
    },
    [importUrl],
  );

  /** Shape returned by the URL importer + applied to the editor form. */
  type ImportedUrlRecipe = {
    title: string;
    description: string | null;
    ingredients: string[];
    instructions: string[];
    servings: number | null;
    prepTimeMin: number | null;
    cookTimeMin: number | null;
    imageUrl: string | null;
    sourceUrl?: string | null;
    sourceName?: string | null;
  };

  /**
   * Populate the editor form from a parsed imported recipe. Extracted so
   * BOTH the legacy inline import path and the new queued path
   * (`import-progress-v2`) apply the result identically — no drift between
   * "imported inline" and "imported via the queue then reviewed".
   */
  // GROW-61 `quality` — macro quality derived by the caller (holds the full recipe w/ ingredientMacros); the form shape has none. Carried onto `recipe_imported` to mirror mobile. Absent (OCR path) → props omitted.
  const applyImportedRecipeToForm = useCallback((r: ImportedUrlRecipe, sourceUrl: string, quality?: ImportQualityProps) => {
    setTitle(r.title);
    setDescription(r.description ?? "");
    if (r.servings && r.servings > 0) setServings(r.servings);
    if (r.prepTimeMin != null && r.prepTimeMin > 0) setPrepTime(r.prepTimeMin);
    if (r.cookTimeMin != null && r.cookTimeMin > 0) setCookTime(r.cookTimeMin);
    if (r.imageUrl) setCoverImageUrl(r.imageUrl);
    if (r.ingredients.length) {
      setIngredients(
        r.ingredients.map((line, idx) => {
          const p = parseIngredientLine(line);
          const name = p.name.trim() || line.trim();
          return { id: `imp-${idx}`, name, amount: p.amount, unit: p.unit };
        }),
      );
    }
    if (r.instructions.length) {
      setInstructions(r.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"));
    }
    // Persist URL + name at the write boundary via `normaliseSource` so the
    // imported-state values are cleaned before they reach `saveRecipe`.
    const attribution = normaliseSource({ url: r.sourceUrl ?? sourceUrl, name: r.sourceName ?? null });
    setImportedSourceUrl(attribution.source_url);
    setImportedSourceName(attribution.source_name);
    let importHost: string;
    try {
      importHost = new URL(sourceUrl).hostname;
    } catch {
      importHost = "invalid";
    }
    track(AnalyticsEvents.recipe_imported, { host: importHost, source: "url" as const, ...(quality ?? {}) });
  }, []);

  /** ENG-980 — persist parsed import to Library before the user finishes review. */
  const landImportedRecipeSaveFirst = useCallback(
    async (recipe: ApiImportedRecipe, sourceUrl: string): Promise<boolean> => {
      if (!isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG)) return false;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[RecipeUpload] save-first getSession failed:", sessionError.message);
        return false;
      }
      const uid = sessionData.session?.user.id ?? null;
      if (!uid) return false;

      const saved = await persistImportedRecipeDraft(supabase, uid, {
        ...recipe,
        sourceUrl: recipe.sourceUrl ?? sourceUrl,
      });
      if ("recipeId" in saved) {
        setRecipeId(saved.recipeId);
        setImportSaveFirstActive(true);
        void refreshMyLibraryRecipes();
        void reloadRecentImports();
        track(AnalyticsEvents.recipe_import_saved_first, { platform: "web" as const });
        return true;
      }
      return false;
    },
    [refreshMyLibraryRecipes, reloadRecentImports],
  );

  /**
   * Fetch + parse one URL import. Shared by inline + queued paths. Accepts an
   * optional AbortSignal so the queue can cancel an in-flight import. Throws
   * `ImportRunnerError` with a stable code on failure so the queue can map it
   * to retry-eligible copy via `importErrorCopy`.
   */
  const fetchImportedRecipe = useCallback(
    async (
      u: string,
      signal?: AbortSignal,
    ): Promise<{
      recipe: ApiImportedRecipe;
      imageUsed?: boolean;
      captionTruncated?: boolean;
    }> => {
      let res: Response;
      try {
        res = await fetch("/api/recipe-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u }),
          signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new ImportRunnerError("network_error");
      }
      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: ApiImportedRecipe;
        message?: string;
        error?: string;
        imageUsed?: boolean;
        captionTruncated?: boolean;
      };
      if (!data.ok || !data.recipe) {
        // Prefer the server's stable error code so retry-eligibility is honest.
        const code = coerceImportErrorCode(data.error, "no_recipe_extracted");
        throw new ImportRunnerError(code, data.message);
      }
      return {
        recipe: data.recipe,
        imageUsed: data.imageUsed,
        captionTruncated: data.captionTruncated,
      };
    },
    [],
  );

  const fetchCaptionImportedRecipe = useCallback(
    async (
      url: string,
      captionText: string,
      signal?: AbortSignal,
    ): Promise<{
      recipe: ApiImportedRecipe;
      imageUsed?: boolean;
      captionTruncated?: boolean;
    }> => {
      let res: Response;
      try {
        res = await fetch("/api/recipe-import/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, captionText }),
          signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new ImportRunnerError("network_error");
      }
      if (res.status === 404) {
        return fetchImportedRecipe(url, signal);
      }
      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: ApiImportedRecipe;
        message?: string;
        error?: string;
      };
      if (!data.ok || !data.recipe) {
        const code = coerceImportErrorCode(data.error, "no_recipe_extracted");
        throw new ImportRunnerError(code, data.message);
      }
      return { recipe: data.recipe, imageUsed: false, captionTruncated: false };
    },
    [fetchImportedRecipe],
  );

  const applyAndMaybeSaveFirst = useCallback(
    async (
      recipe: ApiImportedRecipe,
      sourceUrl: string,
      importFlags?: { imageUsed?: boolean; captionTruncated?: boolean },
    ): Promise<boolean> => {
      setImportImageUsed(importFlags?.imageUsed);
      setImportCaptionTruncated(Boolean(importFlags?.captionTruncated));
      // ENG-1283 — retain the macro quality rows for the honest under-count note.
      setImportFlaggedRecipe({
        calories: recipe.calories ?? null,
        ingredientMacros: Array.isArray(recipe.ingredientMacros)
          ? recipe.ingredientMacros.map((m) => ({ calories: m.calories, source: m.source }))
          : null,
      });
      const formRecipe: ImportedUrlRecipe = {
        title: recipe.title ?? "Imported recipe",
        description: recipe.description ?? null,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String) : [],
        instructions: Array.isArray(recipe.instructions)
          ? recipe.instructions.map(String)
          : typeof recipe.instructions === "string"
            ? [recipe.instructions]
            : [],
        servings: recipe.servings ?? null,
        prepTimeMin: recipe.prepTimeMin ?? null,
        cookTimeMin: recipe.cookTimeMin ?? null,
        imageUrl: recipe.imageUrl ?? null,
        sourceUrl: recipe.sourceUrl ?? sourceUrl,
        sourceName: recipe.sourceName ?? null,
      };
      applyImportedRecipeToForm(formRecipe, sourceUrl, importQualityProps(recipe));
      return landImportedRecipeSaveFirst(recipe, sourceUrl);
    },
    [applyImportedRecipeToForm, landImportedRecipeSaveFirst],
  );

  /**
   * ENG-735 — bulk photo import (the primary import path). Each selected photo
   * becomes ONE `image` job in the shared scheduler, so the user sees a
   * row-per-photo in the queue drawer with live progress / cancel / retry,
   * photos import concurrently across the scheduler's slots, and the
   * most-recently-finished populates the editor form for review (last-wins,
   * identical to the URL queue path). Only available when the queue UX is on
   * (`import-progress-v2`); the single-image "Extract from image" OCR path
   * stays the create-mode default.
   */
  const runBulkPhotoImport = useCallback(
    (files: FileList | File[]) => {
      const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (all.length === 0) {
        toast.error("Choose image files (JPEG, PNG, HEIC).");
        return;
      }
      const picked = all.slice(0, BULK_PHOTO_IMPORT_MAX);
      if (all.length > BULK_PHOTO_IMPORT_MAX) {
        toast.info(
          `Importing the first ${BULK_PHOTO_IMPORT_MAX} of ${all.length} photos — import the rest in another batch.`,
        );
      }
      const total = picked.length;
      picked.forEach((file, i) => {
        importQueue.enqueue({
          // Dedupe a double-enqueue of the same picked file (name+size handle).
          id: importJobIdForImage(`${file.name}:${file.size}:${file.lastModified}`),
          kind: "image",
          title: photoSeedTitle(i + 1, total),
          run: async (controls) => {
            controls.setStage("extracting");
            const recipe = await fetchPhotoImport(file, controls.signal);
            if (controls.isCancelled()) throw new DOMException("Aborted", "AbortError");
            controls.setStage("organizing");
            controls.setTitle(recipe.title ?? photoSeedTitle(i + 1, total));
            // Last-wins: the most recent finished photo populates the editor
            // form; every photo remains listed in the drawer regardless.
            await applyAndMaybeSaveFirst(recipe, recipe.sourceUrl ?? "");
            return { title: recipe.title ?? photoSeedTitle(i + 1, total) };
          },
        });
      });
    },
    [importQueue, fetchPhotoImport, applyAndMaybeSaveFirst],
  );

  const onPhotoMethodPress = useCallback(() => {
    if (isFreeTier) {
      onUpgrade?.();
      return;
    }
    photoMethodInputRef.current?.click();
  }, [isFreeTier, onUpgrade]);

  const onPhotoMethodFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      if (importProgressV2) {
        runBulkPhotoImport(fileList);
      } else {
        applyImageFile(fileList[0]!);
      }
      if (photoMethodInputRef.current) photoMethodInputRef.current.value = "";
    },
    [importProgressV2, runBulkPhotoImport],
  );

  // ENG-981 — enqueue ONE url job via shared `buildUrlImportJob` (same shape as mobile); the fan-out calls this per link.
  const enqueueUrlImport = useCallback(
    (u: string): boolean =>
      importQueue.enqueue(
        buildUrlImportJob<ApiImportedRecipe>(u, {
          fetchRecipe: fetchImportedRecipe,
          land: (recipe, imageUsed, opts) => applyAndMaybeSaveFirst(recipe, u, { imageUsed, captionTruncated: opts.captionTruncated }),
          titleOf: (r) => r.title ?? "Imported recipe",
        }),
      ),
    [importQueue, fetchImportedRecipe, applyAndMaybeSaveFirst],
  );

  const executeUrlImport = useCallback(
    async (u: string) => {
      if (importProgressV2) {
        if (enqueueUrlImport(u)) {
          setImportUrl("");
          setImportHint(null);
        }
        return;
      }

      setImportBusy(true);
      setImportHint(null);
      try {
        const { recipe, imageUsed, captionTruncated } = await fetchImportedRecipe(u);
        const savedFirst = await applyAndMaybeSaveFirst(recipe, u, {
          imageUsed,
          captionTruncated,
        });
        toast.success(
          savedFirst
            ? "Saved to your library — review amounts and nutrition below"
            : "Imported — review amounts and nutrition before publishing",
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = userFacingImportError(e);
        if (!importRedesign) {
          toast.error(msg);
        }
        setImportHint(msg);
      } finally {
        setImportBusy(false);
      }
    },
    [
      importProgressV2,
      enqueueUrlImport,
      fetchImportedRecipe,
      applyAndMaybeSaveFirst,
      importRedesign,
    ],
  );

  const runCaptionImportConfirmed = useCallback(async () => {
    const url = captionPreviewUrl.trim();
    const caption = captionDraft.trim();
    if (!url || !caption) return;

    setImportCaptionPreviewOpen(false);

    if (importProgressV2) {
      const id = importJobIdForUrl("url", `${url}#caption`);
      let seedTitle = "Recipe";
      try {
        seedTitle = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep default */
      }
      const enqueued = importQueue.enqueue({
        id,
        kind: "url",
        title: seedTitle,
        run: async (controls) => {
          controls.setStage("extracting");
          const { recipe, imageUsed, captionTruncated } = await fetchCaptionImportedRecipe(
            url,
            caption,
            controls.signal,
          );
          if (controls.isCancelled()) throw new DOMException("Aborted", "AbortError");
          controls.setStage("organizing");
          controls.setTitle(recipe.title ?? "Imported recipe");
          await applyAndMaybeSaveFirst(recipe, url, { imageUsed, captionTruncated });
          return { title: recipe.title ?? "Imported recipe" };
        },
      });
      if (enqueued) {
        setImportUrl("");
        setImportHint(null);
      }
      return;
    }

    setImportBusy(true);
    setImportHint(null);
    try {
      const { recipe, imageUsed, captionTruncated } = await fetchCaptionImportedRecipe(
        url,
        caption,
      );
      const savedFirst = await applyAndMaybeSaveFirst(recipe, url, {
        imageUsed,
        captionTruncated,
      });
      toast.success(
        savedFirst
          ? "Saved to your library — review amounts and nutrition below"
          : "Imported — review amounts and nutrition before publishing",
      );
      setImportUrl("");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = userFacingImportError(e);
      if (!importRedesign) {
        toast.error(msg);
      }
      setImportHint(msg);
    } finally {
      setImportBusy(false);
    }
  }, [
    captionPreviewUrl,
    captionDraft,
    importProgressV2,
    importQueue,
    fetchCaptionImportedRecipe,
    applyAndMaybeSaveFirst,
    importRedesign,
  ]);

  const runImportFromUrl = async () => {
    const raw = importUrl.trim();
    if (!raw) {
      toast.error("Paste a recipe URL first.");
      return;
    }
    // ENG-981 — a pasted blob can carry several links; >1 fans out (parity with
    // mobile). One link → single-URL path below unchanged (raw fallback kept).
    const urls = extractAllHttpUrls(importUrl);
    if (urls.length > 1 && importProgressV2) {
      if (urls.map(enqueueUrlImport).some(Boolean)) {
        setImportUrl("");
        setImportHint(null);
      }
      return;
    }
    const u = urls[0] ?? raw;
    if (importCaptionPreviewFlag) {
      const platform = detectSourcePlatform(u);
      if (isCaptionTextPlatform(platform)) {
        setCaptionPreviewUrl(u);
        setCaptionPreviewPlatform(platform);
        setCaptionDraft("");
        setCaptionEditing(true);
        setImportCaptionPreviewOpen(true);
        return;
      }
    }

    await executeUrlImport(u);
  };

  const dismissCaptionPreview = useCallback(() => {
    setImportCaptionPreviewOpen(false);
    setCaptionPreviewPlatform(null);
    setCaptionPreviewUrl("");
    setCaptionDraft("");
    setCaptionEditing(false);
  }, []);

  const loadRecipeForEdit = async (id: string) => {
    setLoadingRecipe(true);
    try {
      const { data: row, error: rErr } = await supabase
        .from("recipes")
        .select(
          "id, title, description, instructions, servings, prep_time_min, cook_time_min, meal_type, dietary, published, image_url",
        )
        .eq("id", id)
        .maybeSingle();
      if (rErr || !row) {
        // Audit I01 (2026-05-05) — Postgrest leak (table/RLS/JWT).
        console.error("[RecipeUpload] load recipe failed:", rErr?.message ?? "no row");
        toast.error(rErr ? IMPORT_ERROR_COPY[mapPersistenceError(rErr)] : "Could not load recipe.");
        return;
      }
      setRecipeId(row.id as string);
      setLoadedPublished(Boolean((row as { published?: boolean | null }).published));
      setTitle((row.title as string) ?? "");
      setDescription((row.description as string) ?? "");
      setInstructions((row.instructions as string) ?? "");
      setServings((row.servings as number) ?? 1);
      setPrepTime((row.prep_time_min as number) ?? 15);
      setCookTime((row.cook_time_min as number) ?? 30);
      const mt = row.meal_type;
      setMealType(Array.isArray(mt) ? (mt[0] as string) ?? "lunch" : (mt as string) ?? "lunch");
      const d = row.dietary;
      setDietary(Array.isArray(d) ? (d as string[]) : []);
      const img = (row.image_url as string | null)?.trim() ?? "";
      setCoverImageUrl(isRetiredStockImageUrl(img) ? "" : img);

      const { data: ings, error: iErr } = await supabase
        .from("recipe_ingredients")
        .select("id, name, amount, unit")
        .eq("recipe_id", id)
        .order("created_at", { ascending: true });
      if (iErr) {
        // Audit I01 (2026-05-05) — Postgrest leak.
        console.error("[RecipeUpload] load ingredients failed:", iErr.message);
        toast.error(IMPORT_ERROR_COPY[mapPersistenceError(iErr)]);
        return;
      }
      if (ings?.length) {
        setIngredients(
          ings.map((r, idx) => ({
            id: (r.id as string) ?? `ing-${idx}`,
            // F-34 defence-in-depth (TestFlight ANmFiVpOfYEN re-fired
            // 2026-04-25): strip "For [section]:" prefix on display so
            // legacy/poisoned imports stay legible in the editor.
            name: stripSectionPrefix((r.name as string) ?? ""),
            amount: r.amount != null ? String(r.amount) : "",
            unit: (r.unit as string) ?? "g",
          })),
        );
      } else {
        setIngredients([{ id: "1", name: "", amount: "", unit: "g" }]);
      }
      toast.success("Recipe loaded");
    } finally {
      setLoadingRecipe(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get("editRecipe");
    if (!id) return;
    void loadRecipeForEdit(id);
     
  }, [searchParams]);

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now().toString(), name: "", amount: "", unit: "g" }]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((ing) => ing.id !== id));
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)));
  };

  /** Re-parse each row from "amount unit name" joined — fixes 500g-in-name, x400g tins, trailing ¾, etc. */
  const splitAllIngredientLines = useCallback(() => {
    setIngredients((prev) =>
      prev.map((ing) => {
        const line = [ing.amount, ing.unit, ing.name]
          .map((x) => x.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ");
        const p = parseIngredientLine(line);
        return {
          ...ing,
          amount: p.amount,
          unit: p.unit,
          name: p.name.trim() ? p.name : ing.name,
        };
      }),
    );
    toast.success("Re-split ingredient lines");
  }, []);

  /** One estimate per ingredient row (by id) for inline hints; re-parses name-only weights */
  const macroByIngredientId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof estimateLineMacros>>();
    for (const ing of ingredients) {
      if (!ing.name.trim()) continue;
      const r = resolveStructuredIngredient(ing);
      map.set(ing.id, estimateLineMacros(r));
    }
    return map;
  }, [ingredients]);

  const nutritionPreview = useMemo(() => {
    const rows = ingredients.map((i) => {
      if (!i.name.trim()) return { name: "", amount: "", unit: "" };
      return resolveStructuredIngredient(i);
    });
    const nonEmpty = rows.filter((r) => r.name.trim().length > 0);
    if (nonEmpty.length === 0) return null;
    const lineMacros = rows.map((i) =>
      i.name.trim() ? estimateLineMacros(i) : { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    );
    const total = sumMacros(lineMacros);
    const s = Math.max(1, Math.round(servings) || 1);
    return {
      total,
      perServing: {
        calories: Math.round(total.calories / s),
        protein: Math.round(total.protein / s),
        carbs: Math.round(total.carbs / s),
        fat: Math.round(total.fat / s),
      },
      lines: rows.map((row, idx) => ({ row, macros: lineMacros[idx]! })),
    };
  }, [ingredients, servings]);

  const verifyWithProvider = async (provider: "usda" | "fatsecret" | "auto", opts?: { silent?: boolean }) => {
    const rows = ingredients.map((i) => (i.name.trim() ? resolveStructuredIngredient(i) : { name: "", amount: "", unit: "" }));
    if (rows.length === 0) {
      toast.error("Add at least one ingredient name first.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: rows,
          servings: Math.max(1, Math.round(servings) || 1),
          provider,
          overrides: Object.entries(lineOverrides).map(([index, v]) => {
            if (v.kind === "USDA") return { index: Number(index), fdcId: v.fdcId, description: v.description };
            return { index: Number(index), barcode: v.barcode, description: v.description };
          }),
        }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            verified: VerifiedLine[];
            totals: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
            perServing: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
            primarySource?: string;
            minIngredientConfidence?: number;
            avgIngredientConfidence?: number;
            // ENG-1299 — partial per-serving micros panel (absent ≠ zero).
            microsPerServing?: Record<string, number>;
          }
        | { ok?: false; message?: string; error?: string };
      if (!("ok" in data) || !data.ok) {
        toast.error(data.message ?? "Verification failed");
        return;
      }
      const avgConfidence =
        typeof data.avgIngredientConfidence === "number" && Number.isFinite(data.avgIngredientConfidence)
          ? Math.round(data.avgIngredientConfidence * 100) / 100
          : data.verified.length > 0
            ? Math.round(
                (data.verified.reduce((acc, v) => acc + (Number.isFinite(v.confidence) ? v.confidence : 0), 0) /
                  data.verified.length) *
                  100,
              ) / 100
            : 0;
      const minConfidence =
        typeof data.minIngredientConfidence === "number" && Number.isFinite(data.minIngredientConfidence)
          ? data.minIngredientConfidence
          : data.verified.length > 0
            ? Math.min(...data.verified.map((v) => (Number.isFinite(v.confidence) ? v.confidence : 1)))
            : 0;
      setVerifiedLines(data.verified);
      setVerifiedTotals({
        totals: data.totals,
        perServing: data.perServing,
        avgConfidence,
        minConfidence,
        primarySource: data.primarySource,
        // ENG-1299 — per-serving micros panel (accept-floor applied server-side).
        microsPerServing: data.microsPerServing,
      });
      if (!opts?.silent) {
        toast.success(`Best-available nutrition calculated (${data.primarySource ?? provider})`, {
          description: `${data.perServing.calories} kcal · ${data.perServing.protein}P · ${data.perServing.carbs}C · ${data.perServing.fat}F per serving`,
        });
      }
    } catch (e) {
      // Audit I01 (2026-05-05) — sanitise via central mapper so any
      // Postgrest / vendor leak in the thrown Error is stripped.
      console.error("[RecipeUpload] verify failed:", e instanceof Error ? e.message : e);
      toast.error(userFacingImportError(e));
    } finally {
      setVerifying(false);
    }
  };

  type VerifyRecipeSuccess = {
    ok: true;
    verified: VerifiedLine[];
    totals: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    perServing: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    /** ENG-1299 — per-serving micros panel (accept-floor applied server-side). */
    microsPerServing?: Record<string, number>;
    primarySource?: string;
    minIngredientConfidence?: number;
    avgIngredientConfidence?: number;
  };

  const applyPasteListMatch = async () => {
    const lines = splitPastedIngredientLines(pasteDraft);
    if (lines.length === 0) {
      toast.error("Paste at least one ingredient line.");
      return;
    }
    if (lines.length > 60) {
      toast.error("Use at most 60 lines per batch.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: parseRawIngredients(lines),
          servings: Math.max(1, Math.round(servings) || 1),
          provider: "auto" as const,
          overrides: [],
        }),
      });
      const data = (await res.json()) as VerifyRecipeSuccess | { ok?: false; message?: string; error?: string };
      if (!("ok" in data) || !data.ok) {
        toast.error(data.message ?? "Verification failed");
        return;
      }
      const newIngs: Ingredient[] = lines.map((line, idx) => {
        const p = parseIngredientLine(line);
        const name = p.name.trim() || line.trim();
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `paste-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`;
        return { id, name, amount: p.amount, unit: p.unit };
      });
      const avgConfidence =
        typeof data.avgIngredientConfidence === "number" && Number.isFinite(data.avgIngredientConfidence)
          ? Math.round(data.avgIngredientConfidence * 100) / 100
          : data.verified.length > 0
            ? Math.round(
                (data.verified.reduce((acc, v) => acc + (Number.isFinite(v.confidence) ? v.confidence : 0), 0) /
                  data.verified.length) *
                  100,
              ) / 100
            : 0;
      const minConfidence =
        typeof data.minIngredientConfidence === "number" && Number.isFinite(data.minIngredientConfidence)
          ? data.minIngredientConfidence
          : data.verified.length > 0
            ? Math.min(...data.verified.map((v) => (Number.isFinite(v.confidence) ? v.confidence : 1)))
            : 0;
      setLineOverrides({});
      setIngredients(newIngs);
      setVerifiedLines(data.verified);
      setVerifiedTotals({
        totals: data.totals,
        perServing: data.perServing,
        avgConfidence,
        minConfidence,
        primarySource: data.primarySource,
        // ENG-1299 — per-serving micros panel (accept-floor applied server-side).
        microsPerServing: data.microsPerServing,
      });
      setPasteDialogOpen(false);
      setPasteDraft("");
      track(AnalyticsEvents.recipe_create_paste_list_matched, {
        lineCount: lines.length,
        platform: "web",
        avgConfidence: avgConfidence,
      });
      const needsReview = verifyJsonNeedsReview(data); // ENG-1305: folds in belowAcceptFloorCount
      if (needsReview) {
        track(AnalyticsEvents.recipe_verify_needs_review, {
          source: "create_paste",
          platform: "web",
          avgIngredientConfidence: data.avgIngredientConfidence,
          minIngredientConfidence: data.minIngredientConfidence,
        });
      }
      toast.success(
        needsReview
          ? `Matched ${lines.length} ingredients — review low-confidence lines`
          : `Matched ${lines.length} ingredients (${data.primarySource ?? "auto"})`,
        {
          description: needsReview
            ? `${data.perServing.calories} kcal per serving · some matches are uncertain; check amounts before publishing.`
            : `${data.perServing.calories} kcal per serving · review rows before saving.`,
          duration: needsReview ? 9000 : 5000,
        },
      );
    } catch (e) {
      // Audit I01 (2026-05-05) — sanitise via central mapper so any
      // Postgrest / vendor leak in the thrown Error is stripped.
      console.error("[RecipeUpload] verify failed:", e instanceof Error ? e.message : e);
      toast.error(userFacingImportError(e));
    } finally {
      setVerifying(false);
    }
  };

  // Auto-run best-available verification (USDA → FatSecret → fallback) when ingredients change.
  // ENG-1415 — un-gated from `isCreator`: free tier never got auto-verify, so
  // saveRecipe always fell back to the raw estimator for them. Verification
  // is data integrity, not a premium differentiator (publish still requires
  // is_verified + paid tier via RLS, unchanged).
  useEffect(() => {
    const hasAny = ingredients.some((i) => i.name.trim().length > 0);
    if (!hasAny) return;
    const t = setTimeout(() => {
      void verifyWithProvider("auto", { silent: true });
    }, 700);
    return () => clearTimeout(t);
    // verifyWithProvider is intentionally excluded: it closes over fresh
    // ingredients state each render; listing it would retrigger every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verifyWithProvider omitted deliberately (comment above)
  }, [ingredients, servings, lineOverrides]);

  const saveRecipe = async (published: boolean) => {
    const effectivePublished = mode === "import" ? false : published;
    if (published && mode === "import") {
      toast.error("Imported recipes stay in your library only — you can't publish someone else's content as your own.");
      return;
    }
    if (effectivePublished && mode === "create" && !attestOriginalWork) {
      toast.error("Confirm you created this recipe and have the right to share it before publishing.");
      return;
    }
    // Polish (2026-04-25): if the user (or an importer) supplied an ALL-CAPS
    // title, store as Title Case. Mixed-case inputs pass through untouched.
    const trimmedTitle = normalizeRecipeTitle(title.trim());
    if (!trimmedTitle || trimmedTitle === "Untitled recipe") {
      toast.error("Add a recipe title first.");
      return;
    }
    const cleanedIngredients = ingredients
      .map((i) => {
        const trimmed = { ...i, name: i.name.trim(), amount: i.amount.trim(), unit: i.unit.trim() };
        const r = resolveStructuredIngredient(trimmed);
        return { ...trimmed, name: r.name, amount: r.amount, unit: r.unit };
      })
      .filter((i) => i.name.length > 0);
    if (cleanedIngredients.length === 0) {
      toast.error("Add at least one ingredient.");
      return;
    }
    if (!instructions.trim()) {
      toast.error("Add cooking instructions.");
      return;
    }

    setSaving(effectivePublished ? "publish" : "draft");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        // Audit I01 (2026-05-05) — Supabase auth errors include JWT
        // refs; never echo `.message` directly.
        console.error("[RecipeUpload] getSession failed:", sessionError.message);
        toast.error("Please sign in again.");
        return;
      }
      const uid = sessionData.session?.user.id ?? null;
      if (!uid) {
        toast.error("Please sign in again.");
        return;
      }

      // ENG-1415 — estimateLineMacros's confidence ceiling (0.35) can never
      // clear the accept floor (0.55, verifyConfidencePolicy.ts), so its sum
      // is never trustworthy as the recipe's authoritative nutrition.
      // lineEstimates still feeds the per-ingredient insert (each row keeps
      // its own honest tier) but no longer the recipe-level aggregate.
      const lineEstimates = cleanedIngredients.map((i) =>
        estimateLineMacros({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        }),
      );
      const s = Math.max(1, Math.round(servings) || 1);

      const verifiedOk = verifiedLines != null && verifiedLines.length === cleanedIngredients.length && verifiedTotals != null;
      // null (not 0/an estimator guess) until verify resolves — "unknown"
      // stays distinguishable from "known zero" (renders "Nutrition pending").
      const chosenPerServing = verifiedOk
        ? {
            calories: verifiedTotals.perServing.calories,
            protein: verifiedTotals.perServing.protein,
            carbs: verifiedTotals.perServing.carbs,
            fat: verifiedTotals.perServing.fat,
          }
        : null;

      // T12 (2026-04-24) — regulated allergens inferred from matched
      // ingredient names at ≥0.70 confidence. Uses `matchedName` when
      // the verifier resolved a catalog match; otherwise falls back to
      // the user's raw line (still inferred, but will skip the
      // confidence gate for unverified lines via the default 1).
      // Closes DI-P0-01 on the upload path.
      const allergensPayload = verifiedOk
        ? inferAllergensFromIngredients(
            verifiedLines!.map((v) => ({
              name: v.matchedName ?? v.input?.name ?? v.resolved?.name ?? "",
              confidence: v.confidence,
            })),
          )
        : inferAllergensFromIngredients(cleanedIngredients.map((i) => i.name));

      // Upload to Supabase Storage if a local file was selected. ENG-1287:
      // no usable image → persist NULL, never a stock photo.
      let finalImageUrl: string | null = coverImageUrl || null;
      if (coverImageFile) {
        const uploadResult = await uploadRecipeImage(coverImageFile, uid);
        if (uploadResult.ok) {
          finalImageUrl = uploadResult.publicUrl;
        } else {
          toast.warning(uploadResult.error); // non-blocking: save without an image
          finalImageUrl = null;
        }
      } else if (finalImageUrl && (finalImageUrl.startsWith("blob:") || finalImageUrl.startsWith("data:"))) {
        // Don't store blob/data URLs in the DB
        finalImageUrl = null;
      }

      // F-5 (`AI-CNKcmy7y`): route every write through `normaliseSource` so web
      // import saves the URL + name whenever they are known at import time.
      // `mode === "create"` bypasses this entirely — manual originals have no
      // upstream attribution to preserve.
      const { source_url: attributionUrl, source_name: attributionName } =
        mode === "import"
          ? normaliseSource({ url: importedSourceUrl, name: importedSourceName })
          : { source_url: null, source_name: null };

      // T19 Path B (2026-04-25) — FatSecret Basic-tier ToS prohibits
      // caching macro values. If any line in this recipe is FatSecret-
      // sourced the aggregate is also a FatSecret cache (it sums those
      // macros) and must not be persisted. The recipe-detail render
      // path will trigger a runtime re-fetch when ingredient rows have
      // `fatsecret_food_id is not null && is_verified=false`.
      const aggregateHasFs =
        verifiedOk && recipeAggregateHasFatSecret(verifiedLines!.map((v) => ({ source: v.source ?? null })));
      const aggregateScrub = aggregateHasFs ? ZEROED_RECIPE_AGGREGATE : null;

      const { data: recipeRow, error: recipeError } = await supabase
        .from("recipes")
        .upsert(
          {
            id: recipeId ?? undefined,
            author_id: uid,
            title: trimmedTitle,
            description: description.trim() || null,
            instructions: normaliseInstructions(instructions),
            image_url: finalImageUrl || null,
            servings: s,
            prep_time_min: prepTime,
            cook_time_min: cookTime,
            meal_type: [mealType],
            dietary,
            published: effectivePublished,
            source_url: attributionUrl,
            source_name: attributionName,
            content_origin: attributionUrl ? "imported_stub" : "first_party",
            // F-72 NUMERIC(10,2). ENG-1415: null until verify resolves (the column's own "not yet computed" sentinel).
            calories: aggregateScrub ? aggregateScrub.calories : chosenPerServing ? roundCalories(chosenPerServing.calories) : null,
            protein: aggregateScrub ? aggregateScrub.protein : chosenPerServing ? roundMacro(chosenPerServing.protein) : null,
            carbs: aggregateScrub ? aggregateScrub.carbs : chosenPerServing ? roundMacro(chosenPerServing.carbs) : null,
            fat: aggregateScrub ? aggregateScrub.fat : chosenPerServing ? roundMacro(chosenPerServing.fat) : null,
            fiber_g: aggregateScrub ? aggregateScrub.fiber_g : verifiedOk ? roundMacro(verifiedTotals.perServing.fiberG) : null,
            sugar_g: aggregateScrub ? aggregateScrub.sugar_g : verifiedOk ? roundMacro(verifiedTotals.perServing.sugarG) : null,
            sodium_mg: aggregateScrub ? aggregateScrub.sodium_mg : verifiedOk ? roundMacro(verifiedTotals.perServing.sodiumMg) : null,
            // ENG-1299 — per-serving micros panel. Zeroed with the rest of
            // the aggregate when any line is FatSecret-sourced (T19 Path B);
            // empty when the recipe was saved without a verify pass.
            nutrition_micros:
              !aggregateScrub && verifiedOk ? (verifiedTotals.microsPerServing ?? {}) : {},
            allergens: allergensPayload,
          },
          { onConflict: "id" },
        )
        .select("id, caffeine_mg, alcohol_g")
        .single();

      if (recipeError) {
        // Audit I01 (2026-05-05) — Postgrest leak.
        console.error("[RecipeUpload] upsert recipe failed:", recipeError.message);
        toast.error(IMPORT_ERROR_COPY[mapPersistenceError(recipeError)]);
        return;
      }

      const id = recipeRow.id as string;
      setRecipeId(id);
      setLoadedPublished(effectivePublished);

      // Replace ingredient rows (simple and reliable for Phase 0).
      const { error: deleteError } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
      if (deleteError) {
        // Audit I01 (2026-05-05) — Postgrest leak.
        console.error("[RecipeUpload] delete ingredients failed:", deleteError.message);
        toast.error(IMPORT_ERROR_COPY[mapPersistenceError(deleteError)]);
        return;
      }

      // T19 Path B — every row goes through `scrubFatSecretMacros` before
      // insert: a `FatSecret` row's macros are zeroed + `source` → 'Unverified',
      // but `fatsecret_food_id` (+ ENG-1276 `matched_alias_key`) survive so the
      // runtime re-fetch on recipe-detail load can re-match. USDA / OFF / Edamam
      // rows pass through untouched (those sources permit caching).
      const inserts = cleanedIngredients.map((i, idx) => {
        const est = lineEstimates[idx]!;
        const v = verifiedOk ? verifiedLines![idx] : null;
        const macros = v?.macros ?? null;
        const rowSource = v?.source ?? (macros ? "FatSecret" : "Estimated");
        // F-72 — recipe_ingredients macro columns are NUMERIC(10, 2).
        // Round to 1 decimal at the write boundary so verified macros
        // (FatSecret floats) and estimated macros (USDA per-100 g math)
        // both land at the same precision the schema and UI expose.
        const baseRow = {
          recipe_id: id,
          ingredient_id: null,
          name: i.name,
          amount: amountToNumeric(i.amount),
          unit: i.unit || null,
          calories: roundCalories(macros?.calories ?? est.calories),
          protein: roundMacro(macros?.protein ?? est.protein),
          carbs: roundMacro(macros?.carbs ?? est.carbs),
          fat: roundMacro(macros?.fat ?? est.fat),
          fiber_g: roundMacro(macros?.fiberG ?? 0),
          sugar_g: roundMacro(macros?.sugarG ?? 0),
          sodium_mg: roundMacro(macros?.sodiumMg ?? 0),
          // ENG-1299 — micros travel (and scrub) with the macros.
          nutrition_micros: v?.micros ?? {},
          fatsecret_food_id: v?.fatSecretFoodId ?? null,
          matched_alias_key: matchedAliasKeyForRow({ name: i.name, source: v?.source ?? rowSource, fatsecretFoodId: v?.fatSecretFoodId, confidence: v?.confidence }), // ENG-1276
          confidence: v?.confidence ?? null,
          is_verified: isStructuredSource(rowSource) && Boolean(macros),
          source: rowSource,
        };
        return scrubFatSecretMacros(baseRow);
      });

      const { data: insertedRows, error: insertError } = await supabase
        .from("recipe_ingredients")
        .insert(inserts)
        .select("id");
      if (insertError) {
        // Audit I01 (2026-05-05) — Postgrest leak.
        console.error("[RecipeUpload] insert ingredients failed:", insertError.message);
        toast.error(IMPORT_ERROR_COPY[mapPersistenceError(insertError)]);
        return;
      }

      // ENG-1415/1417 — flips recipes.is_verified server-side when every
      // ingredient verified; no-ops otherwise. See persistVerifiedRecipeAggregate.
      await persistVerifiedRecipeAggregate({
        supabase,
        recipeId: id,
        verifiedOk,
        chosenPerServing,
        verifiedTotals,
        aggregateScrub,
        allergensPayload,
        existingCaffeineMg: recipeRow.caffeine_mg,
        existingAlcoholG: recipeRow.alcohol_g,
        insertedIds: insertedRows ?? [],
        insertRows: inserts,
      });

      await refreshDiscoverRecipes();
      await refreshMyLibraryRecipes();
      if (mode === "import") void reloadRecentImports();
      ensureRecipeInLibraryWithKind(id, mode === "create" ? "created" : "imported");

      // Sloe image system (2026-06-08) — when the recipe saved with the
      // default cover (no user upload, no imported/YouTube thumbnail),
      // fire an on-brand hero generation in the BACKGROUND. Strictly
      // fire-and-forget: never awaited, never blocks the save, and the
      // route no-ops cleanly (200 `skipped`) while fal.ai is unconfigured
      // or out of balance. The recipe already shows the calm placeholder
      // until/if a real hero lands; a later detail-view load picks up the
      // generated `image_url`.
      if (!effectivePublished && !finalImageUrl) {
        void fetch("/api/recipe-import/image-hero", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipeId: id,
            title: trimmedTitle,
            ingredients: cleanedIngredients.map((i) => i.name).slice(0, 6),
          }),
        }).catch(() => {
          // Best-effort only — a failed/locked generation is expected and
          // must never surface to the user mid-save.
        });
      }

      // ENG-1415 — no more guessed number labelled "estimated"; honest state
      // is "still working it out" until verify resolves.
      const savedMacroLine = chosenPerServing
        ? `${chosenPerServing.calories} kcal · ${chosenPerServing.protein}P · ${chosenPerServing.carbs}C · ${chosenPerServing.fat}F per serving (verified)`
        : "Nutrition pending — we're still verifying this recipe's macros.";
      if (mode === "import") {
        setImportSuccess({
          recipeId: id,
          title: trimmedTitle,
          macroLine: savedMacroLine,
        });
      } else {
        toast.success(
          effectivePublished ? "Recipe published" : "Draft saved",
          { description: savedMacroLine },
        );
      }
    } finally {
      setSaving(null);
    }
  };

  if (mode === "import" && importSuccess) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <ImportSuccessSheet
          recipeTitle={importSuccess.title}
          recipeId={importSuccess.recipeId}
          macroLine={importSuccess.macroLine}
          onViewRecipe={() => router.push(`/recipe/${importSuccess.recipeId}`)}
          onReviewIngredients={() => router.push(`/recipe/verify?id=${importSuccess.recipeId}`)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-full">
              {mode === "import" ? (
                <Icons.import className="w-5 h-5 text-white" />
              ) : (
                <Icons.chef className="w-5 h-5 text-white" />
              )}
            </div>
            <h1 className="font-[family-name:var(--font-headline)] text-3xl text-foreground-brand">
              {mode === "import" ? "Import recipe" : "Create recipe"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "create" && onSwitchToImport ? (
              <button
                type="button"
                onClick={onSwitchToImport}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/60"
              >
                Import instead
              </button>
            ) : null}
            {mode === "import" && onSwitchToCreate ? (
              <button
                type="button"
                // ENG-1211 — the header "Create instead" switch lands on the
                // plain create form (no method hint); only the method tiles
                // pass a hint. Wrap so the click event isn't read as a method.
                onClick={() => onSwitchToCreate()}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/60"
              >
                Create instead
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted/60"
            >
              Clear form
            </button>
          </div>
        </div>
        <p className="text-muted-foreground">
          {mode === "import"
            ? "Bring in recipes you have access to—cookbooks, blogs, or scans—for your private library. These stay personal copies; you don't publish them as your own work."
            : "Build an original recipe (typed or from your own photo). Publishing is optional—say when it's your content. Scanning a cookbook page you bought belongs under Import, not here."}
        </p>
      </div>

      {mode === "create" && onSwitchToImport ? (
        <div className="backdrop-blur-xl bg-primary/10 border border-primary/30 rounded-2xl p-5 mb-6 text-sm text-foreground">
          <p className="font-medium text-foreground mb-1">Not your original recipe?</p>
          <p className="mb-3">
            Use Import for URLs, cookbook scans, or anything you didn't write yourself—so your library stays honest and
            imports aren't offered as your creations.
          </p>
          <SupprButton variant="ghost" type="button" onClick={onSwitchToImport}>
            <Icons.import className="w-4 h-4" />
            Open Import recipe
          </SupprButton>
        </div>
      ) : null}

      {mode === "create" && recipeId && !loadedPublished ? (
        <div className="backdrop-blur-xl bg-card/70 border border-border/60 rounded-2xl p-6 mb-6">
          <h3 className="text-foreground mb-1">Ready to share?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            When you go public, other people can discover and save this recipe. Only publish if it's your original work.
          </p>
          <GoPublicDialog
            recipeTitle={title.trim() || "Untitled recipe"}
            disabled={saving !== null}
            onConfirmPublish={() => void saveRecipe(true)}
          />
        </div>
      ) : null}

      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-headline)] text-foreground-brand">Paste ingredient list</DialogTitle>
            <DialogDescription>
              One line per ingredient. We run the same database match as the mobile create screen (USDA, Open Food Facts,
              FatSecret, Edamam, then estimation only if needed).
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteDraft}
            onChange={(e) => setPasteDraft(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder={"2 tbsp olive oil\n1 onion, diced\n400 g canned tomatoes"}
          />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <SupprButton
              variant="ghost"
              type="button"
              onClick={() => setPasteDialogOpen(false)}
              disabled={verifying}
            >
              Cancel
            </SupprButton>
            <SupprButton
              variant="primary"
              type="button"
              loading={verifying}
              onClick={() => void applyPasteListMatch()}
            >
              {verifying ? "Matching…" : "Match to database"}
            </SupprButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from URL (import flow only — matches mobile prototype).
          Sloe DS reskin (2026-06-07): cream slabs (`bg-card`), 24px radii
          (`rounded-[var(--radius-card-lg)]`), plum serif headings
          (`font-[family-name:var(--font-headline)] text-foreground-brand`).
          Presentation only — paste-link / URL-parse logic unchanged. */}
      {mode === "import" ? (
        <div className="space-y-4 mb-6">
          {importCaptionPreviewOpen && captionPreviewPlatform ? (
            <ImportCaptionPreviewCard
              platform={captionPreviewPlatform}
              captionDraft={captionDraft}
              captionEditing={captionEditing}
              busy={importBusy}
              onCaptionChange={setCaptionDraft}
              onToggleEdit={() => setCaptionEditing((v) => !v)}
              onConfirm={() => void runCaptionImportConfirmed()}
              onPhotoInstead={() => {
                dismissCaptionPreview();
                onPhotoMethodPress();
              }}
              onLinkInstead={() => {
                const url = captionPreviewUrl.trim();
                dismissCaptionPreview();
                if (url) void executeUrlImport(url);
              }}
            />
          ) : (
          <>
          {/* Paste-link pill — the import CTA panel. */}
          <div className="bg-card border border-border rounded-[var(--radius-card-lg)] p-6 text-center">
            {/* ENG-797 brandmark — mobile leads this panel with <SupprMark size={56} /> (apps/mobile/app/import-shared.tsx). Gating is internal to SupprMark (design_system_brandmark). */}
            <SupprMark size={48} className="mx-auto mb-4" />
            <h3 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand mb-1">
              Paste a recipe link
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              From Instagram, TikTok, YouTube, or any recipe site — we&apos;ll save it to your library.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 text-left">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 px-4 py-3 rounded-[var(--radius-card)] border border-border bg-muted/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <SupprButton
                variant="primary"
                type="button"
                loading={importBusy}
                onClick={() => void runImportFromUrl()}
              >
                {importBusy ? "Importing…" : "Import"}
              </SupprButton>
            </div>
            {importHint ? (
              importRedesign ? (
                // recipe-import-redesign ON — L4 inline amber banner (import.md §3.10).
                <div
                  data-testid="import-l4-error"
                  role="alert"
                  className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-left"
                >
                  <div className="flex gap-3">
                    <Icons.alert className="h-10 w-10 shrink-0 text-warning-solid" aria-hidden />
                    <div>
                      <p className="font-[family-name:var(--font-headline)] text-lg text-foreground">
                        Something went wrong
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{importHint}</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Legacy (flag OFF, production) — small destructive hint line;
                // the actionable error also surfaces as a toast (catch block).
                <p className="text-xs text-destructive mt-2 text-left">{importHint}</p>
              )
            ) : null}

            {/* import-progress-v2 OFF → legacy inline skeleton. ON → the
                persistent queue drawer (mounted at component root) shows
                live per-stage progress instead. */}
            {importBusy && !importProgressV2 ? (
              <ImportLoadingSkeleton phase="importing" className="mt-4" />
            ) : null}

            {/* recipe-import-redesign ON — the 3-method source tiles (Photo /
                Paste text / Scan), mobile parity (apps/mobile/app/import-shared.tsx).
                OFF (legacy, production) → no tiles; the photo affordance lives in
                the "Recipe photo" card below, unchanged. */}
            {importRedesign ? (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <input
                  ref={photoMethodInputRef}
                  type="file"
                  accept="image/*"
                  multiple={importProgressV2}
                  aria-label="Choose recipe photos to import"
                  className="sr-only"
                  onChange={(e) => onPhotoMethodFiles(e.target.files)}
                />

                <div className="grid grid-cols-3 gap-2" data-testid="import-method-tiles">
                  <button
                    type="button"
                    data-testid="import-method-photo"
                    aria-label={
                      isFreeTier
                        ? "Import from a photo — Pro feature, upgrade required"
                        : "Import from a photo"
                    }
                    onClick={onPhotoMethodPress}
                    className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card-lg)] border border-border bg-card p-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="relative inline-flex">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                        <Icons.camera className="h-5 w-5 text-primary-solid" aria-hidden />
                      </span>
                      {isFreeTier ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-warning/10">
                          <Icons.lock className="h-2.5 w-2.5 text-warning-solid" aria-hidden />
                        </span>
                      ) : null}
                    </span>
                    <span className="font-[family-name:var(--font-headline)] text-[15px] text-foreground-brand">
                      Photo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isFreeTier ? "Pro · Snap a recipe" : "Snap a recipe"}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="import-method-paste-text"
                    aria-label="Paste recipe text from notes"
                    onClick={() => onSwitchToCreate?.("paste")}
                    className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card-lg)] border border-border bg-card p-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                      <Icons.copy className="h-5 w-5 text-primary-solid" aria-hidden />
                    </span>
                    <span className="font-[family-name:var(--font-headline)] text-[15px] text-foreground-brand">
                      Paste text
                    </span>
                    <span className="text-xs text-muted-foreground">From notes</span>
                  </button>
                  <button
                    type="button"
                    data-testid="import-method-scan"
                    aria-label="Create a recipe with barcode scan"
                    onClick={() => onSwitchToCreate?.("scan")}
                    className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card-lg)] border border-border bg-card p-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                      <Icons.scan className="h-5 w-5 text-primary-solid" aria-hidden />
                    </span>
                    <span className="font-[family-name:var(--font-headline)] text-[15px] text-foreground-brand">
                      Scan
                    </span>
                    <span className="text-xs text-muted-foreground">Barcode</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
          </>
          )}

          {/* WORKS WITH — non-tappable trust chips (ENG-898, mobile parity).
              Honest sources we parse; NOT a four-way router. */}
          <div className="space-y-2" data-testid="import-works-with">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Works with
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { mono: "TT", label: "TikTok" },
                { mono: "IG", label: "Instagram" },
                { mono: "YT", label: "YouTube" },
                { mono: "W", label: "Website" },
              ].map((source) => (
                <div
                  key={source.label}
                  aria-label={`Works with ${source.label}`}
                  className="inline-flex h-6 items-center rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground"
                >
                  {source.mono}
                </div>
              ))}
            </div>
          </div>

          <ImportRecentImports items={recentImports} />
        </div>
      ) : null}

      {mode === "import" && importSaveFirstActive && isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG) ? (
        <div
          data-testid={IMPORT_SAVE_FIRST_TEST_ID}
          className="backdrop-blur-xl bg-primary/10 border border-primary/30 rounded-2xl p-4 mb-6 text-sm text-foreground"
          role="status"
          aria-label={IMPORT_SAVE_FIRST_REVIEW_BANNER.a11yLabel}
        >
          {IMPORT_SAVE_FIRST_REVIEW_BANNER.label}
        </div>
      ) : null}

      {mode === "import" && (importImageUsed === false || importCaptionTruncated) ? (
        <div
          data-testid="import-preview-confidence-banner"
          className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-foreground"
          role="status"
        >
          <p className="font-semibold">
            {importImageUsed === false
              ? "Image couldn't be analysed"
              : "Long caption was shortened"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {importImageUsed === false
              ? "The recipe was extracted from the caption alone. Review amounts and nutrition before saving."
              : "Only the first part of this post was analysed. If the recipe continues below, add missing ingredients manually."}
          </p>
        </div>
      ) : null}

      {/* ENG-1283 — honest under-count note (renders only when flagged + flag ON). */}
      {mode === "import" && importReviewHonesty && importFlaggedRecipe ? (
        <ImportReviewFlaggedNote recipe={importFlaggedRecipe} />
      ) : null}

      {/* Image Upload — screenshot → cover + optional text extraction */}
      {/* Flat-card surfaces (2026-06-12, Withings grammar): resting form card
          sits flat — `shadow-lg` lift retired, fill on the cream ground is the
          separation. */}
      <div className="bg-card border border-border rounded-[var(--radius-card-lg)] p-6 mb-6">
        <label className="block mb-3 text-sm font-medium text-foreground">Recipe photo</label>
        <p className="text-xs text-muted-foreground mb-3">
          {mode === "import"
            ? `Paste a screenshot or choose a file. If "Extract from image" is available, it can pull text from a cookbook or card photo—review, then save as an imported library copy.`
            : `Paste a screenshot or choose a file. If "Extract from image" is available, it can digitize your own handwritten or typed recipe.`}
        </p>
        <div
          onPaste={(e) => {
            const f = e.clipboardData?.files?.[0];
            if (f) {
              e.preventDefault();
              applyImageFile(f);
            }
          }}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-all bg-muted/40"
        >
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-chosen blob/data URLs before upload
            <img
              src={coverImageUrl}
              alt="Recipe cover preview"
              className="w-full max-h-64 object-cover rounded-lg mb-4 mx-auto"
            />
          ) : (
            <>
              <Icons.camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Paste screenshot, or choose a file</p>
            </>
          )}
          {importProgressV2 && mode === "import" ? (
            // ENG-735 — bulk photo import (primary path). Multi-file picker:
            // each photo becomes its own queue job; the drawer at the page
            // foot carries live per-photo progress. No `Extract from image`
            // button here — selecting files starts the imports immediately,
            // mirroring the mobile multi-select picker.
            <>
              <input
                type="file"
                accept="image/*"
                multiple
                aria-label="Choose recipe photos to import"
                className="block mx-auto text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) runBulkPhotoImport(files);
                  // Reset so re-picking the same files re-triggers onChange.
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground mt-3">
                Pick up to {BULK_PHOTO_IMPORT_MAX} photos — each imports as its own
                recipe. Track progress in the import tray below.
              </p>
            </>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                aria-label="Choose recipe photo file"
                className="block mx-auto text-sm text-muted-foreground"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyImageFile(f);
                }}
              />
              <button
                type="button"
                disabled={ocrBusy}
                onClick={() => void runOcrFromImage()}
                className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {ocrBusy ? "Extracting…" : "Extract from image"}
              </button>
            </>
          )}
        </div>
        {/* F-156-recipe-wave (2026-05-10) — gentle nudge so users with
            an original URL keep the source link on the saved row.
            The "Paste a recipe link" card above already collects the
            URL; we just have to tell the user it works for image
            imports too. */}
        <p className="text-xs text-muted-foreground mt-3">
          If you have the original recipe URL, paste it in &ldquo;Paste a recipe link&rdquo; above and we&apos;ll keep the source link on the saved recipe.
        </p>
      </div>

      {/* Basic Info */}
      {/* Flat-card surfaces (2026-06-12, Withings grammar): resting form card
          sits flat — `shadow-lg` lift retired, fill on the cream ground is the
          separation. */}
      <div className="bg-card border border-border rounded-[var(--radius-card-lg)] p-6 mb-6">
        <h3 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand mb-6">Basic information</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="recipe-upload-title" className="block mb-2 text-sm font-medium text-foreground">Recipe Title</label>
            <input
              id="recipe-upload-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., High-Protein Chicken & Rice Bowl"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label htmlFor="recipe-upload-description" className="block mb-2 text-sm font-medium text-foreground">Description</label>
            <textarea
              id="recipe-upload-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your recipe..."
              rows={3}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="recipe-upload-servings" className="block mb-2 text-sm font-medium text-foreground">Servings</label>
              <input
                id="recipe-upload-servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label htmlFor="recipe-upload-prep" className="block mb-2 text-sm font-medium text-foreground">Prep (min)</label>
              <input
                id="recipe-upload-prep"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label htmlFor="recipe-upload-cook" className="block mb-2 text-sm font-medium text-foreground">Cook (min)</label>
              <input
                id="recipe-upload-cook"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipe-upload-meal-type" className="block mb-2 text-sm font-medium text-foreground">Meal Type</label>
              <select
                id="recipe-upload-meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snacks</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Helps the meal planner place this recipe in the right slot. Lunch and dinner recipes can be swapped
                between those two; breakfast and snack stay separate unless you pick a recipe tagged for both.
              </p>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-foreground">Dietary Tags</label>
              <div className="flex flex-wrap gap-2">
                {["vegetarian", "vegan", "gluten-free", "keto"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setDietary(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
                      // Selected dietary tag = aubergine SOFT-TINT + aubergine
                      // `primary-solid` label (Sloe treatment §7), not a solid slab.
                      dietary.includes(tag)
                        ? "bg-primary/10 text-primary-solid"
                        : "bg-muted text-foreground hover:hover:bg-muted"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      {/* Flat-card surfaces (2026-06-12, Withings grammar): resting form card
          sits flat — `shadow-lg` lift retired, fill on the cream ground is the
          separation. */}
      <div className="bg-card border border-border rounded-[var(--radius-card-lg)] p-6 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-6">
          <h3 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand">Ingredients</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={splitAllIngredientLines}
              className="px-4 py-2 rounded-lg border border-primary/30 text-primary-solid text-sm font-medium hover:bg-primary/10"
            >
              Re-split lines
            </button>
            <button
              type="button"
              onClick={() => setPasteDialogOpen(true)}
              className="px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted/80"
            >
              Paste ingredient list
            </button>
            <SupprButton variant="ghost" type="button" onClick={addIngredient}>
              <Icons.add className="w-4 h-4" />
              Add Ingredient
            </SupprButton>
          </div>
        </div>
        <div className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <div className="flex items-start gap-2">
            <Icons.alert className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-solid">
              Nutrition is <span className="font-medium">estimated live</span> below from names, amounts, and units (same
              logic as save). Use <span className="font-medium">Re-split lines</span> after import to fix{" "}
              <code className="text-xs bg-primary/10 px-1 rounded">500g…</code>,{" "}
              <code className="text-xs bg-primary/10 px-1 rounded">2×400g tins</code>, or trailing
              fractions. Not lab-verified.
            </p>
          </div>
        </div>

        {matchPickerIdx != null ? (
          <div className="mb-6 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground">Swap</h4>
              <button
                type="button"
                onClick={() => {
                  setMatchPickerIdx(null);
                  setMatchHits(null);
                  setBarcodeResult(null);
                }}
                className="text-xs font-semibold text-muted-foreground hover:underline"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">USDA search</p>
                <div className="relative">
                  <input
                    autoFocus
                    value={matchQuery}
                    onChange={(e) => setMatchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void runUsdaSearch(); }}
                    placeholder="Search foods (e.g. red pepper, chicken breast)"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground pr-16"
                  />
                  {matchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Results update as you type</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Barcode (Open Food Facts)</p>
                <div className="flex gap-2">
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan / paste barcode"
                    className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-foreground"
                  />
                  <button
                    type="button"
                    disabled={barcodeLoading}
                    onClick={() => void runBarcodeLookup()}
                    className="px-4 py-3 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-50"
                  >
                    {barcodeLoading ? "…" : "Lookup"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScannerOpen(true);
                      setTimeout(() => void startScanner(), 0);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted/60"
                  >
                    Scan with camera
                  </button>
                  {scannerError ? <span className="text-xs text-destructive">{scannerError}</span> : null}
                </div>
                {scannerOpen ? (
                  <div className="mt-3 rounded-xl border border-border bg-black/80 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-white/90">Point camera at barcode</p>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerOpen(false);
                          stopScanner();
                        }}
                        className="text-xs font-semibold text-white/80 hover:underline"
                      >
                        Close
                      </button>
                    </div>
                    <video ref={videoRef} className="w-full rounded-lg bg-black" playsInline />
                  </div>
                ) : null}
                {barcodeResult ? (
                  <div className="mt-2 rounded-xl border border-border bg-card/40 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{barcodeResult.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{barcodeResult.servingLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLineOverrides((prev) => ({
                          ...prev,
                          [matchPickerIdx]: { kind: "OFF", barcode: barcode.trim(), description: barcodeResult.name },
                        }));
                        void (async () => {
                          const { data: sessionData } = await supabase.auth.getSession();
                          const uid = sessionData.session?.user.id ?? null;
                          await fetch("/api/barcode-mapping", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              barcode: barcode.trim(),
                              displayName: barcodeResult.name,
                              source: "OpenFoodFacts",
                              externalId: barcode.trim(),
                              createdBy: uid,
                            }),
                          });
                        })();
                        toast.success("Barcode match applied");
                        setMatchPickerIdx(null);
                        setMatchHits(null);
                        setBarcodeResult(null);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90"
                    >
                      Use
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {matchHits ? (
              <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-border rounded-xl border border-border bg-card/50">
                {matchHits.slice(0, 10).map((h) => (
                  <li key={h.fdcId} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{h.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {h.dataType ?? "Food"}
                        {h.brandName ? ` · ${h.brandName}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLineOverrides((prev) => ({
                          ...prev,
                          [matchPickerIdx]: { kind: "USDA", fdcId: h.fdcId, description: h.description },
                        }));
                        toast.success("Match updated");
                        setMatchPickerIdx(null);
                        setMatchHits(null);
                        setBarcodeResult(null);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {ingredients.map((ingredient, ingredientIndex) => (
            <div
              key={ingredient.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(18rem,1fr)_auto] sm:items-center sm:gap-3 rounded-xl border border-border p-3 bg-card/40"
            >
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => updateIngredient(ingredient.id, "name", e.target.value)}
                placeholder="Ingredient name"
                aria-label={`Ingredient ${ingredientIndex + 1} name`}
                className="w-full min-w-0 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex flex-wrap items-center justify-start gap-2">
                <input
                  type="text"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(ingredient.id, "amount", e.target.value)}
                  placeholder="Amount"
                  aria-label={`Ingredient ${ingredientIndex + 1} amount`}
                  className="w-24 sm:w-28 px-3 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <select
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(ingredient.id, "unit", e.target.value)}
                  aria-label={`Ingredient ${ingredientIndex + 1} unit`}
                  className="min-w-[10rem] sm:min-w-[11rem] flex-1 sm:flex-initial px-3 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Each / none</option>
                  <option value="count">Count (each)</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="l">l</option>
                  <option value="cup">cup</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                  <option value="fl oz">fl oz</option>
                  <option value="oz">oz (weight)</option>
                  <option value="lb">lb</option>
                  <option value="tin">tin / can</option>
                  <option value="pack">pack</option>
                  <option value="clove">clove(s)</option>
                  <option value="rasher">rasher(s)</option>
                  <option value="sprig">sprig(s)</option>
                  <option value="stalk">stalk / stick</option>
                  <option value="leaf">leaf / leaves</option>
                  <option value="medium">medium (produce)</option>
                  <option value="large">large (produce)</option>
                  <option value="small">small (produce)</option>
                  <option value="pinch">pinch</option>
                </select>
                {ingredient.name.trim() ? (
                  <>
                    <span
                      className="text-xs font-medium tabular-nums text-success whitespace-nowrap px-2 py-1 rounded-lg bg-success/10 border border-success/30"
                      title={verifiedTotals ? "Verified (USDA/FatSecret) when available" : "Estimated from name, amount, and unit"}
                    >
                      {(() => {
                        const r = resolveStructuredIngredient(ingredient);
                        const key = `${r.name}||${r.amount}||${r.unit}`.toLowerCase();
                        const v = verifiedMacroByKey?.get(key);
                        const src = verifiedLines?.find((x) => {
                          const xr = x.resolved;
                          if (!xr) return false;
                          return `${xr.name}||${xr.amount}||${xr.unit}`.toLowerCase() === key;
                        })?.source;
                        if (verifiedTotals && v) return `${v.calories} kcal${src ? ` · ${src}` : ""}`;
                        return `~${macroByIngredientId.get(ingredient.id)?.calories ?? 0} kcal`;
                      })()}
                    </span>
                    {/* 2026-05-13 (premium-bar audit web parity,
                        refuse-to-pass #3 — Recime per-row confidence):
                        coloured confidence bar mirror of the mobile
                        verify screen (apps/mobile/app/recipe/verify.tsx).
                        Width = confidence × 100; colour = success ≥
                        0.9 / warning ≥ 0.5 / destructive < 0.5. Only
                        renders when we have a verified line for this
                        row (otherwise the engine hasn't run yet). */}
                    {(() => {
                      const r = resolveStructuredIngredient(ingredient);
                      const key = `${r.name}||${r.amount}||${r.unit}`.toLowerCase();
                      const line = verifiedLines?.find((x) => {
                        const xr = x.resolved;
                        if (!xr) return false;
                        return `${xr.name}||${xr.amount}||${xr.unit}`.toLowerCase() === key;
                      });
                      if (!line) return null;
                      const pct = Math.max(0, Math.min(1, line.confidence ?? 0));
                      const tone =
                        pct >= 0.9
                          ? "bg-success"
                          : pct >= 0.5
                            ? "bg-warning"
                            : "bg-destructive";
                      return (
                        <span
                          className="inline-block h-1 w-12 rounded-full bg-muted overflow-hidden self-center"
                          aria-label={`Match confidence: ${Math.round(pct * 100)}%`}
                          title={`Match confidence: ${Math.round(pct * 100)}%`}
                        >
                          <span
                            className={`block h-full rounded-full ${tone}`}
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </span>
                      );
                    })()}
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const idx = ingredients.findIndex((x) => x.id === ingredient.id);
                    const r = resolveStructuredIngredient(ingredient);
                    openMatchPicker(idx, r.name || ingredient.name);
                  }}
                  // Parity with mobile verify Swap pill
                  // (apps/mobile/app/recipe/verify.tsx
                  // accessibilityLabel `Swap match for ${displayName}`).
                  aria-label={`Swap match for ${
                    resolveStructuredIngredient(ingredient).name || ingredient.name
                  }`}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted/60"
                >
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => removeIngredient(ingredient.id)}
                  className="p-3 text-muted-foreground hover:text-destructive transition-colors rounded-xl hover:bg-muted"
                  aria-label="Remove ingredient"
                >
                  <Icons.close className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* "How this fits your day" card — matches mobile review state */}
        {nutritionPreview ? (
          <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <IconBox tone="success" size="sm">
                <Icons.success className="w-3.5 h-3.5" />
              </IconBox>
              <span className="text-sm font-semibold text-success">How this fits your day</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const dailyTarget = normalizeMacroTargets(nutritionTargets).calories || 2100;
                return `This recipe provides ${Math.round(nutritionPreview.perServing.calories)} kcal per serving — about ${Math.round((nutritionPreview.perServing.calories / dailyTarget) * 100)}% of your ${dailyTarget.toLocaleString()} kcal daily target.`;
              })()}
            </p>
          </div>
        ) : null}

        {nutritionPreview ? (
          <div className="mt-2 rounded-2xl border border-success/30 bg-success/10 p-5">
            {/**
             * Display rounding only (don't change stored values).
             * Whole-dish totals can be fractional due to summed per-line floats.
             */}
            {(() => {
              const round1 = (n: number) => Math.round(n * 10) / 10;
              const estTotals = nutritionPreview.total;
              const estPerServing = nutritionPreview.perServing;
              const vTotals = verifiedTotals?.totals ?? null;
              const vPerServing = verifiedTotals?.perServing ?? null;

              const displayTotals = vTotals
                ? {
                    calories: Math.round(vTotals.calories),
                    protein: round1(vTotals.protein),
                    carbs: round1(vTotals.carbs),
                    fat: round1(vTotals.fat),
                    fiberG: round1(vTotals.fiberG),
                    sugarG: round1(vTotals.sugarG),
                    sodiumMg: Math.round(vTotals.sodiumMg),
                  }
                : {
                    calories: Math.round(estTotals.calories),
                    protein: round1(estTotals.protein),
                    carbs: round1(estTotals.carbs),
                    fat: round1(estTotals.fat),
                    fiberG: 0,
                    sugarG: 0,
                    sodiumMg: 0,
                  };

              const displayPerServing = vPerServing
                ? {
                    calories: Math.round(vPerServing.calories),
                    protein: round1(vPerServing.protein),
                    carbs: round1(vPerServing.carbs),
                    fat: round1(vPerServing.fat),
                    fiberG: round1(vPerServing.fiberG),
                    sugarG: round1(vPerServing.sugarG),
                    sodiumMg: Math.round(vPerServing.sodiumMg),
                  }
                : {
                    calories: Math.round(estPerServing.calories),
                    protein: round1(estPerServing.protein),
                    carbs: round1(estPerServing.carbs),
                    fat: round1(estPerServing.fat),
                    fiberG: 0,
                    sugarG: 0,
                    sodiumMg: 0,
                  };

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h4 className="text-sm font-semibold text-success">
                {verifiedTotals ? `Best available (${verifiedTotals.primarySource ?? "Verified"})` : "Estimated (heuristics)"}
              </h4>
              {verifying ? (
                <span className="text-xs font-semibold text-success/70">Updating…</span>
              ) : null}
                  </div>
                  <p className="text-xs text-success/75 mb-4">
              {verifiedTotals
                ? `Auto-matched ingredients. Lowest line: ${Math.round(verifiedTotals.minConfidence * 100)}% · avg ${Math.round(verifiedTotals.avgConfidence * 100)}%`
                : "Totals use the same estimates as save (including weight parsed from the name when amount is empty)."}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div>
                <p className="text-success/80">Whole dish</p>
                <p className="text-lg font-bold text-success/90">
                  {displayTotals.calories} kcal
                </p>
                <p className="text-xs text-success/70">
                  P {displayTotals.protein} · C {displayTotals.carbs} · F {displayTotals.fat}
                </p>
                {verifiedTotals ? (
                  <p className="text-[11px] text-success/70 mt-1">
                    Fiber {displayTotals.fiberG}g · Sugar {displayTotals.sugarG}g · Sodium {displayTotals.sodiumMg}mg
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-emerald-700/90 dark:text-emerald-300/90">Per serving ({Math.max(1, servings)})</p>
                <p className="text-lg font-bold text-success/90">
                  {displayPerServing.calories} kcal
                </p>
                <p className="text-xs text-success/70">
                  P {displayPerServing.protein} · C {displayPerServing.carbs} · F {displayPerServing.fat}
                </p>
                {verifiedTotals ? (
                  <p className="text-[11px] text-success/70 mt-1">
                    Fiber {displayPerServing.fiberG}g · Sugar {displayPerServing.sugarG}g · Sodium{" "}
                    {displayPerServing.sodiumMg}mg
                  </p>
                ) : null}
              </div>
                  </div>

            <div className="mt-4 rounded-xl border border-success/30 bg-card/60 p-4">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-xs font-semibold tracking-wide text-emerald-900 dark:text-emerald-100 uppercase">
                  {verifiedTotals ? "Macro wheel (verified)" : "Macro wheel (estimated)"}
                </p>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Per serving</p>
              </div>
              <MacroWheel
                calories={displayPerServing.calories}
                proteinG={displayPerServing.protein}
                carbsG={displayPerServing.carbs}
                fatG={displayPerServing.fat}
                fiberG={verifiedTotals ? displayPerServing.fiberG : 0}
              />
            </div>

                  {verifiedTotals ? (
                    <div className="mt-4 rounded-xl border border-success/30 bg-card/60 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-emerald-900 dark:text-emerald-100 uppercase">
                    Nutrition label
                  </p>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Per serving</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-success/30 p-3">
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Per serving</p>
                    <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-50">
                      {displayPerServing.calories} kcal
                    </p>
                    <div className="mt-2 space-y-1 text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
                      <div className="flex justify-between">
                        <span>Protein</span>
                        <span className="font-semibold">{displayPerServing.protein} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Carbs</span>
                        <span className="font-semibold">{displayPerServing.carbs} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fat</span>
                        <span className="font-semibold">{displayPerServing.fat} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fiber</span>
                        <span className="font-semibold">{displayPerServing.fiberG} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sugar</span>
                        <span className="font-semibold">{displayPerServing.sugarG} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sodium</span>
                        <span className="font-semibold">{displayPerServing.sodiumMg} mg</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-success/30 p-3">
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Whole dish</p>
                    <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-50">
                      {displayTotals.calories} kcal
                    </p>
                    <div className="mt-2 space-y-1 text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
                      <div className="flex justify-between">
                        <span>Protein</span>
                        <span className="font-semibold">{displayTotals.protein} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Carbs</span>
                        <span className="font-semibold">{displayTotals.carbs} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fat</span>
                        <span className="font-semibold">{displayTotals.fat} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fiber</span>
                        <span className="font-semibold">{displayTotals.fiberG} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sugar</span>
                        <span className="font-semibold">{displayTotals.sugarG} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sodium</span>
                        <span className="font-semibold">{displayTotals.sodiumMg} mg</span>
                      </div>
                    </div>
                  </div>
                </div>
                    </div>
                  ) : null}
            <details className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
              <summary className="cursor-pointer font-medium mb-2">
                {verifiedTotals ? "Per-ingredient (verified where matched)" : "Per-ingredient estimates"}
              </summary>
              <ul className="space-y-1 border-t border-success/30 pt-2 max-h-40 overflow-y-auto">
                {verifiedTotals && verifiedLines
                  ? verifiedLines.map((v, i) => {
                      const row = nutritionPreview.lines[i]?.row;
                      if (!row) return null;
                      return (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate">
                            {row.amount ? `${row.amount} ${row.unit} ` : ""}
                            {row.name}
                            {v.matchedName ? (
                              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                {" "}
                                · {v.matchedName}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-emerald-700 dark:text-emerald-400">
                            {v.macros ? `${v.macros.calories} kcal` : "—"}
                          </span>
                        </li>
                      );
                    })
                  : nutritionPreview.lines.map(({ row, macros }, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {row.amount ? `${row.amount} ${row.unit} ` : ""}
                          {row.name}
                        </span>
                        <span className="shrink-0 text-emerald-700 dark:text-emerald-400">{macros.calories} kcal</span>
                      </li>
                    ))}
              </ul>
            </details>
                </>
              );
            })()}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Add at least one ingredient name to see estimated calories and macros.
          </p>
        )}
      </div>

      {/* Instructions */}
      {/* Flat-card surfaces (2026-06-12, Withings grammar): resting form card
          sits flat — `shadow-lg` lift retired, fill on the cream ground is the
          separation. */}
      <div className="bg-card border border-border rounded-[var(--radius-card-lg)] p-6 mb-6">
        <h3 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand mb-4">Cooking instructions</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="1. First step...&#10;2. Second step...&#10;3. Third step..."
          rows={10}
          className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Actions */}
      {mode === "import" ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Publishing isn't available on this screen—imported copies are for your account only. To share original work
            with the community, use Create recipe.
          </p>
          <SupprButton
            variant="primary"
            type="button"
            loading={saving === "draft"}
            disabled={saving !== null}
            onClick={() => void saveRecipe(false)}
            className="w-full"
          >
            {saving === "draft"
              ? "Saving…"
              : importSaveFirstActive && isFeatureEnabled(IMPORT_SAVE_FIRST_FLAG)
                ? IMPORT_SAVE_FIRST_UPDATE_CTA
                : "Save to my library"}
          </SupprButton>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 bg-muted/40">
            <input
              type="checkbox"
              className="mt-1 rounded border-border"
              checked={attestOriginalWork}
              onChange={(e) => setAttestOriginalWork(e.target.checked)}
            />
            <span className="text-sm text-foreground">
              I created this recipe and I have the right to share it publicly (required to publish).
            </span>
          </label>
          <div className="flex gap-4">
            <SupprButton
              variant="ghost"
              type="button"
              loading={saving === "draft"}
              disabled={saving !== null}
              onClick={() => void saveRecipe(false)}
              className="flex-1"
            >
              {saving === "draft" ? "Saving…" : "Save as draft"}
            </SupprButton>
            <SupprButton
              variant="primary"
              type="button"
              loading={saving === "publish"}
              disabled={saving !== null}
              onClick={() => void saveRecipe(true)}
              className="flex-1"
            >
              <Icons.upload className="w-5 h-5" />
              {saving === "publish" ? "Publishing…" : "Publish recipe"}
            </SupprButton>
          </div>
        </div>
      )}

      {/* import-progress-v2 — persistent, non-blocking queue drawer. Renders
          nothing until there's import activity; safe to always mount when the
          flag is on. */}
      {importProgressV2 ? (
        <RecipeImportQueueDrawer
          queue={importQueue}
          onOpenRecipe={(id) => {
            window.location.assign(`/recipe/${id}`);
          }}
        />
      ) : null}
    </div>
  );
}
