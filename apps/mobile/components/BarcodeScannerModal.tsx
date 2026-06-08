import React, { useCallback, useMemo, useRef, useState } from "react";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { BarcodeCameraView } from "@/components/BarcodeCameraView";
import { Ionicons } from "@expo/vector-icons";
// ENG-816 — lucide-react-native glyphs replace Ionicons behind the
// `design_system_icons` flag. Per-icon named imports (the established
// pattern across the mobile components dir). The old Ionicons path
// stays alive in the `else` of each site until the flag holds 100%.
import {
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  RefreshCw,
  Search,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { lookupBarcode, scaleMacrosByGrams, submitFoodCorrection, type BarcodeProduct } from "@/lib/verifyRecipe";
import { checkScaledLogPlausibility } from "@suppr/shared/nutrition/macroPlausibility";
import { scaleCorrectionToPer100g, type CorrectionBasis } from "@/lib/barcodeCorrection";
import { useAuth } from "@/context/auth";
import { clampRememberedToServingOptions, getRememberedPortion, recordPortion } from "@/lib/barcodePortionMemory";
import { PortionPicker } from "@/components/PortionPicker";
import {
  buildPickerOptions,
  formatPortion,
  stateToGrams,
  type PortionState,
} from "@suppr/shared/nutrition/portionPicker";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import {
  getMyContributorStats,
  formatHelpedLine,
  type ContributorStats,
} from "@/lib/contributorStats";

// Resolve the API origin once. Suppr's mobile app talks to the same
// Vercel-hosted Next.js routes the web client uses.
const API_BASE: string =
  (Constants.expoConfig?.extra?.supprApiUrl as string | undefined) ?? "https://suppr-club.com";

type Props = {
  visible: boolean;
  onScan: (barcode: string, product: BarcodeProduct) => void;
  onClose: () => void;
  /**
   * Audit 2026-04-30 (Lose It "Closer" parity, Fix 2). When a barcode
   * resolves to "not found", surface a primary "Snap the label
   * instead" CTA that hands off to the AI photo-log path. The host
   * is responsible for closing this scanner and opening
   * `<PhotoLogSheet>` (so Pro gating + analytics stay in one place).
   * Optional — when omitted the fallback button is hidden and the
   * legacy "Enter manually instead" button stays primary.
   */
  onPhotoFallback?: () => void;
  /**
   * F-156 PR-2 (2026-05-10) — when a barcode resolves to "not found",
   * surface an "Add as custom food" CTA that hands off to the
   * CreateCustomFoodSheet pre-filled with the scanned barcode. The
   * host is responsible for closing this scanner and opening the
   * sheet with `initialBarcode={barcode}` (so the saved row writes
   * to `user_foods` with the correct barcode and the next scan
   * resolves successfully). Optional — when omitted the CTA is
   * hidden and the existing manual / scan-label paths stay primary.
   */
  onAddAsCustomFood?: (barcode: string) => void;
};

export default function BarcodeScannerModal({ visible, onScan, onClose, onPhotoFallback, onAddAsCustomFood }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for this sheet's CTAs,
  // preset/basis chips, the scan-frame, search/camera glyphs, and the per-100g
  // link. Threaded into the `styles` useMemo (deps below) so the StyleSheet
  // rebuilds when the flag flips. The correction-success card keeps
  // `Accent.success` (green status), and any source/confidence chrome stays warm.
  const accent = useAccent();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  // ENG-816 — gate the lucide-react-native glyph swap behind
  // `design_system_icons`. When off (default / cold flag), the
  // Ionicons path below renders exactly as before.
  const useLucideIcons = isFeatureEnabled("design_system_icons");
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Portion picker state — Lose It!-style { amount, unit } pair via the
  // shared `portionPicker` state model. Replaces the legacy `gramsInput`
  // string + `logBasis: per100g | perServing` mode toggle (2026-05-13;
  // see docs/decisions/2026-05-13-portion-picker-and-macro-display.md).
  const [pickerState, setPickerState] = useState<PortionState | null>(null);
  // Audit/2026-04-30 — when this barcode has been logged before,
  // surface "You usually log {n} g — using that" near the picker.
  const [rememberedPortion, setRememberedPortion] = useState<number | null>(null);
  const pickerOptions = useMemo(() => {
    if (!product) return null;
    return buildPickerOptions(
      { servingSizeG: product.servingSizeG, servingOptions: product.servingOptions },
      { rememberedGrams: rememberedPortion },
    );
  }, [product, rememberedPortion]);
  const grams = useMemo(() => {
    if (!pickerState) return 100;
    const g = stateToGrams(pickerState);
    return Math.min(10_000, Math.round(g * 10) / 10);
  }, [pickerState]);

  // Manual entry state (when barcode not found)
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [manualServing, setManualServing] = useState("100");

  // P0 (2026-05-26) — physical-plausibility override. Once the user
  // confirms past a "numbers look unusually high" warning, the next Confirm
  // proceeds. Reset on every fresh scan. Parity with barcode.tsx.
  const plausibilityOverrideRef = useRef(false);
  // Holds the latest `onConfirm` so the "Log anyway" branch can re-invoke it
  // without a circular useCallback dependency.
  const onConfirmRef = useRef<() => void>(() => {});

  // Correction mode (edit scanned product data and save to DB)
  const [correctionMode, setCorrectionMode] = useState(false);
  const [corrName, setCorrName] = useState("");
  const [corrCalories, setCorrCalories] = useState("");
  const [corrProtein, setCorrProtein] = useState("");
  const [corrCarbs, setCorrCarbs] = useState("");
  const [corrFat, setCorrFat] = useState("");
  // F-28 (2026-04-21): fiber correction — DB already has `fiber_g`, just
  // wasn't exposed in the form.
  // F-30 (2026-04-21): sugar / sodium / saturated fat — added via migration
  // 20260430100000_user_foods_micros.sql. Empty/zero inputs are dropped from
  // the upsert payload to stay compatible with pre-migration projects.
  const [corrFiber, setCorrFiber] = useState("");
  const [corrSugar, setCorrSugar] = useState("");
  const [corrSodium, setCorrSodium] = useState("");
  const [corrSatFat, setCorrSatFat] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);
  // F-138 (`AcUlNw_4ZTCMGcjmETcQUaJ`, 2026-05-08): post-submit success state.
  // Pre-fix the form silently closed after Save Correction → users had no
  // confirmation their submission was received. Honest copy: it applies to
  // your scans now and goes into the review queue for everyone else.
  const [corrSubmitted, setCorrSubmitted] = useState(false);
  // F-138 Phase 3 — soft "you helped N people" line on the
  // correction-saved success card. Fetched once on submission success
  // (RLS-scoped to submitted_by = auth.uid()). null = not loaded yet,
  // ContributorStats with helpedLine=null = nothing to show on this
  // card (e.g. first-ever submission with no verified history).
  const [contributorStats, setContributorStats] =
    useState<ContributorStats | null>(null);
  // F-138 Phase 2 — server-side plausibility check rejected the submission
  // (e.g. Atwater off by >30%, sugar > carbs, etc.). Surfaced inline so
  // the user can fix and re-submit instead of getting silent failure.
  const [corrBlockReasons, setCorrBlockReasons] = useState<string[] | null>(null);
  // 2026-05-08 build-45 follow-up — "Snap the label instead" now hits
  // /api/nutrition/scan-label, pre-fills the correction form, and routes
  // through Phase 2 plausibility + writes to user_foods. Loading +
  // error states surfaced inline in the not-found empty state.
  const [scanLabelLoading, setScanLabelLoading] = useState(false);
  const [scanLabelError, setScanLabelError] = useState<string | null>(null);
  // F-20 (2026-04-19, TestFlight `AIOek8w6GKW5DdY1XK9avkE`) — many
  // products only list nutrition per serving (e.g. PBfit: per 16 g). The
  // tester typed per-serving numbers into a form that silently stored
  // them as per-100g, wildly inflating calories. New basis toggle lets
  // users choose "Per 100 g" (default) or "Per serving" with a
  // serving-size input; macros scale to per-100g before save so the DB
  // contract is unchanged. Matches Custom Food's established "Per 100 g /
  // Per serving" wording.
  const [corrBasis, setCorrBasis] = useState<CorrectionBasis>("per100g");
  const [corrServingG, setCorrServingG] = useState("");

  const scaled = useMemo(() => {
    if (!product) return null;
    return scaleMacrosByGrams(
      { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat, fiberG: product.fiberG },
      grams,
    );
  }, [product, grams]);

  const onBarcode = useCallback(
    async (e: { data: string }) => {
      if (loading || scanned === e.data) return;
      setScanned(e.data);
      setLoading(true);
      setError(null);
      setProduct(null);
      setManualMode(false);
      plausibilityOverrideRef.current = false;

      const result = await lookupBarcode(e.data);
      setLoading(false);
      if (result) {
        setProduct(result);
        // Audit/2026-04-30 — barcode portion memory.
        const remembered = await getRememberedPortion(e.data);
        const rememberedGrams = remembered != null && remembered > 0
          ? clampRememberedToServingOptions(remembered, result.servingOptions ?? null)
          : null;
        setRememberedPortion(rememberedGrams);
        // The pickerState useEffect below will derive initial state
        // from the new product + remembered portion via
        // `buildPickerOptions`.
      } else {
        setRememberedPortion(null);
        setError("Product not found in database.");
      }
    },
    [loading, scanned],
  );

  // Re-derive pickerState whenever the product changes (or remembered
  // portion arrives). Single source of truth — no manual gram/multiplier
  // conversions strewn across the lookup, reset, and chip-tap paths.
  React.useEffect(() => {
    if (!pickerOptions) {
      setPickerState(null);
      return;
    }
    setPickerState(pickerOptions.initial);
    // We intentionally re-init only when the product (and thus options
    // identity) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // F-18 (2026-04-19, TestFlight `ABs9n0AyFkA8VeH7WPbwdGE`) — when OFF
  // gives no real label serving the builder falls back to a generic
  // `1 serving (N g)` chip. Saying "1 serving" is meaningless when the
  // product has no manufacturer serving, so collapse that display to
  // the gram weight alone. Pattern matches both the literal fallback
  // string and the close-paren form so we don't accidentally strip a
  // true label like "1 cup (240 g)".
  const GENERIC_1_SERVING_LABEL = /^1\s+serving\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)\s*$/i;

  // F-135 (`ADU-JU-1zRIm2WQBeovKEjA`, 2026-05-08): "11.33 rice papers"
  // chip uses absurd decimal precision. When the leading number on a
  // count label has a small fractional residual (e.g. 11.03 / 11.97),
  // collapse to the integer. Keeps meaningful halves (1.5 cups,
  // 0.5 tablespoon) intact via the > 0.1 && < 0.9 guard.
  const TIDY_COUNT_LABEL_RE = /^(\d+)\.(\d+)(\s+\S.*)$/;
  const tidyDecimalCount = useCallback((label: string): string => {
    const m = TIDY_COUNT_LABEL_RE.exec(label.trim());
    if (!m) return label;
    const intPart = Number(m[1]);
    const frac = Number(`0.${m[2]}`);
    if (!Number.isFinite(intPart) || !Number.isFinite(frac)) return label;
    if (frac < 0.1) return `${intPart}${m[3]}`;
    if (frac > 0.9) return `${intPart + 1}${m[3]}`;
    return label;
  }, []);

  const displayServingLabel = useCallback((label: string, grams: number): string => {
    if (GENERIC_1_SERVING_LABEL.test(label.trim())) {
      return `${Math.round(grams)} g`;
    }
    return tidyDecimalCount(label);
  }, [tidyDecimalCount]);

  const portionSummary = useMemo(() => {
    const opts = product?.servingOptions ?? [];
    const hit = opts.find((o) => Math.abs(o.grams - grams) < 0.51);
    if (hit) return displayServingLabel(hit.label, hit.grams);
    return `${grams} g`;
  }, [product, grams, displayServingLabel]);

  const onConfirm = useCallback(() => {
    if (scanned && product && scaled) {
      // P0 (2026-05-26) — physical-plausibility guard before handing the
      // scaled product to the host (which writes nutrition_entries). Catches
      // the OFF per-serving-basis bug. Soft-flag: warn + let the user edit or
      // confirm; never silently pass a physically-impossible row, never hard-
      // block a legit edge food. `product.{calories,…}` is the per-100g panel
      // for the source-basis cross-check. Parity with barcode.tsx.
      const plausibility = checkScaledLogPlausibility(
        { calories: scaled.calories, protein: scaled.protein, carbs: scaled.carbs, fat: scaled.fat },
        grams,
        { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat },
      );
      if ((!plausibility.ok || product.basisCorrected) && !plausibilityOverrideRef.current) {
        const warnKcal = Math.round(scaled.calories);
        // protein is already rounded to 0.1 g by scaleMacrosByGrams; toFixed
        // keeps the warning copy whole-gram (the display tiles use formatMacro).
        const warnProtein = scaled.protein.toFixed(0);
        const warnGrams = Math.round(grams);
        Alert.alert(
          "Double-check these numbers",
          `${warnKcal} kcal and ${warnProtein} g protein for ${warnGrams} g looks unusually high — this product's label data may be per serving, not per 100 g. Edit the values or amount if they look wrong.`,
          [
            {
              text: "Edit",
              style: "cancel",
              onPress: () => {
                setCorrName(product.name);
                setCorrCalories(String(product.calories));
                setCorrProtein(String(product.protein));
                setCorrCarbs(String(product.carbs));
                setCorrFat(String(product.fat));
                setCorrectionMode(true);
              },
            },
            {
              text: "Log anyway",
              onPress: () => {
                plausibilityOverrideRef.current = true;
                // Re-run with the override set; the ref short-circuits the
                // warning on the second pass.
                queueMicrotask(onConfirmRef.current);
              },
            },
          ],
        );
        return;
      }
      // Pass a scaled product to the parent
      // F-13 (2026-04-19) — preserve caffeine/alcohol per 100 g from the
      // OFF lookup so the host screen can call `scaleCaffeineAlcohol` on
      // commit and auto-track the daily totals. These are NOT pre-scaled
      // — the per-100 g reference is what the commit path needs.
      const scaledProduct: BarcodeProduct = {
        ...product,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiberG: scaled.fiberG ?? 0,
        servingSizeG: grams,
        portionSummary,
      };
      track(AnalyticsEvents.barcode_lookup, { barcode: scanned });
      // Audit/2026-04-30 — remember this portion for the next scan.
      // The host LogSheet does the actual nutrition_entries insert
      // (and runs `writeMealToHealthKitIfEnabled` when wired); the
      // memory only needs the barcode + grams the user committed to.
      void recordPortion(scanned, grams);
      onScan(scanned, scaledProduct);
      setScanned(null);
      setProduct(null);
      setPickerState(null);
      setRememberedPortion(null);
    }
  }, [scanned, product, scaled, grams, portionSummary, onScan]);
  onConfirmRef.current = onConfirm;

  const onManualSubmit = useCallback(() => {
    const cal = Number(manualCalories) || 0;
    if (!manualName.trim() || cal <= 0) return;
    const manualProduct: BarcodeProduct = {
      name: manualName.trim(),
      calories: Math.round(cal),
      protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(manualFat) || 0) * 10) / 10,
      fiberG: 0,
      servingSizeG: Number(manualServing) || 100,
    };
    onScan(scanned ?? "manual", manualProduct);
    // Reset
    setScanned(null);
    setProduct(null);
    setManualMode(false);
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setManualServing("100");
  }, [scanned, manualName, manualCalories, manualProtein, manualCarbs, manualFat, manualServing, onScan]);

  const openCorrectionMode = useCallback(() => {
    if (!product) return;
    setCorrName(product.name);
    setCorrCalories(String(product.calories));
    setCorrProtein(String(product.protein));
    setCorrCarbs(String(product.carbs));
    setCorrFat(String(product.fat));
    setCorrFiber(product.fiberG != null ? String(product.fiberG) : "");
    setCorrSugar(product.sugarG != null ? String(product.sugarG) : "");
    setCorrSodium(product.sodiumMg != null ? String(product.sodiumMg) : "");
    setCorrSatFat(product.saturatedFatG != null ? String(product.saturatedFatG) : "");
    // F-20 — default to per-100g because that matches the DB contract
    // and the existing product fields we just copied in.
    setCorrBasis("per100g");
    setCorrServingG(
      product.servingSizeG && product.servingSizeG > 0
        ? String(Math.round(product.servingSizeG))
        : "",
    );
    setCorrectionMode(true);
  }, [product]);

  // F-20 — derived per-100g values from whatever basis the user picked.
  // Delegates to the pure `scaleCorrectionToPer100g` helper so mobile
  // and any future surface share the same rounding + validity rules.
  const corrPer100g = useMemo(
    () =>
      scaleCorrectionToPer100g({
        basis: corrBasis,
        calories: Number(corrCalories) || 0,
        protein: Number(corrProtein) || 0,
        carbs: Number(corrCarbs) || 0,
        fat: Number(corrFat) || 0,
        servingGrams: Number(corrServingG) || 0,
      }),
    [corrBasis, corrCalories, corrProtein, corrCarbs, corrFat, corrServingG],
  );

  const submitCorrection = useCallback(async () => {
    if (!scanned || !userId) return;
    if (!corrName.trim() || corrPer100g == null) return;
    setCorrSaving(true);
    const per100 = corrPer100g;
    // F-28 + F-30 — micros are entered per the user's chosen basis (same as
    // macros) and scaled to per-100g using the serving-size when basis=perServing.
    const scaleMicro = (val: number, roundTo: 0 | 1): number => {
      const factor = roundTo === 0 ? 1 : 10;
      if (corrBasis === "perServing" && Number(corrServingG) > 0) {
        return Math.round(((val / Number(corrServingG)) * 100) * factor) / factor;
      }
      return Math.round(val * factor) / factor;
    };
    const fiberPer100g = scaleMicro(Number(corrFiber) || 0, 1);
    const sugarPer100g = scaleMicro(Number(corrSugar) || 0, 1);
    const sodiumPer100g = scaleMicro(Number(corrSodium) || 0, 0); // mg, whole numbers
    const satFatPer100g = scaleMicro(Number(corrSatFat) || 0, 1);
    const result = await submitFoodCorrection({
      barcode: scanned,
      name: corrName.trim(),
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      fiberG: fiberPer100g > 0 ? fiberPer100g : undefined,
      sugarG: sugarPer100g > 0 ? sugarPer100g : undefined,
      sodiumMg: sodiumPer100g > 0 ? sodiumPer100g : undefined,
      saturatedFatG: satFatPer100g > 0 ? satFatPer100g : undefined,
      userId,
    });
    setCorrSaving(false);
    if (result.ok) {
      // Update the product in place with corrected data (always stored
      // as per-100g so downstream scaling is consistent).
      const corrected: BarcodeProduct = {
        name: corrName.trim(),
        calories: per100.calories,
        protein: per100.protein,
        carbs: per100.carbs,
        fat: per100.fat,
        fiberG: fiberPer100g > 0 ? fiberPer100g : (product?.fiberG ?? 0),
        sugarG: sugarPer100g > 0 ? sugarPer100g : (product?.sugarG ?? null),
        sodiumMg: sodiumPer100g > 0 ? sodiumPer100g : (product?.sodiumMg ?? null),
        saturatedFatG: satFatPer100g > 0 ? satFatPer100g : (product?.saturatedFatG ?? null),
        servingSizeG:
          corrBasis === "perServing" && Number(corrServingG) > 0
            ? Number(corrServingG)
            : (product?.servingSizeG ?? 100),
      };
      setProduct(corrected);
      setCorrBlockReasons(null);
      // F-138 — show success state in place of the form. User taps Done
      // to dismiss back to the product card with their corrected values.
      setCorrSubmitted(true);
      // F-138 Phase 3 — fetch the contributor stats so the success card
      // can show the "you helped N people" line. Fire-and-forget: a
      // failure here just hides the line, never blocks the success UX.
      // Lazy-import supabase so the test runtime (which doesn't load
      // env vars) doesn't throw at module-eval time.
      if (userId) {
        void (async () => {
          try {
            const { supabase } = await import("@/lib/supabase");
            const stats = await getMyContributorStats(supabase, userId);
            setContributorStats(stats);
          } catch {
            /* silently keep contributorStats=null */
          }
        })();
      }
    } else if (result.error === "plausibility_blocked" && result.reasons) {
      // F-138 Phase 2 — plausibility gate rejected the submission. Surface
      // the specific reasons so the user can fix and re-submit.
      setCorrBlockReasons(result.reasons);
    }
  }, [scanned, userId, corrName, corrPer100g, corrBasis, corrServingG, product]);

  const onReset = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setCorrSubmitted(false);
    setCorrBlockReasons(null);
    setContributorStats(null);
    setScanLabelError(null);
    setPickerState(null);
    setRememberedPortion(null);
  }, []);

  const handleClose = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setCorrSubmitted(false);
    setCorrBlockReasons(null);
    setContributorStats(null);
    setScanLabelError(null);
    setPickerState(null);
    setRememberedPortion(null);
    onClose();
  }, [onClose]);

  // F-138 — dismiss the success state back to the product card with the
  // user's corrected values applied (already set by submitCorrection).
  const handleCorrectionDone = useCallback(() => {
    setCorrSubmitted(false);
    setCorrectionMode(false);
    // Re-derive picker initial state from the (now corrected) product.
    if (pickerOptions) setPickerState(pickerOptions.initial);
  }, [pickerOptions]);

  // 2026-05-08 build-47 follow-up — "Log this now" path on the
  // correction-saved success state. Closes the success card, exits
  // correction mode, and immediately fires `onConfirm` against the
  // updated product (which has the corrected per-100g macros from
  // `submitCorrection`). Default portion: one serving when serving
  // size is known, else 100 g.
  const handleCorrectionLogNow = useCallback(() => {
    if (!product) {
      handleCorrectionDone();
      return;
    }
    setCorrSubmitted(false);
    setCorrectionMode(false);
    // Pre-set the picker to the corrected product's default portion so
    // the user can verify/adjust before confirming. We DO NOT auto-fire
    // onConfirm here because the user might want to tweak the portion
    // (1 piece vs 2). Returning to the product card with the right
    // default is the right balance between "auto-log" and "user
    // agency".
    if (pickerOptions) setPickerState(pickerOptions.initial);
  }, [product, handleCorrectionDone, pickerOptions]);

  // 2026-05-08 build-45 follow-up — "Snap the label instead" handler.
  // Captures a photo, posts to /api/nutrition/scan-label, pre-fills
  // the correctionMode form fields with extracted per-100g values,
  // and switches into correctionMode. The user reviews and taps Save
  // Correction, which routes through Phase 2 plausibility + writes
  // to user_foods (so the next scan of this barcode hits the canonical
  // table or the user's own pending row instead of failing again).
  const handleSnapLabel = useCallback(async () => {
    if (!scanned || !userId) return;
    setScanLabelError(null);
    // Camera permission is granted via the barcode camera already, but
    // ImagePicker uses its own permission. Ask politely.
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setScanLabelError("Camera permission needed to snap the label.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setScanLabelLoading(true);
    try {
      const asset = result.assets[0];
      const fd = new FormData();
      // RN's FormData wants a `{ uri, name, type }` object, not a Blob.
      // Casting to `any` is the established pattern across the codebase
      // for this RN-native FormData shape.
      fd.append(
        "image",
        ({
          uri: asset.uri,
          name: "label.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as unknown) as Blob,
      );
      fd.append("barcode", scanned);

      const { supabase } = await import("@/lib/supabase");
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;

      const ac = new AbortController();
      const clientTimeout = setTimeout(() => ac.abort(), 50_000);
      let resp: Response;
      try {
        resp = await fetch(`${API_BASE}/api/nutrition/scan-label`, {
          method: "POST",
          body: fd,
          signal: ac.signal,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
      } finally {
        clearTimeout(clientTimeout);
      }
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        const msg =
          (typeof data?.message === "string" && data.message) ||
          "Couldn't read the label. Try a sharper, well-lit photo of the nutrition panel.";
        setScanLabelError(msg);
        return;
      }

      // Pre-fill the correctionMode form with extracted per-100g values.
      setCorrName(typeof data.name === "string" && data.name ? data.name : "");
      setCorrBasis("per100g");
      setCorrServingG(
        data.servingSizeG != null ? String(Math.round(Number(data.servingSizeG))) : "",
      );
      setCorrCalories(String(Math.round(Number(data.calories) || 0)));
      setCorrProtein(String(Math.round((Number(data.protein) || 0) * 10) / 10));
      setCorrCarbs(String(Math.round((Number(data.carbs) || 0) * 10) / 10));
      setCorrFat(String(Math.round((Number(data.fat) || 0) * 10) / 10));
      setCorrFiber(String(Math.round((Number(data.fiberG) || 0) * 10) / 10));
      setCorrSugar(
        data.sugarG != null && Number(data.sugarG) > 0
          ? String(Math.round(Number(data.sugarG) * 10) / 10)
          : "",
      );
      setCorrSodium(
        data.sodiumMg != null && Number(data.sodiumMg) > 0
          ? String(Math.round(Number(data.sodiumMg)))
          : "",
      );
      setCorrSatFat(
        data.saturatedFatG != null && Number(data.saturatedFatG) > 0
          ? String(Math.round(Number(data.saturatedFatG) * 10) / 10)
          : "",
      );
      // Mock the not-found product into a draft so the form can render
      // (correctionMode requires `product` to be non-null).
      setProduct({
        name: typeof data.name === "string" && data.name ? data.name : "Scanned product",
        calories: Math.round(Number(data.calories) || 0),
        protein: Math.round((Number(data.protein) || 0) * 10) / 10,
        carbs: Math.round((Number(data.carbs) || 0) * 10) / 10,
        fat: Math.round((Number(data.fat) || 0) * 10) / 10,
        fiberG: Math.round((Number(data.fiberG) || 0) * 10) / 10,
        servingSizeG: Number(data.servingSizeG) || 100,
      });
      setError(null);
      setCorrectionMode(true);

      try {
        track(AnalyticsEvents.barcode_scan_label_succeeded, {
          confidence: typeof data.confidence === "string" ? data.confidence : "unknown",
          platform: "ios",
        });
      } catch {
        /* noop */
      }
    } catch {
      setScanLabelError(
        "Couldn't reach the AI service. Check your connection and try again.",
      );
    } finally {
      setScanLabelLoading(false);
    }
  }, [scanned, userId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    centered: { alignItems: "center", justifyContent: "center", flex: 1, gap: Spacing.md, padding: Spacing.xl },
    permText: { color: colors.textSecondary, fontSize: 16, textAlign: "center" },
    permBtn: {
      backgroundColor: accent.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: 14,
    },
    permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    cameraWrap: { flex: 1, position: "relative" },
    camera: { flex: 1 },
    scanFrame: {
      position: "absolute",
      top: "25%",
      left: "10%",
      width: "80%",
      height: "50%",
      borderWidth: 2,
      borderColor: accent.primary + "80",
      borderRadius: Radius.lg,
    },
    // F-134 (2026-05-08): when the camera collapses on result, the
    // resultArea takes over the freed space so content doesn't float
    // at the top of the screen with a big empty void below.
    resultArea: { flex: 1, minHeight: 200, padding: Spacing.xl },
    lookupText: { color: colors.textSecondary, fontSize: 14 },
    errorText: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },
    retryBtn: {
      borderWidth: 1,
      borderColor: accent.primary + "55",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    retryBtnText: { color: accent.primary, fontWeight: "600" },
    productCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    productHead: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    productName: { fontSize: 16, fontWeight: "700", color: colors.text, letterSpacing: -0.3, lineHeight: 21 },
    // 2026-05-13 portion-picker rebuild — 4-tile macro grid (kcal /
    // protein / carbs / fat) matching the mockup at
    // /tmp/barcode-redesign.html. Replaces the legacy single-line
    // `macroRow` text aggregate.
    macroTiles: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    macroTile: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    macroTileDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    macroTileNum: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.5,
      lineHeight: 20,
      fontVariant: ["tabular-nums"],
    },
    macroTileNumKcal: { color: Accent.warning },
    macroTileLabel: {
      marginTop: 4,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.textSecondary,
    },
    productBody: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    macroRow: { flexDirection: "row", gap: Spacing.lg },
    macroItem: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
    per100g: { fontSize: 12, color: colors.textTertiary },
    servingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    servingLabel: { fontSize: 13, color: colors.textSecondary },
    servingInput: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 15,
      backgroundColor: colors.inputBg,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      minWidth: 56,
      textAlign: "center",
    },
    servingUnit: { fontSize: 13, color: colors.textSecondary },
    servingStepperWrap: { flexShrink: 1 },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: accent.primary + "40",
    },
    presetChipSelected: {
      backgroundColor: accent.primary + "18",
      borderColor: accent.primary,
    },
    presetChipText: { fontSize: 11, fontWeight: "600", color: accent.primary },
    // F-18 (2026-04-19) — reduced top margin ~8px so the Log/Scan-again
    // pair sits tighter below the chip row.
    btnRow: { flexDirection: "row", gap: Spacing.sm, marginTop: 0 },
    useBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: Accent.success,
      borderRadius: Radius.md,
      height: 44,
    },
    useBtnText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: -0.1 },
    // 2026-05-13 portion-picker rebuild — "Scan again" is now an icon-
    // only 44x44 square so it shares height with the primary CTA and
    // doesn't wrap on narrow product names. See mockup.
    scanAgainBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    scanAgainText: { color: colors.textSecondary, fontWeight: "600" },
    hintText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingTop: Spacing.lg,
    },
    // Manual entry styles
    manualCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    manualTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    manualSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: -4 },
    manualInput: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 15,
    },
    manualInputRow: { flexDirection: "row", gap: Spacing.sm },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: "none",
    },
    manualSubmitBtn: {
      backgroundColor: accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    manualSubmitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    manualEntryBtn: {
      borderWidth: 1,
      borderColor: accent.primary + "55",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
      marginTop: Spacing.xs,
    },
    manualEntryBtnText: { color: accent.primary, fontWeight: "600", textAlign: "center" },
    // Audit 2026-04-30 — primary "Snap the label instead" CTA in the
    // not-found branch. Filled tint marks it as the recommended next
    // step; manual entry stays one tap away as a tinted-border ghost.
    photoFallbackBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: accent.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    photoFallbackBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    // F-20 basis toggle — segmented-style chip row for Per 100 g / Per serving.
    basisRow: { flexDirection: "row", gap: Spacing.sm },
    basisChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.inputBg,
    },
    basisChipSelected: {
      borderColor: accent.primary,
      backgroundColor: accent.primary + "18",
    },
    basisChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    basisChipTextSelected: { color: accent.primary },
    // F-138 — post-submit success card (replaces the form, not the whole
    // sheet). White-card + soft success ring + Done button. Mirrors the
    // F-139 goals-hit banner restyle so the language stays consistent
    // across the product.
    correctionSuccessCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Accent.success + "40",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xxl,
      alignItems: "center",
      gap: Spacing.md,
    },
    correctionSuccessIconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Accent.success + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    correctionSuccessTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    correctionSuccessBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },
    // F-138 Phase 3 — soft contributor-stats line below the body copy.
    // Subdued visual weight (textTertiary + smaller font) so it reads
    // as a footnote, not the headline. Decision doc: "soft, not
    // leaderboard-y".
    correctionSuccessHelpedLine: {
      fontSize: 13,
      lineHeight: 18,
      color: Accent.success,
      textAlign: "center",
      fontWeight: "600",
    },
    correctionSuccessDoneBtn: {
      marginTop: Spacing.sm,
      backgroundColor: Accent.success,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: 14,
      alignSelf: "stretch",
      alignItems: "center",
    },
    correctionSuccessDoneText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    // 2026-05-08 build-47 follow-up — secondary "Just done" button on
    // the correction-saved success state, paired with the new primary
    // "Log this now" CTA. Subdued visual weight so the auto-log path
    // is the visually-recommended next step.
    correctionSuccessDoneSecondary: {
      marginTop: Spacing.sm,
      backgroundColor: "transparent",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: 12,
      alignSelf: "stretch",
      alignItems: "center",
    },
    correctionSuccessDoneSecondaryText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 14,
    },
    // F-138 Phase 2 — plausibility-block error surface. Tinted destructive
    // panel inside the form, above the Save button, with a per-reason list.
    plausibilityBlockBox: {
      backgroundColor: Accent.destructive + "12",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Accent.destructive + "55",
      padding: Spacing.md,
      gap: 4,
    },
    plausibilityBlockTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: Accent.destructive,
    },
    plausibilityBlockReason: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
    },
    plausibilityBlockHint: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: "italic",
      marginTop: 4,
    },
    basisReference: {
      fontSize: 12,
      color: colors.textTertiary,
      fontVariant: ["tabular-nums"],
    },
  }), [colors, accent]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Barcode</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            {useLucideIcons ? (
              <X size={24} color={colors.text} />
            ) : (
              <Ionicons name="close" size={24} color={colors.text} />
            )}
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.centered}>
            {useLucideIcons ? (
              <Camera size={48} color={colors.textSecondary} />
            ) : (
              <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
            )}
            <Text style={styles.permText}>Camera access needed to scan barcodes</Text>
            <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/*
              F-134 (`AH2YKLI84Fc` + 3 siblings, 2026-05-08): hide the
              camera + scanFrame entirely when there's any result state
              (loading / error / product / manualMode / correctionMode).
              Pre-fix the camera kept rendering as a thin strip when the
              productCard pushed up; the absolute-positioned `scanFrame`
              (top:25%, height:50% of cameraWrap) became a tiny floating
              rounded rectangle above the result — Grace called this
              "everything is overlapping and ugly" on 4 of 11 build-44
              screenshots. Once the user has a result, the camera adds
              no value (scanning is disabled via `!scanned`); collapsing
              the area gives the result the full surface.
            */}
            {!scanned && !manualMode && !correctionMode && (
              <View style={styles.cameraWrap}>
                <BarcodeCameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerEnabled={!scanned}
                  barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                  onBarcodeScanned={scanned ? undefined : onBarcode}
                />
                <View style={styles.scanFrame} />
              </View>
            )}

            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.resultArea}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={accent.primary} />
                  <Text style={styles.lookupText}>Looking up product...</Text>
                </View>
              )}

              {/* 2026-05-13 (TF feedback `ABEVEqEM0qYAJ3QqnI1TN2U` —
                  "scan barcode screen is still very ugly and badly
                  laid out"): added `!product` gate so the not-found
                  empty-state and a success product card cannot
                  render simultaneously. The previous render path
                  could double-paint when state held both
                  `error="Product not found"` AND a stale `product`
                  from a prior scan, producing the stacked "ugly"
                  layout in the screenshot. Product card takes
                  precedence; error renders only when there's no
                  product to show. */}
              {error && !product && !manualMode && (
                <View style={styles.centered}>
                  {/* F-136 (`AG5LqMGUpER2Gqi5N03_ytc`, 2026-05-08): the
                      "Product not found" branch isn't a real error — it
                      surfaces information ("we don't have this in our
                      DB yet"). Pre-fix used red `alert-circle` icon,
                      which read as a failure to the tester. Use a
                      neutral information icon for the not-found case;
                      keep the red destructive icon for genuine
                      errors (network, etc.) where the raw `error`
                      string is shown. */}
                  {error === "Product not found in database." ? (
                    useLucideIcons ? (
                      <Search size={32} color={accent.primary} />
                    ) : (
                      <Ionicons name="search-outline" size={32} color={accent.primary} />
                    )
                  ) : useLucideIcons ? (
                    <CircleAlert size={32} color={Accent.destructive} />
                  ) : (
                    <Ionicons name="alert-circle" size={32} color={Accent.destructive} />
                  )}
                  {/*
                    P1 (customer-lens 2026-05-11) — not-found state was
                    three equal-weight CTAs ("Snap the label", "Add as
                    custom food", "Enter manually") that read as
                    near-synonyms. The user couldn't tell which one
                    actually saved the product for future scans.

                    New hierarchy reflects user intent at this moment:
                    - PRIMARY: "Add this product" → opens
                      CreateCustomFoodSheet (saves to user_foods, so
                      the next scan of this barcode resolves)
                    - SECONDARY (filled-outline): "Scan the label" →
                      AI-OCR fast-fill of the same Custom Food form
                    - TERTIARY (text link): "Just log it once" →
                      inline manual form, doesn't save (one-off log)

                    Copy also explains the 'save' benefit so the user
                    understands why primary > secondary > tertiary.
                  */}
                  <Text style={styles.errorText}>
                    {error === "Product not found in database."
                      ? "We don't have this product yet."
                      : error}
                  </Text>
                  {error === "Product not found in database." && (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: -Spacing.sm,
                        marginBottom: Spacing.sm,
                        lineHeight: 17,
                      }}
                    >
                      Add it to your library so the next scan recognises it.
                    </Text>
                  )}

                  {/* PRIMARY — Add this product (saves to user_foods).
                      F-156 PR-2 (2026-05-10) wired the
                      onAddAsCustomFood callback; this is just a
                      promotion from tertiary text-link to primary CTA. */}
                  {onAddAsCustomFood && scanned && error === "Product not found in database." && (
                    <Pressable
                      onPress={() => {
                        const code = scanned;
                        onAddAsCustomFood(code);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Add this product to your food library"
                      testID="barcode-not-found-add-custom-food"
                      style={styles.photoFallbackBtn}
                    >
                      {useLucideIcons ? (
                        <CirclePlus size={18} color="#fff" />
                      ) : (
                        <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      )}
                      <Text style={styles.photoFallbackBtnText}>Add this product</Text>
                    </Pressable>
                  )}

                  {/* SECONDARY — Scan the label (AI-OCR helper). Was
                      the primary CTA pre-2026-05-11; demoted to
                      secondary because "Add this product" is the
                      higher-intent path for most users. Renders as a
                      filled-outline button (tinted bg, no fill) so the
                      visual hierarchy reads primary → secondary at a
                      glance.

                      F-136 + 2026-05-08: this fires the
                      /api/nutrition/scan-label endpoint and pre-fills
                      the Correct-Product form so the contribution
                      persists to user_foods. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Scan the nutrition label instead"
                    testID="barcode-not-found-photo-fallback"
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: Spacing.sm,
                      backgroundColor: accent.primary + "1f",
                      borderColor: accent.primary,
                      borderWidth: 1,
                      borderRadius: Radius.md,
                      paddingHorizontal: Spacing.xl,
                      paddingVertical: 11,
                      marginTop: Spacing.md,
                      opacity: scanLabelLoading ? 0.7 : pressed ? 0.85 : 1,
                    })}
                    onPress={handleSnapLabel}
                    disabled={scanLabelLoading}
                  >
                    {scanLabelLoading ? (
                      <ActivityIndicator color={accent.primary} size="small" />
                    ) : useLucideIcons ? (
                      <Camera size={18} color={accent.primary} />
                    ) : (
                      <Ionicons name="camera-outline" size={18} color={accent.primary} />
                    )}
                    <Text style={{ color: accent.primary, fontWeight: "700", fontSize: 14 }}>
                      {scanLabelLoading ? "Reading label..." : "Scan the label"}
                    </Text>
                  </Pressable>
                  {scanLabelError && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{
                        color: Accent.destructive,
                        fontSize: 12,
                        textAlign: "center",
                        paddingTop: Spacing.sm,
                      }}
                    >
                      {scanLabelError}
                    </Text>
                  )}

                  {/* TERTIARY — one-off log, doesn't save to library. */}
                  <Pressable
                    onPress={() => setManualMode(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Log macros once without saving the product"
                    style={{ paddingTop: Spacing.md }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500", textDecorationLine: "underline" }}>
                      Just log it once
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onReset}
                    accessibilityRole="button"
                    accessibilityLabel="Scan a different barcode"
                    style={{ paddingTop: Spacing.xs }}
                  >
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      Scan a different barcode
                    </Text>
                  </Pressable>
                </View>
              )}

              {manualMode && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.manualCard}>
                      <Text style={styles.manualTitle}>Add Item Manually</Text>
                      <Text style={styles.manualSubtitle}>
                        {scanned ? `Barcode: ${scanned}` : "Enter the nutrition info from the label"}
                      </Text>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Food name"
                        placeholderTextColor={colors.textTertiary}
                        value={manualName}
                        onChangeText={setManualName}
                        autoFocus
                      />
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Calories"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualCalories}
                          onChangeText={setManualCalories}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Serving (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualServing}
                          onChangeText={setManualServing}
                        />
                      </View>
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Protein (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualProtein}
                          onChangeText={setManualProtein}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Carbs (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualCarbs}
                          onChangeText={setManualCarbs}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Fat (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualFat}
                          onChangeText={setManualFat}
                        />
                      </View>
                      <Pressable
                        style={[styles.manualSubmitBtn, { opacity: manualName.trim() && Number(manualCalories) > 0 ? 1 : 0.4 }]}
                        onPress={onManualSubmit}
                        disabled={!manualName.trim() || !(Number(manualCalories) > 0)}
                      >
                        <Text style={styles.manualSubmitText}>Add to Tracker</Text>
                      </Pressable>
                      <Pressable style={styles.scanAgainBtn} onPress={onReset}>
                        <Text style={styles.scanAgainText}>Back to scanner</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {product && scaled && !correctionMode && (
                <View style={styles.productCard}>
                  <View style={styles.productHead}>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  </View>
                  <View style={styles.macroTiles}>
                    <View style={styles.macroTile}>
                      <Text style={[styles.macroTileNum, styles.macroTileNumKcal]}>{Math.round(scaled.calories)}</Text>
                      <Text style={styles.macroTileLabel}>kcal</Text>
                    </View>
                    <View style={styles.macroTileDivider} />
                    <View style={styles.macroTile}>
                      <Text style={styles.macroTileNum}>{formatMacro(scaled.protein, "protein", "g")}</Text>
                      <Text style={styles.macroTileLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroTileDivider} />
                    <View style={styles.macroTile}>
                      <Text style={styles.macroTileNum}>{formatMacro(scaled.carbs, "carbs", "g")}</Text>
                      <Text style={styles.macroTileLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroTileDivider} />
                    <View style={styles.macroTile}>
                      <Text style={styles.macroTileNum}>{formatMacro(scaled.fat, "fat", "g")}</Text>
                      <Text style={styles.macroTileLabel}>Fat</Text>
                    </View>
                  </View>
                  <View style={styles.productBody}>
                    {pickerState && pickerOptions ? (
                      <PortionPicker
                        product={{ servingSizeG: product.servingSizeG, servingOptions: product.servingOptions }}
                        value={pickerState}
                        onChange={setPickerState}
                        options={pickerOptions}
                        rememberedGrams={rememberedPortion}
                        macrosPer100g={{
                          calories: product.calories,
                          protein: product.protein,
                          carbs: product.carbs,
                          fat: product.fat,
                          fiberG: product.fiberG,
                        }}
                        basisCorrected={product.basisCorrected}
                      />
                    ) : null}
                    {rememberedPortion != null && rememberedPortion > 0 ? (
                      <Text style={[styles.per100g, { marginTop: Spacing.sm, color: accent.primary }]}>
                        You usually log {Math.round(rememberedPortion)} g — using that.
                      </Text>
                    ) : null}
                    <View style={[styles.btnRow, { marginTop: Spacing.md }]}>
                      <Pressable style={styles.useBtn} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Log this portion">
                        {useLucideIcons ? (
                          <Check size={16} color="#fff" />
                        ) : (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                        <Text style={styles.useBtnText} numberOfLines={1} ellipsizeMode="tail">
                          Log · {pickerState ? formatPortion(pickerState) : portionSummary.replace(/\s*\(~?[\d.]+\s*g\)\s*$/, "")}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.scanAgainBtn} onPress={onReset} accessibilityRole="button" accessibilityLabel="Scan again">
                        {useLucideIcons ? (
                          <RefreshCw size={20} color={colors.textSecondary} />
                        ) : (
                          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                        )}
                      </Pressable>
                    </View>
                    <Pressable onPress={openCorrectionMode} style={{ alignItems: "center", paddingTop: Spacing.md }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, textDecorationLine: "underline" }}>This is wrong — edit and update</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Correction mode — edit scanned product and save to DB */}
              {product && correctionMode && corrSubmitted && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.correctionSuccessCard}>
                      <View style={styles.correctionSuccessIconRing}>
                        {useLucideIcons ? (
                          <CircleCheck size={48} color={Accent.success} />
                        ) : (
                          <Ionicons name="checkmark-circle" size={48} color={Accent.success} />
                        )}
                      </View>
                      <Text style={styles.correctionSuccessTitle}>Correction saved</Text>
                      <Text style={styles.correctionSuccessBody}>
                        Your numbers apply to your scans of this barcode now.
                        We{"’"}re building out a review process — once it{"’"}s
                        live, the best corrections will roll out to everyone.
                      </Text>
                      {/* F-138 Phase 3 — soft "you helped N people" line.
                          Hidden when the user has no verified history yet
                          (first submission shows nothing here rather than
                          "You helped 0 people"). */}
                      {(() => {
                        if (!contributorStats) return null;
                        const line = formatHelpedLine(contributorStats);
                        if (!line) return null;
                        return (
                          <Text style={styles.correctionSuccessHelpedLine}>
                            {line}
                          </Text>
                        );
                      })()}
                      {/* 2026-05-08 build-47 follow-up — Grace's TF
                          feedback `AEzXpj7cEtWzcmRM391H1pM`: "When I save
                          a new item I should be able to auto log it not
                          have to scan it again". Primary CTA logs the
                          freshly-corrected product immediately at one
                          serving (or 100 g when no serving size known).
                          Secondary stays as "Done" for users who only
                          wanted to fix the data. */}
                      <Pressable
                        style={styles.correctionSuccessDoneBtn}
                        onPress={handleCorrectionLogNow}
                        accessibilityRole="button"
                        accessibilityLabel="Log this product now"
                      >
                        <Text style={styles.correctionSuccessDoneText}>Log this now</Text>
                      </Pressable>
                      <Pressable
                        style={styles.correctionSuccessDoneSecondary}
                        onPress={handleCorrectionDone}
                        accessibilityRole="button"
                        accessibilityLabel="Done without logging"
                      >
                        <Text style={styles.correctionSuccessDoneSecondaryText}>Just done</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}
              {product && correctionMode && !corrSubmitted && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.manualCard}>
                      <Text style={styles.manualTitle}>Correct This Product</Text>
                      <Text style={styles.manualSubtitle}>
                        Help us build a better database. Your numbers will
                        apply to your scans straight away.
                      </Text>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Product name"
                        placeholderTextColor={colors.textTertiary}
                        value={corrName}
                        onChangeText={setCorrName}
                        autoFocus
                      />

                      {/* F-20 — basis toggle. Mirrors the Custom Food
                          "Per 100 g / Per serving" convention so users
                          don't have to relearn the model across the two
                          entry surfaces. */}
                      <View style={styles.basisRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: corrBasis === "per100g" }}
                          accessibilityLabel="Enter nutrition per 100 g"
                          onPress={() => setCorrBasis("per100g")}
                          style={[
                            styles.basisChip,
                            corrBasis === "per100g" && styles.basisChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.basisChipText,
                              corrBasis === "per100g" && styles.basisChipTextSelected,
                            ]}
                          >
                            Per 100 g
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: corrBasis === "perServing" }}
                          accessibilityLabel="Enter nutrition per serving"
                          onPress={() => setCorrBasis("perServing")}
                          style={[
                            styles.basisChip,
                            corrBasis === "perServing" && styles.basisChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.basisChipText,
                              corrBasis === "perServing" && styles.basisChipTextSelected,
                            ]}
                          >
                            Per serving
                          </Text>
                        </Pressable>
                      </View>

                      {/* F-20 — serving-size input appears only in the
                          per-serving branch. Required when per-serving is
                          active (submit stays disabled until > 0). */}
                      {/* F-22 (2026-04-21): persistent labels above each
                          field. Placeholders disappear on first keystroke so
                          users lost context on which cell is calories/protein
                          (TestFlight AJlhpO020UK-). */}
                      {corrBasis === "perServing" && (
                        <View>
                          <Text style={styles.fieldLabel}>Serving size (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="e.g. 16"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrServingG}
                            onChangeText={setCorrServingG}
                            accessibilityLabel="Serving size in grams"
                          />
                        </View>
                      )}

                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>{corrBasis === "perServing" ? "Calories (kcal / serving)" : "Calories (kcal / 100 g)"}</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="kcal"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrCalories}
                            onChangeText={setCorrCalories}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Protein (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrProtein}
                            onChangeText={setCorrProtein}
                          />
                        </View>
                      </View>
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Carbs (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrCarbs}
                            onChangeText={setCorrCarbs}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Fat (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrFat}
                            onChangeText={setCorrFat}
                          />
                        </View>
                      </View>
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Fiber (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrFiber}
                            onChangeText={setCorrFiber}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Sugar (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSugar}
                            onChangeText={setCorrSugar}
                          />
                        </View>
                      </View>
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Sodium (mg) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="mg"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSodium}
                            onChangeText={setCorrSodium}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Saturated fat (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSatFat}
                            onChangeText={setCorrSatFat}
                          />
                        </View>
                      </View>

                      {/* F-20 — live per-100g reference so the user can
                          sanity-check that what they typed maps to a
                          sensible per-100g figure. Only shown for the
                          per-serving branch where the scaling is
                          non-identity. */}
                      {corrBasis === "perServing" && corrPer100g != null && (
                        <Text
                          accessibilityLiveRegion="polite"
                          style={styles.basisReference}
                        >
                          = {corrPer100g.calories} kcal / 100 g
                        </Text>
                      )}

                      {/* F-138 Phase 2 — server-side plausibility block. */}
                      {corrBlockReasons && corrBlockReasons.length > 0 && (
                        <View
                          accessibilityLiveRegion="assertive"
                          style={styles.plausibilityBlockBox}
                        >
                          <Text style={styles.plausibilityBlockTitle}>
                            These numbers don{"’"}t add up
                          </Text>
                          {corrBlockReasons.map((reason, i) => (
                            <Text key={i} style={styles.plausibilityBlockReason}>
                              • {reason}
                            </Text>
                          ))}
                          <Text style={styles.plausibilityBlockHint}>
                            Double-check the label and try again.
                          </Text>
                        </View>
                      )}

                      <Pressable
                        style={[
                          styles.manualSubmitBtn,
                          { opacity: corrName.trim() && corrPer100g != null ? 1 : 0.4 },
                        ]}
                        onPress={submitCorrection}
                        disabled={!corrName.trim() || corrPer100g == null || corrSaving}
                      >
                        <Text style={styles.manualSubmitText}>{corrSaving ? "Saving..." : "Save Correction"}</Text>
                      </Pressable>
                      <Pressable style={styles.scanAgainBtn} onPress={() => setCorrectionMode(false)}>
                        <Text style={styles.scanAgainText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {!loading && !error && !product && !manualMode && (
                <Text style={styles.hintText}>
                  Point your camera at a barcode on any food product
                </Text>
              )}
            </View>
            </TouchableWithoutFeedback>
          </>
        )}
      </View>
    </Modal>
  );
}
