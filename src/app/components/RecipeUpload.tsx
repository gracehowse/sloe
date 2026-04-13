import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Plus, X, ChefHat, Camera, AlertCircle, Pencil, Globe, BookPlus } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { useSearchParams } from "next/navigation";
import { parseIngredientLine } from "../../lib/recipe-ingredients/parseIngredientLine.ts";
import { estimateLineMacros, sumMacros } from "../../lib/nutrition/estimateIngredientMacros.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { uploadRecipeImage } from "../../lib/supabase/uploadRecipeImage.ts";
import { track } from "../../lib/analytics/track.ts";
import { GoPublicDialog } from "./GoPublicDialog.tsx";

interface RecipeUploadProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  /** Create = your original recipe (manual entry, your photos). Import = third-party / cookbook / URL / scan for your library only. */
  mode: "create" | "import";
  onSwitchToImport?: () => void;
  onSwitchToCreate?: () => void;
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
};

const DEFAULT_COVER_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

type UsdaHit = { fdcId: number; description: string; dataType?: string; brandName?: string; score?: number };

function MacroWheel(props: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}) {
  const fallback = [{ name: "—", value: 1, color: "rgba(16,185,129,0.15)" }];
  const data = [
    { name: "Protein", value: Math.max(0, props.proteinG), color: "#7c3aed" }, // violet
    { name: "Carbs", value: Math.max(0, props.carbsG), color: "#f59e0b" }, // amber
    { name: "Fat", value: Math.max(0, props.fatG), color: "#22c55e" }, // green
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
          <div className="text-lg font-extrabold text-emerald-950 dark:text-emerald-50 leading-none">{Math.round(props.calories)}</div>
          <div className="text-[10px] font-semibold tracking-wide text-emerald-800/80 dark:text-emerald-300/80 uppercase">
            kcal
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-emerald-900/90 dark:text-emerald-200/90">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
            Protein
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.proteinG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
            Carbs
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.carbsG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
            Fat
          </span>
          <span className="font-semibold tabular-nums">{Math.round(props.fatG * 10) / 10}g</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300/70 dark:bg-emerald-700/50" />
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

/** When amount is empty but the name still contains "500g …", parse so nutrition + save match */
function resolveStructuredIngredient(i: { name: string; amount: string; unit: string }): {
  name: string;
  amount: string;
  unit: string;
} {
  const name = i.name.trim();
  let amount = i.amount.trim();
  let unit = i.unit.trim();
  let foodName = name;
  if (!amount && foodName) {
    const p = parseIngredientLine(foodName);
    if (p.amount && p.name.trim()) {
      amount = p.amount;
      unit = p.unit || unit;
      foodName = p.name.trim();
    }
  }
  return { name: foodName, amount, unit };
}

export function RecipeUpload({ userTier, onUpgrade, mode, onSwitchToImport, onSwitchToCreate }: RecipeUploadProps) {
  const { refreshDiscoverRecipes, ensureRecipeInLibraryWithKind, refreshMyLibraryRecipes } = useAppData();
  const searchParams = useSearchParams();
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
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState(DEFAULT_COVER_IMAGE);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifiedLines, setVerifiedLines] = useState<VerifiedLine[] | null>(null);
  const [verifiedTotals, setVerifiedTotals] = useState<{
    totals: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    perServing: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
    avgConfidence: number;
    primarySource?: string;
  } | null>(null);
  const [lineOverrides, setLineOverrides] = useState<
    Record<number, { kind: "USDA"; fdcId: number; description: string } | { kind: "OFF"; barcode: string; description: string }>
  >({});
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

  const openMatchPicker = (idx: number, suggested: string) => {
    setMatchPickerIdx(idx);
    setMatchQuery(suggested);
    setMatchHits(null);
  };

  // Auto-search USDA when matchQuery changes (debounced 400ms)
  const matchSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (matchPickerIdx == null) return;
    const q = matchQuery.trim();
    if (!q || q.length < 2) return;
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
    const q = matchQuery.trim();
    if (!q) return;
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

  const runBarcodeLookup = async (code?: string) => {
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
  };

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
      setScannerError("Barcode scanning isn’t supported in this browser. Paste the barcode instead.");
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

  // userTier/onUpgrade reserved for tier-gating; all features unlocked for now
  const isCreator = true;

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
    setCoverImageUrl(DEFAULT_COVER_IMAGE);
    setCoverImageFile(null);
    setImportUrl("");
    setImportHint(null);
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
    const url = coverImageUrl;
    if (!url.startsWith("data:")) {
      toast.error("Choose or paste a local image first.");
      return;
    }
    setOcrBusy(true);
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const fd = new FormData();
      fd.append("image", new File([blob], "recipe.jpg", { type: blob.type || "image/jpeg" }));
      const res = await fetch("/api/recipe-import/image", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok?: boolean;
        ingredients?: string[];
        steps?: string[];
        title?: string | null;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Could not extract text from this image.");
        return;
      }
      track(AnalyticsEvents.recipe_import_image, { ingredientCount: data.ingredients?.length ?? 0 });
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
      toast.success("Extracted text from image — review amounts and steps.");
    } finally {
      setOcrBusy(false);
    }
  };

  const runImportFromUrl = async () => {
    const u = importUrl.trim();
    if (!u) {
      toast.error("Paste a recipe URL first.");
      return;
    }
    setImportBusy(true);
    setImportHint(null);
    try {
      const res = await fetch("/api/recipe-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: {
          title: string;
          description: string | null;
          ingredients: string[];
          instructions: string[];
          servings: number | null;
          prepTimeMin: number | null;
          cookTimeMin: number | null;
          imageUrl: string | null;
        };
        message?: string;
      };
      if (!data.ok || !data.recipe) {
        toast.error(data.message ?? "Could not import this URL");
        setImportHint(
          data.message ??
            "No structured recipe found. Paste a screenshot into the photo area and type ingredients manually.",
        );
        return;
      }
      const r = data.recipe;
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
            return {
              id: `imp-${idx}`,
              name,
              amount: p.amount,
              unit: p.unit,
            };
          }),
        );
      }
      if (r.instructions.length) {
        setInstructions(r.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"));
      }
      toast.success("Imported — review amounts and nutrition before publishing");
      try {
        track(AnalyticsEvents.recipe_import_url, { host: new URL(u).hostname });
      } catch {
        track(AnalyticsEvents.recipe_import_url, { host: "invalid" });
      }
    } catch {
      toast.error("Import failed — check the URL or paste a screenshot.");
      setImportHint("Try another URL, or paste a screenshot into the recipe photo area and fill fields manually.");
    } finally {
      setImportBusy(false);
    }
  };

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
        toast.error(rErr?.message ?? "Could not load recipe.");
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
      setMealType((row.meal_type as string) ?? "lunch");
      const d = row.dietary;
      setDietary(Array.isArray(d) ? (d as string[]) : []);
      const img = row.image_url as string | null;
      setCoverImageUrl(img?.trim() || DEFAULT_COVER_IMAGE);

      const { data: ings, error: iErr } = await supabase
        .from("recipe_ingredients")
        .select("id, name, amount, unit")
        .eq("recipe_id", id)
        .order("created_at", { ascending: true });
      if (iErr) {
        toast.error(iErr.message);
        return;
      }
      if (ings?.length) {
        setIngredients(
          ings.map((r, idx) => ({
            id: (r.id as string) ?? `ing-${idx}`,
            name: (r.name as string) ?? "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      i.name.trim() ? estimateLineMacros(i) : { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
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
          }
        | { ok?: false; message?: string; error?: string };
      if (!("ok" in data) || !data.ok) {
        toast.error(data.message ?? "Verification failed");
        return;
      }
      const avgConfidence =
        data.verified.length > 0
          ? Math.round(
              (data.verified.reduce((acc, v) => acc + (Number.isFinite(v.confidence) ? v.confidence : 0), 0) /
                data.verified.length) *
                100,
            ) / 100
          : 0;
      setVerifiedLines(data.verified);
      setVerifiedTotals({ totals: data.totals, perServing: data.perServing, avgConfidence, primarySource: data.primarySource });
      if (!opts?.silent) {
        toast.success(`Best-available nutrition calculated (${data.primarySource ?? provider})`, {
          description: `${data.perServing.calories} kcal · ${data.perServing.protein}P · ${data.perServing.carbs}C · ${data.perServing.fat}F per serving`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-run best-available verification (USDA → FatSecret → fallback) when ingredients change.
  useEffect(() => {
    if (!isCreator) return;
    const hasAny = ingredients.some((i) => i.name.trim().length > 0);
    if (!hasAny) return;
    const t = setTimeout(() => {
      void verifyWithProvider("auto", { silent: true });
    }, 700);
    return () => clearTimeout(t);
  }, [ingredients, servings, isCreator, lineOverrides]);

  const saveRecipe = async (published: boolean) => {
    const effectivePublished = mode === "import" ? false : published;
    if (published && mode === "import") {
      toast.error("Imported recipes stay in your library only—you can’t publish someone else’s content as your own.");
      return;
    }
    if (effectivePublished && mode === "create" && !attestOriginalWork) {
      toast.error("Confirm you created this recipe and have the right to share it before publishing.");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
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
        toast.error(sessionError.message);
        return;
      }
      const uid = sessionData.session?.user.id ?? null;
      if (!uid) {
        toast.error("Please sign in again.");
        return;
      }

      const lineEstimates = cleanedIngredients.map((i) =>
        estimateLineMacros({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        }),
      );
      const dishTotals = sumMacros(lineEstimates);
      const s = Math.max(1, Math.round(servings) || 1);
      const perServing = {
        calories: Math.max(0, Math.round(dishTotals.calories / s)),
        protein: Math.max(0, Math.round(dishTotals.protein / s)),
        carbs: Math.max(0, Math.round(dishTotals.carbs / s)),
        fat: Math.max(0, Math.round(dishTotals.fat / s)),
      };

      const verifiedOk = verifiedLines != null && verifiedLines.length === cleanedIngredients.length && verifiedTotals != null;
      const chosenPerServing = verifiedOk
        ? {
            calories: verifiedTotals.perServing.calories,
            protein: verifiedTotals.perServing.protein,
            carbs: verifiedTotals.perServing.carbs,
            fat: verifiedTotals.perServing.fat,
          }
        : perServing;

      // Upload image to Supabase Storage if a local file was selected
      let finalImageUrl = coverImageUrl;
      if (coverImageFile) {
        const uploadResult = await uploadRecipeImage(coverImageFile, uid);
        if (uploadResult.ok) {
          finalImageUrl = uploadResult.publicUrl;
        } else {
          // Non-blocking: fall back to default, warn user
          toast.warning(uploadResult.error);
          finalImageUrl = DEFAULT_COVER_IMAGE;
        }
      } else if (finalImageUrl.startsWith("blob:") || finalImageUrl.startsWith("data:")) {
        // Don't store blob/data URLs in the DB
        finalImageUrl = DEFAULT_COVER_IMAGE;
      }

      const { data: recipeRow, error: recipeError } = await supabase
        .from("recipes")
        .upsert(
          {
            id: recipeId ?? undefined,
            author_id: uid,
            title: trimmedTitle,
            description: description.trim() || null,
            instructions: instructions.trim(),
            image_url: finalImageUrl || DEFAULT_COVER_IMAGE,
            servings: s,
            prep_time_min: prepTime,
            cook_time_min: cookTime,
            meal_type: mealType,
            dietary,
            published: effectivePublished,
            is_verified: verifiedOk,
            verified_source: verifiedOk ? "FatSecret" : null,
            verified_confidence: verifiedOk ? verifiedTotals.avgConfidence : null,
            verified_at: verifiedOk ? new Date().toISOString() : null,
            calories: chosenPerServing.calories,
            protein: chosenPerServing.protein,
            carbs: chosenPerServing.carbs,
            fat: chosenPerServing.fat,
            fiber_g: verifiedOk ? verifiedTotals.perServing.fiberG : 0,
            sugar_g: verifiedOk ? verifiedTotals.perServing.sugarG : 0,
            sodium_mg: verifiedOk ? verifiedTotals.perServing.sodiumMg : 0,
          },
          { onConflict: "id" },
        )
        .select("id")
        .single();

      if (recipeError) {
        toast.error(recipeError.message);
        return;
      }

      const id = recipeRow.id as string;
      setRecipeId(id);
      setLoadedPublished(effectivePublished);

      // Replace ingredient rows (simple and reliable for Phase 0).
      const { error: deleteError } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
      if (deleteError) {
        toast.error(deleteError.message);
        return;
      }

      const inserts = cleanedIngredients.map((i, idx) => {
        const est = lineEstimates[idx]!;
        const v = verifiedOk ? verifiedLines![idx] : null;
        const macros = v?.macros ?? null;
        return {
          recipe_id: id,
          ingredient_id: null,
          name: i.name,
          amount: amountToNumeric(i.amount),
          unit: i.unit || null,
          calories: macros?.calories ?? est.calories,
          protein: macros?.protein ?? est.protein,
          carbs: macros?.carbs ?? est.carbs,
          fat: macros?.fat ?? est.fat,
          fiber_g: macros?.fiberG ?? 0,
          sugar_g: macros?.sugarG ?? 0,
          sodium_mg: macros?.sodiumMg ?? 0,
          fatsecret_food_id: v?.fatSecretFoodId ?? null,
          confidence: v?.confidence ?? null,
          is_verified: Boolean(macros),
          source: macros ? "FatSecret" : "Estimated",
        };
      });

      const { error: insertError } = await supabase.from("recipe_ingredients").insert(inserts);
      if (insertError) {
        toast.error(insertError.message);
        return;
      }

      await refreshDiscoverRecipes();
      await refreshMyLibraryRecipes();
      ensureRecipeInLibraryWithKind(id, mode === "create" ? "created" : "imported");
      toast.success(
        effectivePublished ? "Recipe published" : mode === "import" ? "Saved to your library" : "Draft saved",
        {
          description: `${chosenPerServing.calories} kcal · ${chosenPerServing.protein}P · ${chosenPerServing.carbs}C · ${chosenPerServing.fat}F per serving (${verifiedOk ? "verified" : "estimated"})`,
        },
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl">
              {mode === "import" ? (
                <BookPlus className="w-5 h-5 text-white" />
              ) : (
                <ChefHat className="w-5 h-5 text-white" />
              )}
            </div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {mode === "import" ? "Import recipe" : "Create recipe"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "create" && onSwitchToImport ? (
              <button
                type="button"
                onClick={onSwitchToImport}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Import instead
              </button>
            ) : null}
            {mode === "import" && onSwitchToCreate ? (
              <button
                type="button"
                onClick={onSwitchToCreate}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Create instead
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Clear form
            </button>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          {mode === "import"
            ? "Bring in recipes you have access to—cookbooks, blogs, or scans—for your private library. These stay personal copies; you don’t publish them as your own work."
            : "Build an original recipe (typed or from your own photo). Publishing is optional—say when it’s your content. Scanning a cookbook page you bought belongs under Import, not here."}
        </p>
      </div>

      {mode === "create" && onSwitchToImport ? (
        <div className="backdrop-blur-xl bg-violet-50/80 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/50 rounded-2xl p-5 mb-6 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-white mb-1">Not your original recipe?</p>
          <p className="mb-3">
            Use Import for URLs, cookbook scans, or anything you didn’t write yourself—so your library stays honest and
            imports aren’t offered as your creations.
          </p>
          <button
            type="button"
            onClick={onSwitchToImport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:opacity-90"
          >
            <BookPlus className="w-4 h-4" />
            Open Import recipe
          </button>
        </div>
      ) : null}

      {mode === "create" && recipeId && !loadedPublished ? (
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 mb-6 shadow-lg">
          <h3 className="text-slate-900 dark:text-white mb-1">Ready to share?</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            When you go public, other people can discover and save this recipe. Only publish if it’s your original work.
          </p>
          <GoPublicDialog
            recipeTitle={title.trim() || "Untitled recipe"}
            disabled={saving !== null}
            onConfirmPublish={() => void saveRecipe(true)}
          />
        </div>
      ) : null}

      {/* Import from URL (import flow only — create flow uses the callout above) */}
      {mode === "import" ? (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h3 className="text-slate-900 dark:text-white">Import from URL</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            We parse public recipe pages that expose schema.org Recipe data. You review and edit, then save to your
            library only.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.com/recipe"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              disabled={importBusy}
              onClick={() => void runImportFromUrl()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold disabled:opacity-50"
            >
              {importBusy ? "Importing…" : "Import"}
            </button>
          </div>
          {importHint ? <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">{importHint}</p> : null}
        </div>
      ) : null}

      {/* Image Upload — screenshot → cover + optional text extraction */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Recipe photo</label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {mode === "import"
            ? "Paste a screenshot or choose a file. If “Extract from image” is available, it can pull text from a cookbook or card photo—review, then save as an imported library copy."
            : "Paste a screenshot or choose a file. If “Extract from image” is available, it can digitize your own handwritten or typed recipe."}
        </p>
        <div
          role="button"
          tabIndex={0}
          onPaste={(e) => {
            const f = e.clipboardData?.files?.[0];
            if (f) {
              e.preventDefault();
              applyImageFile(f);
            }
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-violet-400 dark:hover:border-violet-600 transition-all bg-slate-50 dark:bg-slate-800/50"
        >
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Recipe cover preview"
              className="w-full max-h-64 object-cover rounded-lg mb-4 mx-auto"
            />
          ) : (
            <>
              <Camera className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">Paste screenshot, or choose a file</p>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="block mx-auto text-sm text-slate-600 dark:text-slate-400"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyImageFile(f);
            }}
          />
          <button
            type="button"
            disabled={ocrBusy}
            onClick={() => void runOcrFromImage()}
            className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {ocrBusy ? "Extracting…" : "Extract from image"}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <h3 className="text-slate-900 dark:text-white mb-6">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Recipe Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., High-Protein Chicken & Rice Bowl"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your recipe..."
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Servings</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Prep (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Cook (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Helps the meal planner place this recipe in the right slot. Lunch and dinner recipes can be swapped
                between those two; breakfast and snack stay separate unless you pick a recipe tagged for both.
              </p>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Tags</label>
              <div className="flex flex-wrap gap-2">
                {["vegetarian", "vegan", "gluten-free", "keto"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setDietary(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
                      dietary.includes(tag)
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-6">
          <h3 className="text-slate-900 dark:text-white">Ingredients</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={splitAllIngredientLines}
              className="px-4 py-2 rounded-lg border border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-950/40"
            >
              Re-split lines
            </button>
            <button
              type="button"
              onClick={addIngredient}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Ingredient
            </button>
          </div>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-4 mb-6 border border-violet-200 dark:border-violet-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800 dark:text-violet-300">
              Nutrition is <span className="font-medium">estimated live</span> below from names, amounts, and units (same
              logic as save). Use <span className="font-medium">Re-split lines</span> after import to fix{" "}
              <code className="text-xs bg-violet-100 dark:bg-violet-900/50 px-1 rounded">500g…</code>,{" "}
              <code className="text-xs bg-violet-100 dark:bg-violet-900/50 px-1 rounded">2×400g tins</code>, or trailing
              fractions. Not lab-verified.
            </p>
          </div>
        </div>

        {matchPickerIdx != null ? (
          <div className="mb-6 rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Change match</h4>
              <button
                type="button"
                onClick={() => {
                  setMatchPickerIdx(null);
                  setMatchHits(null);
                  setBarcodeResult(null);
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">USDA search</p>
                <div className="relative">
                  <input
                    autoFocus
                    value={matchQuery}
                    onChange={(e) => setMatchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void runUsdaSearch(); }}
                    placeholder="Search foods (e.g. red pepper, chicken breast)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white pr-16"
                  />
                  {matchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Results update as you type</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Barcode (Open Food Facts)</p>
                <div className="flex gap-2">
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan / paste barcode"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={barcodeLoading}
                    onClick={() => void runBarcodeLookup()}
                    className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
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
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Scan with camera
                  </button>
                  {scannerError ? <span className="text-xs text-amber-700 dark:text-amber-300">{scannerError}</span> : null}
                </div>
                {scannerOpen ? (
                  <div className="mt-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-black/80 p-3">
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
                  <div className="mt-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/20 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{barcodeResult.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{barcodeResult.servingLabel}</p>
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
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Use
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {matchHits ? (
              <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/20">
                {matchHits.slice(0, 10).map((h) => (
                  <li key={h.fdcId} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{h.description}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
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
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
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
          {ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(18rem,1fr)_auto] sm:items-center sm:gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 bg-white/40 dark:bg-slate-900/20"
            >
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => updateIngredient(ingredient.id, "name", e.target.value)}
                placeholder="Ingredient name"
                className="w-full min-w-0 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <div className="flex flex-wrap items-center justify-start gap-2">
                <input
                  type="text"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(ingredient.id, "amount", e.target.value)}
                  placeholder="Amount"
                  className="w-24 sm:w-28 px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <select
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(ingredient.id, "unit", e.target.value)}
                  className="min-w-[10rem] sm:min-w-[11rem] flex-1 sm:flex-initial px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
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
                  <span
                    className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50"
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
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const idx = ingredients.findIndex((x) => x.id === ingredient.id);
                    const r = resolveStructuredIngredient(ingredient);
                    openMatchPicker(idx, r.name || ingredient.name);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Change match
                </button>
                <button
                  type="button"
                  onClick={() => removeIngredient(ingredient.id)}
                  className="p-3 text-slate-400 hover:text-red-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Remove ingredient"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {nutritionPreview ? (
          <div className="mt-6 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-5">
            {/**
             * Display rounding only (don’t change stored values).
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
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {verifiedTotals ? `Best available (${verifiedTotals.primarySource ?? "Verified"})` : "Estimated (heuristics)"}
              </h4>
              {verifying ? (
                <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-300/80">Updating…</span>
              ) : null}
                  </div>
                  <p className="text-xs text-emerald-800/85 dark:text-emerald-400/85 mb-4">
              {verifiedTotals
                ? `Auto-matched ingredients. Avg confidence: ${Math.round(verifiedTotals.avgConfidence * 100)}%`
                : "Totals use the same estimates as save (including weight parsed from the name when amount is empty)."}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div>
                <p className="text-emerald-700/90 dark:text-emerald-300/90">Whole dish</p>
                <p className="text-lg font-bold text-emerald-950 dark:text-emerald-50">
                  {displayTotals.calories} kcal
                </p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-400/90">
                  P {displayTotals.protein} · C {displayTotals.carbs} · F {displayTotals.fat}
                </p>
                {verifiedTotals ? (
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/90 mt-1">
                    Fiber {displayTotals.fiberG}g · Sugar {displayTotals.sugarG}g · Sodium {displayTotals.sodiumMg}mg
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-emerald-700/90 dark:text-emerald-300/90">Per serving ({Math.max(1, servings)})</p>
                <p className="text-lg font-bold text-emerald-950 dark:text-emerald-50">
                  {displayPerServing.calories} kcal
                </p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-400/90">
                  P {displayPerServing.protein} · C {displayPerServing.carbs} · F {displayPerServing.fat}
                </p>
                {verifiedTotals ? (
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/90 mt-1">
                    Fiber {displayPerServing.fiberG}g · Sugar {displayPerServing.sugarG}g · Sodium{" "}
                    {displayPerServing.sodiumMg}mg
                  </p>
                ) : null}
              </div>
                  </div>

            <div className="mt-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/60 dark:bg-slate-950/20 p-4">
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
                    <div className="mt-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/60 dark:bg-slate-950/20 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-emerald-900 dark:text-emerald-100 uppercase">
                    Nutrition label
                  </p>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Per serving</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/50 p-3">
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Per serving</p>
                    <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-50">
                      {displayPerServing.calories} kcal
                    </p>
                    <div className="mt-2 space-y-1 text-[12px] text-emerald-900/90 dark:text-emerald-200/90">
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
                  <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/50 p-3">
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">Whole dish</p>
                    <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-50">
                      {displayTotals.calories} kcal
                    </p>
                    <div className="mt-2 space-y-1 text-[12px] text-emerald-900/90 dark:text-emerald-200/90">
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
              <ul className="space-y-1 border-t border-emerald-200/60 dark:border-emerald-800/50 pt-2 max-h-40 overflow-y-auto">
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
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Add at least one ingredient name to see estimated calories and macros.
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <h3 className="text-slate-900 dark:text-white mb-4">Cooking Instructions</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="1. First step...&#10;2. Second step...&#10;3. Third step..."
          rows={10}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>

      {/* Actions */}
      {mode === "import" ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Publishing isn’t available on this screen—imported copies are for your account only. To share original work
            with the community, use Create recipe.
          </p>
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => void saveRecipe(false)}
            className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving === "draft" ? "Saving…" : "Save to my library"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/80 dark:bg-slate-900/40">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300"
              checked={attestOriginalWork}
              onChange={(e) => setAttestOriginalWork(e.target.checked)}
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              I created this recipe and I have the right to share it publicly (required to publish).
            </span>
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void saveRecipe(false)}
              className="flex-1 px-6 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === "draft" ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void saveRecipe(true)}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-[1.02] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              {saving === "publish" ? "Publishing…" : "Publish recipe"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
