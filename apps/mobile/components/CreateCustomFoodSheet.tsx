/**
 * CreateCustomFoodSheet — mobile mirror of the web
 * `CreateCustomFoodDialog`. Collects the fields needed to match
 * MyFitnessPal / LoseIt's "add food" form:
 *   - Name + optional brand (always).
 *   - A single natural serving (label + grams) + optional servings per
 *     container — surfaced prominently above the macros so users reason
 *     about the label, not grams (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`).
 *   - Macros per 100 g (MFP / USDA convention) with a live "per serving"
 *     preview computed from the per-100 g macros × serving grams.
 *   - A collapsed "Add detailed nutrition" disclosure with sugar / sat
 *     fat / sodium — hidden by default so the primary form stays short.
 *   - An optional barcode text input (no scanner — scanner is a
 *     follow-up piece of work that needs `expo-camera` permissions).
 *   - A "Scan label" OCR entry (2026-06-11) — snaps a nutrition-panel
 *     photo, posts to /api/nutrition/scan-label, and PRE-FILLS the
 *     per-100g macro fields. The form stays the source of truth: the user
 *     confirms every value before saving; low-confidence / implausible
 *     scans surface a "double-check" warning (never silently accepted).
 *
 * Does no I/O; hands the payload back via `onSave` so the caller
 * can run it through the shared `createCustomFood` / `updateCustomFood`
 * helpers. Shares all pure logic (scaling, dedupe, normalisation,
 * barcode validation) with web via `src/lib/nutrition/customFoods.ts`
 * so platforms can't drift.
 *
 * Validation rules encoded in `canSave`:
 *  - `name` non-empty after normalisation.
 *  - `baseGrams > 0`.
 *  - Serving label and grams are both empty, or both set (grams > 0).
 *  - Barcode, if provided, validates to 8 / 12 / 13 / 14 digits.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";

import KeyboardSafeView from "./KeyboardSafeView";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  CUSTOM_FOOD_NAME_MAX,
  convertMacrosBetweenBases,
  customFoodToMacrosPer100g,
  normaliseCustomFoodName,
  validateCustomFoodBarcode,
  type CustomFood,
  type CustomFoodServing,
  type MacroBasis,
} from "@suppr/nutrition-core/customFoods";
// ENG-748 #15 (2026-05-27) — density-aware "1 cup → grams" converter for
// custom-food entry. Reuses the shared, sourced density table + conversion
// math (no invented densities); only converts when the food's density is
// known, else falls back to manual grams.
import {
  isVolumeUnit,
  volumeToGrams,
} from "@suppr/nutrition-core/volumeToGrams";
import { parseIngredientLine } from "@suppr/shared/recipe-ingredients/parseIngredientLine";

/** F-156 PR-1 — AsyncStorage key for the user's last-chosen macro basis. */
const MACRO_BASIS_STORAGE_KEY = "@suppr/customFood/macroBasis/v1";

// Recipe-vision contract (2026-06-11) — Suppr's mobile app talks to the same
// Vercel-hosted Next.js routes the web client uses. Mirrors the resolution in
// BarcodeScannerModal so the scan-label call hits the same origin.
const API_BASE: string =
  (Constants.expoConfig?.extra?.supprApiUrl as string | undefined) ?? "https://suppr-club.com";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
};

export type CreateCustomFoodPayload = {
  name: string;
  brand?: string;
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings: CustomFoodServing[];
  servingsPerContainer?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  barcode?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When present, opens in edit mode and prefills all fields. */
  initialFood?: CustomFood;
  /** Suggested name prefill (e.g. what the user typed in search). */
  initialName?: string;
  /**
   * F-156 PR-2 (2026-05-10) — barcode prefill from a scan-not-found
   * flow. When set (and `initialFood` is unset, i.e. create mode),
   * the barcode field is pre-populated and the detailed-nutrition
   * disclosure is auto-opened so the user can see the field. Wired
   * from `BarcodeScannerModal.onAddAsCustomFood`.
   */
  initialBarcode?: string;
  onSave: (payload: CreateCustomFoodPayload) => void | Promise<void>;
  colors: Theme;
};

function toNumber(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

export default function CreateCustomFoodSheet({
  visible,
  onClose,
  initialFood,
  initialName,
  initialBarcode,
  onSave,
  colors,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the swap/add links and
  // the Save CTA. The macro-source toggle keeps `Accent.success`, and validation
  // errors keep `Accent.destructive`.
  const accent = useAccent();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [servingGramsText, setServingGramsText] = useState("");
  /**
   * F-156 PR-2 (2026-05-10) — additional serving rows beyond the first
   * canonical natural serving. First row stays in `servingLabel` +
   * `servingGramsText` because it drives the basis toggle, preview,
   * and per-serving conversion. Extra rows are pure rendering: a
   * user adds 1 slice (30g) + 1 loaf (500g) + 1 cup (250g). Unlimited
   * (Grace 2026-05-10 override of the spec's cap of 3).
   */
  const [additionalServings, setAdditionalServings] = useState<
    Array<{ label: string; grams: string }>
  >([]);
  const [servingsPerContainerText, setServingsPerContainerText] = useState("");
  const [caloriesText, setCaloriesText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [fiberText, setFiberText] = useState("");
  const [sugarText, setSugarText] = useState("");
  const [satFatText, setSatFatText] = useState("");
  const [sodiumText, setSodiumText] = useState("");
  const [barcode, setBarcode] = useState("");
  // 2026-05-13 (TF feedback `AMbt66gRLJwsjswlQ2aKpG4` — "needs to be
  // more flexible and dynamic more nutrition fields ... parity with
  // mfp"): the detailed-nutrition disclosure (sugar / sat fat /
  // sodium) was collapsed by default — Grace didn't notice it was
  // there. Default to OPEN so MFP-parity nutrient fields are visible
  // on first paint. Users who don't need them can still tap to hide.
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  // F-156 PR-1 — macro basis the user is currently entering values in.
  // Persisted across sessions so a power user doesn't re-toggle every
  // time. Default for new foods: per_serving when natural serving is
  // valid, else per_100g.
  const [macroBasis, setMacroBasis] = useState<MacroBasis>("per_100g");
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const conversionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialBasisAppliedRef = useRef(false);
  // Recipe-vision contract (2026-06-11) — "Scan label" OCR pre-fill state.
  // The form stays the source of truth: OCR only pre-fills per-100g values
  // the user confirms before saving. `scanWarning` carries a "double-check"
  // message when the route flags low confidence or implausible macros — we
  // never silently accept a scan.
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      initialBasisAppliedRef.current = false;
      return;
    }
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      // Natural serving lives as the first `servings[]` entry.
      const first = (initialFood.servings ?? []).find(
        (s) => s.label.trim() !== "" && s.grams > 0,
      );
      setServingLabel(first?.label ?? "");
      setServingGramsText(first ? formatNumber(first.grams) : "");
      // F-156 PR-2 — load any saved servings beyond the first into
      // the additional rows. Skip the first match (already loaded
      // above) and any half-saved rows (empty label or zero grams).
      const rest = (initialFood.servings ?? [])
        .filter(
          (s, idx) =>
            !(idx === (initialFood.servings ?? []).indexOf(first!) && first) &&
            s.label.trim() !== "" &&
            s.grams > 0,
        )
        .map((s) => ({ label: s.label, grams: formatNumber(s.grams) }));
      setAdditionalServings(rest);
      setServingsPerContainerText(
        initialFood.servingsPerContainer != null
          ? formatNumber(initialFood.servingsPerContainer)
          : "",
      );
      // F-156 PR-1 — macro fields are always rendered in the user's
      // chosen basis. Internally the food row stores per its own
      // `baseGrams`. Convert into the displayed basis at init time.
      // For edit mode we default the basis to "per_serving" if the
      // food has a natural serving (most common), else "per_100g".
      const servingG = first?.grams ?? 0;
      const initialBasis: MacroBasis = servingG > 0 ? "per_serving" : "per_100g";
      const per100g = customFoodToMacrosPer100g({
        baseGrams: initialFood.baseGrams,
        calories: initialFood.calories,
        protein: initialFood.protein,
        carbs: initialFood.carbs,
        fat: initialFood.fat,
        fiber: initialFood.fiber,
      });
      const displayed = convertMacrosBetweenBases(
        {
          calories: per100g.calories,
          protein: per100g.protein,
          carbs: per100g.carbs,
          fat: per100g.fat,
          fiber: per100g.fiberG,
        },
        "per_100g",
        initialBasis,
        servingG,
      );
      setCaloriesText(displayed.calories > 0 ? formatNumber(displayed.calories) : "");
      setProteinText(displayed.protein > 0 ? formatNumber(displayed.protein) : "");
      setCarbsText(displayed.carbs > 0 ? formatNumber(displayed.carbs) : "");
      setFatText(displayed.fat > 0 ? formatNumber(displayed.fat) : "");
      setFiberText(initialFood.fiber != null && displayed.fiber > 0 ? formatNumber(displayed.fiber) : "");
      setMacroBasis(initialBasis);
      initialBasisAppliedRef.current = true;
      setSugarText(initialFood.sugarG != null ? formatNumber(initialFood.sugarG) : "");
      setSatFatText(
        initialFood.saturatedFatG != null ? formatNumber(initialFood.saturatedFatG) : "",
      );
      setSodiumText(initialFood.sodiumMg != null ? formatNumber(initialFood.sodiumMg) : "");
      setBarcode(initialFood.barcode ?? "");
      // Open the disclosure if the food already has any detailed micros
      // or a barcode — so users editing an existing food see their data.
      setDetailsOpen(
        initialFood.sugarG != null ||
          initialFood.saturatedFatG != null ||
          initialFood.sodiumMg != null ||
          Boolean(initialFood.barcode),
      );
    } else {
      setName(initialName ?? "");
      setBrand("");
      setServingLabel("");
      setServingGramsText("");
      setAdditionalServings([]);
      setServingsPerContainerText("");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setSugarText("");
      setSatFatText("");
      setSodiumText("");
      // F-156 PR-2 — prefill the barcode + auto-open the disclosure
      // when the host opened the sheet from a barcode-not-found CTA.
      setBarcode(initialBarcode ?? "");
      setDetailsOpen(Boolean(initialBarcode));
      // F-156 PR-1 — for a new food, restore the user's last-chosen
      // basis from AsyncStorage. Falls back to "per_100g" while the
      // read is in flight + when no value is stored.
      setMacroBasis("per_100g");
      initialBasisAppliedRef.current = false;
      void AsyncStorage.getItem(MACRO_BASIS_STORAGE_KEY).then((stored) => {
        if (stored === "per_serving" || stored === "per_100g") {
          setMacroBasis(stored);
        }
        initialBasisAppliedRef.current = true;
      }).catch(() => {
        initialBasisAppliedRef.current = true;
      });
    }
    setSaving(false);
    setConversionNotice(null);
    setScanLoading(false);
    setScanError(null);
    setScanWarning(null);
    if (conversionNoticeTimeoutRef.current) {
      clearTimeout(conversionNoticeTimeoutRef.current);
      conversionNoticeTimeoutRef.current = null;
    }
  }, [visible, initialFood, initialName, initialBarcode]);

  // Cleanup the conversion-notice timer on unmount.
  useEffect(() => {
    return () => {
      if (conversionNoticeTimeoutRef.current) {
        clearTimeout(conversionNoticeTimeoutRef.current);
      }
    };
  }, []);

  const servingGrams = toNumber(servingGramsText);
  const servingLabelClean = servingLabel.trim();
  const hasServingLabel = servingLabelClean.length > 0;
  const hasServingGrams = servingGrams > 0;

  // ENG-748 #15 — density-aware "1 cup → grams" helper for the primary
  // serving row. When the serving label parses to a volume measure
  // (e.g. "1 cup", "2 tbsp") we try to convert it to grams using the
  // food's known density (resolved from the shared sourced staple table
  // via `volumeToGrams`). Three outcomes the UI reacts to:
  //   - "known": offer a "Convert to grams" button that fills the field
  //   - "unknown": calm hint that we can't auto-convert this food (no
  //     guessed density — weigh it instead)
  //   - null: the label isn't a volume measure, show nothing extra
  const volumeConversion = useMemo<
    | { kind: "known"; grams: number; unitLabel: string; gPerMl: number }
    | { kind: "unknown"; unitLabel: string }
    | null
  >(() => {
    if (!hasServingLabel) return null;
    const parsed = parseIngredientLine(servingLabelClean);
    const unit = parsed.unit.trim().toLowerCase();
    if (!isVolumeUnit(unit)) return null;
    const amount = Number.parseFloat(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    // Density is resolved from the FOOD NAME, not the serving label.
    const result = volumeToGrams({ foodName: name, amount, unit });
    const unitLabel = `${amount} ${unit}`;
    if (result.densityKnown) {
      return { kind: "known", grams: result.grams, unitLabel, gPerMl: result.gPerMl };
    }
    return { kind: "unknown", unitLabel };
  }, [hasServingLabel, servingLabelClean, name]);
  // Both fields are "required together or both empty". Disallow half-
  // filled combos (label without grams, grams without label).
  const firstServingValid =
    (!hasServingLabel && !hasServingGrams) ||
    (hasServingLabel && hasServingGrams);
  // F-156 PR-2 — same both-or-neither rule applies per additional row.
  const additionalServingsValid = additionalServings.every((row) => {
    const hasLabel = row.label.trim().length > 0;
    const grams = toNumber(row.grams);
    const hasG = grams > 0;
    return (!hasLabel && !hasG) || (hasLabel && hasG);
  });
  const servingValid = firstServingValid && additionalServingsValid;

  // F-156 PR-1 — Per-serving basis requires a valid serving (label +
  // grams). If the user clears the serving while the toggle is on
  // per_serving, snap back to per_100g and convert any entered macros.
  const perServingAvailable = hasServingLabel && hasServingGrams;
  const effectiveBasis: MacroBasis = perServingAvailable ? macroBasis : "per_100g";

  // baseGrams is now derived from the basis + serving grams. The user
  // never sees a "Macros per N grams" input — they pick a basis and
  // the math follows.
  const baseGrams = effectiveBasis === "per_serving" ? servingGrams : 100;

  const macros = useMemo(
    () => ({
      baseGrams,
      calories: toNumber(caloriesText),
      protein: toNumber(proteinText),
      carbs: toNumber(carbsText),
      fat: toNumber(fatText),
      fiber: fiberText.trim() ? toNumber(fiberText) : undefined,
      sugarG: sugarText.trim() ? toNumber(sugarText) : undefined,
      sodiumMg: sodiumText.trim() ? toNumber(sodiumText) : undefined,
    }),
    [baseGrams, caloriesText, proteinText, carbsText, fatText, fiberText, sugarText, sodiumText],
  );

  const barcodeParsed = useMemo(() => validateCustomFoodBarcode(barcode), [barcode]);
  const barcodeValid = barcodeParsed.ok;

  const trimmedName = normaliseCustomFoodName(name);
  const hasValidBase = macros.baseGrams > 0;
  const allMacrosZero =
    macros.calories === 0 &&
    macros.protein === 0 &&
    macros.carbs === 0 &&
    macros.fat === 0 &&
    (macros.fiber == null || macros.fiber === 0);

  const canSave =
    trimmedName.length > 0 &&
    hasValidBase &&
    servingValid &&
    barcodeValid &&
    !saving;

  // F-156 PR-1 — handle a user-initiated basis flip. Convert the
  // currently-entered macro values to the new basis so the numbers in
  // the input fields stay semantically the same. Show a brief
  // "values converted" notice for trust. No-op if servingGrams is 0
  // (the toggle to per_serving is disabled in that state).
  const flipBasisTo = (next: MacroBasis) => {
    if (next === macroBasis) return;
    if (next === "per_serving" && !perServingAvailable) return;
    const hasAnyMacro =
      caloriesText.trim() !== "" ||
      proteinText.trim() !== "" ||
      carbsText.trim() !== "" ||
      fatText.trim() !== "" ||
      fiberText.trim() !== "";
    const grams = next === "per_serving" ? servingGrams : servingGrams;
    if (hasAnyMacro && servingGrams > 0) {
      const converted = convertMacrosBetweenBases(
        {
          calories: toNumber(caloriesText),
          protein: toNumber(proteinText),
          carbs: toNumber(carbsText),
          fat: toNumber(fatText),
          fiber: toNumber(fiberText),
        },
        macroBasis,
        next,
        grams,
      );
      if (caloriesText.trim() !== "") setCaloriesText(formatNumber(converted.calories));
      if (proteinText.trim() !== "") setProteinText(formatNumber(converted.protein));
      if (carbsText.trim() !== "") setCarbsText(formatNumber(converted.carbs));
      if (fatText.trim() !== "") setFatText(formatNumber(converted.fat));
      if (fiberText.trim() !== "") setFiberText(formatNumber(converted.fiber));
      const targetLabel = next === "per_serving" ? "per serving" : "per 100 g";
      setConversionNotice(`Values converted to ${targetLabel}.`);
      if (conversionNoticeTimeoutRef.current) {
        clearTimeout(conversionNoticeTimeoutRef.current);
      }
      conversionNoticeTimeoutRef.current = setTimeout(() => {
        setConversionNotice(null);
        conversionNoticeTimeoutRef.current = null;
      }, 3000);
    }
    setMacroBasis(next);
    void AsyncStorage.setItem(MACRO_BASIS_STORAGE_KEY, next).catch(() => {});
  };

  // F-156 PR-1 — if the user is on per_serving and clears the
  // serving fields, snap basis back to per_100g + convert macros so
  // the numbers don't silently become per-100g values labelled as
  // per-serving.
  useEffect(() => {
    if (!visible || !initialBasisAppliedRef.current) return;
    if (macroBasis === "per_serving" && !perServingAvailable) {
      setMacroBasis("per_100g");
    }
  }, [visible, macroBasis, perServingAvailable]);

  // Live preview: scale the food's macros to the natural serving, if the
  // user has set one; else to `baseGrams`. Uses `customFoodToMacrosPer100g`
  // so the math agrees with the per-100g path search + log uses.
  const previewGrams = hasServingLabel && hasServingGrams ? servingGrams : macros.baseGrams;
  const previewScaled = useMemo(() => {
    if (!(previewGrams > 0) || !hasValidBase) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    const per100g = customFoodToMacrosPer100g(macros);
    const f = previewGrams / 100;
    return {
      calories: Math.round(per100g.calories * f),
      protein: Math.round(per100g.protein * f * 10) / 10,
      carbs: Math.round(per100g.carbs * f * 10) / 10,
      fat: Math.round(per100g.fat * f * 10) / 10,
    };
  }, [macros, previewGrams, hasValidBase]);

  // Recipe-vision contract (2026-06-11) — "Scan label" OCR pre-fill.
  // Captures a photo of a nutrition label, posts it to /api/nutrition/
  // scan-label (Claude vision, OpenAI fallback), and PRE-FILLS the form's
  // per-100g macro fields. The form stays the source of truth: the user
  // reviews every value and taps Save. Low-confidence / implausible scans
  // surface a "double-check" warning — never silently accepted (repo
  // nutrition no-guessing rule). Mirrors the established handleSnapLabel
  // flow in BarcodeScannerModal so the RN FormData + auth shape is identical.
  const handleScanLabel = async () => {
    if (scanLoading) return;
    setScanError(null);
    setScanWarning(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setScanError("Camera permission needed to scan the label.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setScanLoading(true);
    try {
      const asset = result.assets[0];
      const fd = new FormData();
      // RN's FormData wants a `{ uri, name, type }` object, not a Blob.
      // Casting is the established pattern for this RN-native shape.
      fd.append(
        "image",
        ({
          uri: asset.uri,
          name: "label.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as unknown) as Blob,
      );

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
        setScanError(
          (typeof data?.message === "string" && data.message) ||
            "Couldn't read the label. Try a sharper, well-lit photo of the nutrition panel.",
        );
        return;
      }

      // The route returns per-100g values — pre-fill in per-100g basis so
      // the numbers and the basis agree. The basis effect snaps to per_100g
      // when there's no valid serving, keeping per-100g entry valid.
      setMacroBasis("per_100g");
      void AsyncStorage.setItem(MACRO_BASIS_STORAGE_KEY, "per_100g").catch(() => {});
      if (typeof data.name === "string" && data.name.trim() && !name.trim()) {
        setName(data.name.trim());
      }
      setCaloriesText(formatNumber(Math.round(Number(data.calories) || 0)));
      setProteinText(formatNumber(Math.round((Number(data.protein) || 0) * 10) / 10));
      setCarbsText(formatNumber(Math.round((Number(data.carbs) || 0) * 10) / 10));
      setFatText(formatNumber(Math.round((Number(data.fat) || 0) * 10) / 10));
      setFiberText(
        data.fiberG != null && Number(data.fiberG) > 0
          ? formatNumber(Math.round(Number(data.fiberG) * 10) / 10)
          : "",
      );
      setSugarText(
        data.sugarG != null && Number(data.sugarG) > 0
          ? formatNumber(Math.round(Number(data.sugarG) * 10) / 10)
          : "",
      );
      setSatFatText(
        data.saturatedFatG != null && Number(data.saturatedFatG) > 0
          ? formatNumber(Math.round(Number(data.saturatedFatG) * 10) / 10)
          : "",
      );
      setSodiumText(
        data.sodiumMg != null && Number(data.sodiumMg) > 0
          ? formatNumber(Math.round(Number(data.sodiumMg)))
          : "",
      );
      setDetailsOpen(true);

      // Surface a "double-check" warning when the route flags the scan —
      // either implausible macros (Atwater failure) or low model confidence.
      if (data.implausible === true) {
        setScanWarning(
          "These numbers look unusual — the label may have been read wrong. Double-check each value before saving.",
        );
      } else if (data.confidence === "low") {
        setScanWarning(
          "The label was hard to read. Double-check each value before saving.",
        );
      }

      try {
        track(AnalyticsEvents.custom_food_label_scanned, {
          confidence: typeof data.confidence === "string" ? data.confidence : "unknown",
          implausible: data.implausible === true,
          platform: "ios",
        });
      } catch {
        /* noop */
      }
    } catch {
      setScanError(
        "Couldn't reach the AI service. Check your connection and try again.",
      );
    } finally {
      setScanLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // F-156 PR-2 — first row + any valid additional rows. Empty
      // trailing rows are stripped silently; per-row both-or-neither
      // is already enforced by `servingValid` so we only get here
      // when every populated row is whole.
      const servings: CustomFoodServing[] =
        hasServingLabel && hasServingGrams
          ? [{ label: servingLabelClean, grams: servingGrams }]
          : [];
      for (const row of additionalServings) {
        const label = row.label.trim();
        const grams = toNumber(row.grams);
        if (label.length > 0 && grams > 0) {
          servings.push({ label, grams });
        }
      }
      // F-156 PR-1 — payload is always stored against `baseGrams`. The
      // toggle picks which `baseGrams` (servingGrams for per_serving,
      // 100 for per_100g) so the saved values + base agree without
      // converting at save time.
      const payload: CreateCustomFoodPayload = {
        name: trimmedName,
        baseGrams: macros.baseGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        servings,
      };
      const brandTrimmed = brand.trim();
      if (brandTrimmed) payload.brand = brandTrimmed;
      if (macros.fiber != null && fiberText.trim()) payload.fiber = macros.fiber;
      const spc = toNumber(servingsPerContainerText);
      if (servingsPerContainerText.trim() && spc > 0) payload.servingsPerContainer = spc;
      if (sugarText.trim()) payload.sugarG = toNumber(sugarText);
      if (satFatText.trim()) payload.saturatedFatG = toNumber(satFatText);
      if (sodiumText.trim()) payload.sodiumMg = toNumber(sodiumText);
      if (barcodeParsed.ok && barcodeParsed.value) payload.barcode = barcodeParsed.value;
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialFood);
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.background,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardSafeView
        scroll={false}
        dismissOnBackgroundTap={false}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: MODAL_OVERLAY_SCRIM,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              maxHeight: "90%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.cardBorder,
                }}
              />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {isEditing ? "Edit custom food" : "Create custom food"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: Spacing.md,
                marginTop: 2,
              }}
            >
              For foods that aren&apos;t in the database — e.g. homemade or local-bakery items.
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Recipe-vision contract (2026-06-11) — "Scan label" OCR
                  fast-fill. Snaps a photo of the nutrition panel and
                  pre-fills the per-100g macros below; the user confirms
                  every value before saving (form stays source of truth).
                  Secondary outline treatment — the Save CTA is the screen's
                  one filled button. */}
              <Pressable
                onPress={handleScanLabel}
                disabled={scanLoading}
                accessibilityRole="button"
                accessibilityLabel="Scan a nutrition label to pre-fill the macros"
                accessibilityState={{ disabled: scanLoading, busy: scanLoading }}
                testID="custom-food-scan-label"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: Spacing.sm,
                  borderWidth: 1,
                  borderColor: accent.primary,
                  backgroundColor: accent.primary + "1f",
                  borderRadius: Radius.md,
                  paddingVertical: 11,
                  marginBottom: Spacing.md,
                  opacity: scanLoading ? 0.7 : 1,
                }}
              >
                {scanLoading ? (
                  <ActivityIndicator size="small" color={accent.primary} />
                ) : (
                  <Ionicons name="camera-outline" size={18} color={accent.primary} />
                )}
                <Text style={{ fontSize: 14, fontWeight: "700", color: accent.primary }}>
                  {scanLoading ? "Reading label…" : "Scan label"}
                </Text>
              </Pressable>
              {scanError && (
                <Text
                  testID="custom-food-scan-error"
                  accessibilityLiveRegion="polite"
                  style={{
                    fontSize: 11,
                    color: Accent.destructive,
                    marginBottom: Spacing.md,
                    marginTop: -Spacing.sm,
                  }}
                >
                  {scanError}
                </Text>
              )}
              {scanWarning && (
                <Text
                  testID="custom-food-scan-warning"
                  accessibilityLiveRegion="polite"
                  style={{
                    fontSize: 11,
                    color: Accent.warning,
                    marginBottom: Spacing.md,
                    marginTop: -Spacing.sm,
                  }}
                >
                  {scanWarning}
                </Text>
              )}

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Homemade granola"
                placeholderTextColor={colors.textTertiary}
                maxLength={CUSTOM_FOOD_NAME_MAX}
                accessibilityLabel="Custom food name"
                style={[inputStyle, { marginBottom: Spacing.md }]}
                autoFocus
                returnKeyType="next"
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Brand (optional)
              </Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. My recipe, Local bakery"
                placeholderTextColor={colors.textTertiary}
                maxLength={80}
                accessibilityLabel="Brand"
                style={[inputStyle, { marginBottom: Spacing.md }]}
                returnKeyType="next"
              />

              {/* Natural serving row — prominent, above the macro grid. */}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Serving size (optional)
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <TextInput
                  value={servingLabel}
                  onChangeText={setServingLabel}
                  placeholder="e.g. 1 slice"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={40}
                  accessibilityLabel="Serving size label"
                  style={[inputStyle, { flex: 1 }]}
                  returnKeyType="next"
                />
                <TextInput
                  value={servingGramsText}
                  onChangeText={setServingGramsText}
                  keyboardType="decimal-pad"
                  placeholder="grams"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Serving size grams"
                  style={[inputStyle, { width: 90 }]}
                />
              </View>

              {/* ENG-748 #15 (2026-05-27) — density-aware volume→grams
                  converter. Shows ONLY when the serving label is a volume
                  measure ("1 cup", "2 tbsp"). When the food's density is
                  known we offer a one-tap convert; when it isn't we say so
                  plainly rather than guessing a wrong gram weight. */}
              {volumeConversion?.kind === "known" && !hasServingGrams && (
                <Pressable
                  onPress={() => setServingGramsText(formatNumber(volumeConversion.grams))}
                  accessibilityRole="button"
                  accessibilityLabel={`Convert ${volumeConversion.unitLabel} to ${volumeConversion.grams} grams`}
                  testID="custom-food-volume-convert"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingVertical: 6,
                    marginBottom: 4,
                  }}
                >
                  <Ionicons name="swap-horizontal" size={16} color={accent.primary} />
                  <Text style={{ fontSize: 13, color: accent.primary, fontWeight: "600" }}>
                    Convert {volumeConversion.unitLabel} → {formatNumber(volumeConversion.grams)} g
                  </Text>
                </Pressable>
              )}
              {volumeConversion?.kind === "unknown" && !hasServingGrams && (
                <Text
                  testID="custom-food-volume-unknown"
                  style={{
                    fontSize: 11,
                    color: colors.textTertiary,
                    lineHeight: 16,
                    marginBottom: 4,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  We can&apos;t auto-convert {volumeConversion.unitLabel} for this food — its weight
                  depends on density. Pop it on a scale and enter grams.
                </Text>
              )}

              {/* F-156 PR-2 (2026-05-10) — additional serving rows.
                  Compact list ([label] [grams] [×]) below the first
                  serving so the user can add "1 slice" + "1 loaf" +
                  "1 cup" etc. Unlimited (Grace 2026-05-10 override).
                  First row above stays the canonical serving used by
                  the basis toggle + preview. */}
              {additionalServings.map((row, idx) => (
                <View
                  key={idx}
                  style={{ flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "center" }}
                  testID={`custom-food-additional-serving-${idx}`}
                >
                  <TextInput
                    value={row.label}
                    onChangeText={(t) =>
                      setAdditionalServings((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, label: t } : r)),
                      )
                    }
                    placeholder="e.g. 1 cup"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={40}
                    accessibilityLabel={`Additional serving ${idx + 2} label`}
                    style={[inputStyle, { flex: 1 }]}
                  />
                  <TextInput
                    value={row.grams}
                    onChangeText={(t) =>
                      setAdditionalServings((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, grams: t } : r)),
                      )
                    }
                    keyboardType="decimal-pad"
                    placeholder="grams"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel={`Additional serving ${idx + 2} grams`}
                    style={[inputStyle, { width: 90 }]}
                  />
                  <Pressable
                    onPress={() =>
                      setAdditionalServings((rows) => rows.filter((_, i) => i !== idx))
                    }
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove serving ${idx + 2}`}
                    testID={`custom-food-additional-serving-remove-${idx}`}
                    style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                  >
                    <Ionicons name="close" size={20} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  setAdditionalServings((rows) => [...rows, { label: "", grams: "" }])
                }
                accessibilityRole="button"
                accessibilityLabel="Add another serving"
                testID="custom-food-add-serving"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingVertical: 6,
                  marginBottom: 4,
                }}
              >
                <Ionicons name="add" size={16} color={accent.primary} />
                <Text style={{ fontSize: 13, color: accent.primary, fontWeight: "600" }}>
                  Add another serving
                </Text>
              </Pressable>

              {/* 2026-05-13 (TF feedback `AMbt66gRLJwsjswlQ2aKpG4` —
                  "more options for servings different weights ...
                  parity with mfp"): hint row with common-serving
                  conversions for fixed-weight units. Volume units (cup
                  / tbsp / tsp) are now handled by the density-aware
                  converter above for the primary serving — these are
                  the unambiguous mass + count references that don't
                  depend on density. Reference values are the
                  food-industry defaults used by USDA + MyFitnessPal. */}
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textTertiary,
                  lineHeight: 16,
                  marginBottom: Spacing.sm,
                }}
              >
                Tip — common sizes:  1 oz ≈ 28 g  ·  1 slice ≈ 30 g.  For cups / spoons, type e.g. &quot;1 cup&quot; in the serving box above to convert.
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: Spacing.sm,
                }}
              >
                <TextInput
                  value={servingsPerContainerText}
                  onChangeText={setServingsPerContainerText}
                  keyboardType="decimal-pad"
                  placeholder=""
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Servings per container"
                  style={[inputStyle, { width: 70 }]}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  servings per container (optional)
                </Text>
              </View>
              {!servingValid && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Accent.destructive,
                    marginBottom: 6,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  Enter both a serving size label and grams, or leave both blank.
                </Text>
              )}

              {/* F-156 PR-1 — basis toggle. Macros are stored per-100g
                  internally; the toggle picks which basis the user
                  enters them in. Per-serving pill is disabled until a
                  natural serving (label + grams) is set. */}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                  marginTop: 4,
                }}
              >
                Macros entered as
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  padding: 2,
                  marginBottom: 4,
                }}
                accessibilityRole="radiogroup"
              >
                {(
                  [
                    { value: "per_serving" as MacroBasis, label: "Per serving", disabled: !perServingAvailable },
                    { value: "per_100g" as MacroBasis, label: "Per 100 g", disabled: false },
                  ]
                ).map((opt) => {
                  const selected = effectiveBasis === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => flipBasisTo(opt.value)}
                      disabled={opt.disabled}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: opt.disabled }}
                      accessibilityLabel={`Enter macros ${opt.label.toLowerCase()}`}
                      testID={`custom-food-basis-${opt.value}`}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: Radius.md - 2,
                        backgroundColor: selected ? accent.primary : "transparent",
                        opacity: opt.disabled ? 0.4 : 1,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: selected ? Accent.primaryForeground : colors.text,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {effectiveBasis === "per_100g" && !perServingAvailable && (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textTertiary,
                    marginBottom: 8,
                  }}
                >
                  Add a serving size above to switch to per-serving entry.
                </Text>
              )}
              {conversionNotice && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Accent.success,
                    marginBottom: 8,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  {conversionNotice}
                </Text>
              )}

              {/* F-156 PR-1 — 2x3 macro grid. Fibre joins the grid as a
                  first-class field (was previously a full-width row
                  below) so the visual rhythm matches the four core
                  macros. */}
              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Calories (kcal)
                  </Text>
                  <TextInput
                    value={caloriesText}
                    onChangeText={setCaloriesText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Calories"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Protein (g)
                  </Text>
                  <TextInput
                    value={proteinText}
                    onChangeText={setProteinText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Protein grams"
                    style={inputStyle}
                  />
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Carbs (g)
                  </Text>
                  <TextInput
                    value={carbsText}
                    onChangeText={setCarbsText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Carbs grams"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Fat (g)
                  </Text>
                  <TextInput
                    value={fatText}
                    onChangeText={setFatText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Fat grams"
                    style={inputStyle}
                  />
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Fibre (g)
                  </Text>
                  <TextInput
                    value={fiberText}
                    onChangeText={setFiberText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Fibre grams, optional"
                    style={inputStyle}
                  />
                </View>
                {/* Empty cell preserves the 2-column grid rhythm. */}
                <View style={{ flex: 1 }} />
              </View>

              {/* Live "per-serving ≈" preview — below the macro grid so the
                  user sees instant feedback that the label adds up. */}
              <View
                style={{
                  marginTop: 4,
                  padding: 10,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                  marginBottom: Spacing.md,
                }}
                accessibilityLiveRegion="polite"
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Per-serving preview
                </Text>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  {hasServingLabel && hasServingGrams && hasValidBase
                    ? `${servingLabelClean} (${servingGrams} g) ≈ ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                    : hasValidBase
                      ? `${macros.baseGrams} g: ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                      : "Add macros above to see preview."}
                </Text>
              </View>

              {allMacrosZero && (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginBottom: Spacing.sm,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  Macros not set. You can fill these in later.
                </Text>
              )}

              {/* Disclosure: detailed nutrition (sugar / sat fat / sodium) +
                  barcode. Hidden by default to keep the form short. */}
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                accessibilityLabel={
                  detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  marginBottom: detailsOpen ? Spacing.sm : 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                  {detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"}
                </Text>
                <Ionicons
                  name={detailsOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {detailsOpen && (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sugar (g)
                      </Text>
                      <TextInput
                        value={sugarText}
                        onChangeText={setSugarText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Sugar grams, optional"
                        style={inputStyle}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sat fat (g)
                      </Text>
                      <TextInput
                        value={satFatText}
                        onChangeText={setSatFatText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Saturated fat grams, optional"
                        style={inputStyle}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sodium (mg)
                      </Text>
                      <TextInput
                        value={sodiumText}
                        onChangeText={setSodiumText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Sodium milligrams, optional"
                        style={inputStyle}
                      />
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Barcode (optional)
                  </Text>
                  <TextInput
                    value={barcode}
                    onChangeText={setBarcode}
                    keyboardType="number-pad"
                    placeholder="e.g. 5012345678900"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={14}
                    accessibilityLabel="Barcode, optional"
                    style={inputStyle}
                  />
                  {!barcodeValid && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: Accent.destructive,
                        marginTop: 4,
                      }}
                      accessibilityLiveRegion="polite"
                    >
                      Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.md,
              }}
            >
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  opacity: saving ? 0.6 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: Radius.md,
                  backgroundColor: canSave ? accent.primary : colors.cardBorder,
                  opacity: canSave ? 1 : 0.6,
                }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? "Save changes" : "Save food"}
                accessibilityState={{ disabled: !canSave }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: canSave ? Accent.primaryForeground : colors.textSecondary,
                  }}
                >
                  {saving ? "Saving…" : isEditing ? "Save changes" : "Save food"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardSafeView>
    </Modal>
  );
}
