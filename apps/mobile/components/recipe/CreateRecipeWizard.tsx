/**
 * CreateRecipeWizard — 5-step guided recipe creation surface (iOS).
 *
 * Hosts step machine from `src/lib/recipes/createRecipeWizard.ts` and
 * renders one step at a time. Reuses every piece of nutrition + DB
 * logic from `apps/mobile/app/create-recipe.tsx` (the long-form
 * single-screen surface) so both routes write to `recipes` /
 * `recipe_ingredients` / `saves` with identical shapes.
 *
 * Why a wizard alongside the single-screen form?
 *   - Customer-lens audit (2026-04-30): Library has no first-class
 *     "create from scratch" affordance. The single-screen form is
 *     reachable only from More → Settings, and its 8+ scrollable
 *     fields read as an editor, not an entry point.
 *   - Cal AI / MFP norms: short guided steps win for first-time
 *     creators ("name this recipe" → "what's in it" → "how to make
 *     it" → "macros look right?" → "save").
 *
 * The single-screen form at `create-recipe.tsx` stays in place — it's
 * still the share-extension / paste / scan-photo target via Settings
 * row + e2e flow `21-create-recipe`. The wizard is a parallel surface
 * with stricter validation and higher signal-to-noise per step.
 *
 * Web parity: web's `RecipeUpload` (mode="create") is already a
 * single-screen form on a desktop layout — wizard pacing wouldn't
 * help there. See `docs/audits/2026-04-28-recipe-creation-audit.md`
 * for the full surface map.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";

import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import FoodSearchModal, {
  type SelectedFood,
} from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import type { BarcodeProduct } from "@/lib/verifyRecipe";
import { parseIngredientLine } from "../../../../src/lib/recipe-ingredients/parseIngredientLine";
import { normaliseInstructions } from "../../../../src/lib/recipes/normaliseInstructions";
import { normalizeRecipeTitle } from "../../../../src/lib/recipes/normalizeRecipeTitle";
import {
  CREATE_RECIPE_STEP_IDS,
  CREATE_RECIPE_TOTAL_STEPS,
  SERVINGS_DEFAULT,
  TITLE_MAX_LENGTH,
  canAdvance,
  clampServings,
  computePerServing,
  hasMacroOverrides,
  initialWizardState,
  isIngredientsStepValid,
  isTitleStepValid,
  nextStep,
  prevStep,
  roundCalories,
  roundMacro,
  stepCounterAnnouncement,
  stepIndex,
  type CreateRecipeStepId,
  type WizardIngredient,
  type WizardMacroOverrides,
  type WizardStep,
} from "../../../../src/lib/recipes/createRecipeWizard";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker =
    require("expo-image-picker") as typeof import("expo-image-picker");
} catch {
  // Native module not available (Expo Go) — image picker disabled.
}

let _nextId = 0;
function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_nextId++}`;
}

function platformProp(): "ios" | "android" | "web" {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "web";
}

export default function CreateRecipeWizard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Wizard state (single state object so step-machine helpers can
  // operate on it directly — see `src/lib/recipes/createRecipeWizard.ts`).
  const [title, setTitle] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [servings, setServings] = useState<number>(SERVINGS_DEFAULT);
  const [ingredients, setIngredients] = useState<WizardIngredient[]>([]);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [macroOverrides, setMacroOverrides] = useState<WizardMacroOverrides>({});
  const [publish, setPublish] = useState(false);
  const [step, setStep] = useState<CreateRecipeStepId>(
    CREATE_RECIPE_STEP_IDS[0],
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReplaceId, setSearchReplaceId] = useState<string | null>(null);
  // F-128 (Grace, 2026-05-07): "we need to be able to add ingredients
  // by barcode etc (same ways we log food)". Wizard now mounts a
  // BarcodeScannerModal so the search sheet's quick-add icon can pivot
  // to scan without leaving the recipe-creation flow.
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reduced shape for step-machine helpers. State is split across
  // multiple `useState` slots so changes are minimal, but the helpers
  // accept a single state object.
  const wizardState = useMemo(
    () => ({
      step,
      title,
      imageUri,
      servings,
      ingredients,
      steps,
      macroOverrides,
      publish,
      dirty:
        title.length > 0 ||
        ingredients.length > 0 ||
        steps.length > 0 ||
        imageUri !== null,
    }),
    [step, title, imageUri, servings, ingredients, steps, macroOverrides, publish],
  );

  const advanceEnabled = canAdvance(wizardState);

  // ---- Step transitions -------------------------------------------------
  const goNext = useCallback(() => {
    if (!canAdvance(wizardState)) return;
    const target = nextStep(step);
    if (!target) return;
    track(AnalyticsEvents.recipe_create_wizard_step, {
      from: step,
      to: target,
      direction: "next",
      platform: platformProp(),
    });
    setStep(target);
    void Haptics.selectionAsync();
  }, [step, wizardState]);

  const goBack = useCallback(() => {
    const target = prevStep(step);
    if (!target) {
      // First step Back behaves like Cancel — confirm if the user has
      // entered anything (CR-07 audit P1 — discard-changes guard).
      if (
        title.trim() ||
        ingredients.length > 0 ||
        steps.length > 0 ||
        imageUri !== null
      ) {
        Alert.alert(
          "Discard recipe?",
          "You'll lose what you've entered so far.",
          [
            { text: "Keep editing", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => router.back(),
            },
          ],
        );
        return;
      }
      router.back();
      return;
    }
    track(AnalyticsEvents.recipe_create_wizard_step, {
      from: step,
      to: target,
      direction: "back",
      platform: platformProp(),
    });
    setStep(target);
    void Haptics.selectionAsync();
  }, [step, title, ingredients, steps, imageUri, router]);

  // ---- Step 1 helpers ---------------------------------------------------
  const pickImage = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert(
        "Image picker unavailable",
        "Image upload requires a development build. Not supported in Expo Go.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const stepServings = useCallback(
    (delta: number) => setServings((s) => clampServings(s + delta)),
    [],
  );

  // ---- Step 2 helpers ---------------------------------------------------
  const onFoodSelected = useCallback(
    (result: SelectedFood) => {
      // 2026-05-06: per-serving-only FatSecret foods don't have a
      // per-100g basis. Use `macrosPerServing × quantity` directly for
      // the recipe-ingredient totals.
      const isPerServingOnly =
        result.macrosPer100g === null && Boolean(result.macrosPerServing);
      const grams = isPerServingOnly ? 0 : result.chosenPortion.gramWeight * result.quantity;
      const f = isPerServingOnly ? 0 : grams / 100;
      const ps = result.macrosPerServing;
      const q = result.quantity;
      const patch = {
        name: result.name,
        amount: String(result.quantity),
        unit: result.chosenPortion.label,
        calories: isPerServingOnly && ps
          ? Math.round(ps.calories * q)
          : Math.round((result.macrosPer100g?.calories ?? 0) * f),
        protein: isPerServingOnly && ps
          ? Math.round(ps.protein * q * 10) / 10
          : Math.round((result.macrosPer100g?.protein ?? 0) * f * 10) / 10,
        carbs: isPerServingOnly && ps
          ? Math.round(ps.carbs * q * 10) / 10
          : Math.round((result.macrosPer100g?.carbs ?? 0) * f * 10) / 10,
        fat: isPerServingOnly && ps
          ? Math.round(ps.fat * q * 10) / 10
          : Math.round((result.macrosPer100g?.fat ?? 0) * f * 10) / 10,
        fiberG: isPerServingOnly
          ? 0
          : Math.round((result.macrosPer100g?.fiberG ?? 0) * f * 10) / 10,
        source: result.source,
      };
      setIngredients((prev) => {
        if (searchReplaceId) {
          return prev.map((i) =>
            i.id === searchReplaceId ? { ...i, ...patch } : i,
          );
        }
        return [...prev, { id: newId("ing"), ...patch }];
      });
      // Macro overrides are only valid against the auto-computed totals
      // of the ingredient set captured at Step 4 entry. Mutating
      // ingredients invalidates them — clear so the user re-confirms.
      setMacroOverrides({});
      setSearchReplaceId(null);
      setSearchOpen(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [searchReplaceId],
  );

  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    setMacroOverrides({});
  }, []);

  // F-128 — handle a scanned product. Mirrors `onBarcodeScanned` in
  // `apps/mobile/app/create-recipe.tsx`: 100 g default portion, OFF
  // source, append-only (the user can edit the row after).
  const onBarcodeScanned = useCallback(
    (_barcode: string, product: BarcodeProduct) => {
      const grams = product.servingSizeG ?? 100;
      const f = grams / 100;
      setIngredients((prev) => [
        ...prev,
        {
          id: newId("ing"),
          name: product.name,
          amount: String(grams),
          unit: "g",
          calories: Math.round(product.calories * f),
          protein: Math.round(product.protein * f * 10) / 10,
          carbs: Math.round(product.carbs * f * 10) / 10,
          fat: Math.round(product.fat * f * 10) / 10,
          fiberG: Math.round(product.fiberG * f * 10) / 10,
          source: "OFF",
        },
      ]);
      setMacroOverrides({});
      setBarcodeOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [],
  );

  // ---- Step 3 helpers ---------------------------------------------------
  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, { id: newId("step"), text: "" }]);
  }, []);

  const updateStepText = useCallback((id: string, text: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const moveStep = useCallback((id: string, direction: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }, []);

  // ---- Step 4 helpers (macro overrides) ---------------------------------
  const perServing = useMemo(
    () => computePerServing({ ingredients, servings, macroOverrides }),
    [ingredients, servings, macroOverrides],
  );

  const setOverride = useCallback(
    (key: keyof WizardMacroOverrides, raw: string) => {
      setMacroOverrides((prev) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num < 0) return prev;
        return { ...prev, [key]: num };
      });
    },
    [],
  );

  // ---- Save -------------------------------------------------------------
  async function uploadImage(recipeId: string): Promise<string | null> {
    if (!imageUri) return null;
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const r = reader.result as string;
          resolve(r.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `recipes/${recipeId}.${ext}`;
      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(path, decode(base64), {
          contentType: `image/${ext}`,
          upsert: true,
        });
      if (error) return null;
      const { data } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  const onSave = useCallback(
    async (publishOnSave: boolean) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to create a recipe.");
        return;
      }
      if (!isTitleStepValid({ title })) {
        Alert.alert("Missing title", "Give your recipe a name.");
        return;
      }
      if (!isIngredientsStepValid({ ingredients })) {
        Alert.alert("No ingredients", "Add at least one ingredient.");
        return;
      }

      // CR-03 audit (2026-04-28): publish path requires explicit
      // attestation. Mirror the web GoPublicDialog semantic with an
      // Alert + Cancel/Publish prompt.
      if (publishOnSave) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Publish to community?",
            "I created this recipe and I have the right to share it publicly. Publishing makes it visible in Discover.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Publish",
                style: "default",
                onPress: () => resolve(true),
              },
            ],
          );
        });
        if (!proceed) return;
      }

      setSaving(true);
      try {
        const srv = clampServings(servings);
        const instructionsString = steps
          .map((s) => s.text.trim())
          .filter(Boolean)
          .join("\n\n");
        // F-72: round at the boundary even though `computePerServing`
        // already rounds. Defensive against future code paths that
        // bypass the helper, and aligns with the NUMERIC(10, 2) column
        // type widened in migration 20260508100000_recipes_macros_numeric.
        const { data: row, error: insErr } = await supabase
          .from("recipes")
          .insert({
            author_id: userId,
            title: normalizeRecipeTitle(title.trim()),
            description: null,
            instructions: normaliseInstructions(instructionsString) || null,
            servings: srv,
            published: publishOnSave,
            calories: roundCalories(perServing.calories),
            protein: roundMacro(perServing.protein),
            carbs: roundMacro(perServing.carbs),
            fat: roundMacro(perServing.fat),
          })
          .select("id")
          .single();
        if (insErr || !row) {
          Alert.alert("Error", insErr?.message ?? "Could not save recipe.");
          setSaving(false);
          return;
        }
        const recipeId = (row as { id: string }).id;

        const imgUrl = await uploadImage(recipeId);
        if (imgUrl) {
          await supabase
            .from("recipes")
            .update({ image_url: imgUrl })
            .eq("id", recipeId);
        }

        // F-72: ingredient macro columns were widened to NUMERIC(10, 2)
        // alongside the per-recipe columns. We previously `Math.round`-ed
        // these to fit the integer column; now we 1-decimal-round to
        // match the per-recipe write shape. fiber_g was already numeric
        // and stays untouched.
        const ingRows = ingredients.map((ing) => ({
          recipe_id: recipeId,
          name: ing.name,
          amount: parseFloat(ing.amount) || null,
          unit: ing.unit || null,
          calories: roundCalories(ing.calories),
          protein: roundMacro(ing.protein),
          carbs: roundMacro(ing.carbs),
          fat: roundMacro(ing.fat),
          fiber_g: roundMacro(ing.fiberG),
          is_verified: true,
          source: ing.source,
        }));
        if (ingRows.length > 0) {
          await supabase.from("recipe_ingredients").insert(ingRows);
        }
        await supabase
          .from("saves")
          .insert({ user_id: userId, recipe_id: recipeId });

        track(AnalyticsEvents.recipe_create_wizard_saved, {
          recipe_id: recipeId,
          published: publishOnSave,
          ingredient_count: ingredients.length,
          step_count: steps.filter((s) => s.text.trim().length > 0).length,
          has_macro_overrides: hasMacroOverrides({ macroOverrides }),
          platform: platformProp(),
        });
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        router.replace(`/recipe/${recipeId}`);
      } catch (e) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Something went wrong.",
        );
      }
      setSaving(false);
    },
    [
      userId,
      title,
      ingredients,
      steps,
      servings,
      perServing,
      macroOverrides,
      router,
    ],
  );

  // ---- Styles -----------------------------------------------------------
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: Spacing.md,
        },
        backHit: { padding: 6, marginLeft: -6 },
        topMeta: { flex: 1, alignItems: "center" },
        topTitle: {
          color: Accent.primary,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 2,
        },
        topStep: {
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
        progressRow: {
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
        },
        progressDot: {
          flex: 1,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
        },
        progressDotActive: { backgroundColor: Accent.primary },
        scroll: {
          padding: Spacing.xl,
          gap: Spacing.lg,
          paddingBottom: 140,
        },
        label: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        sectionTitle: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.4,
        },
        sectionSub: {
          fontSize: 14,
          color: colors.textSecondary,
          lineHeight: 20,
          marginTop: 4,
        },
        input: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: Spacing.lg,
          paddingVertical: 14,
          color: colors.text,
          fontSize: 16,
        },
        multilineInput: {
          minHeight: 100,
          textAlignVertical: "top",
        },
        // Step 1 — photo
        photoTouch: { width: "100%" },
        photoPreview: {
          width: "100%",
          height: 200,
          borderRadius: Radius.lg,
        },
        photoFallback: {
          width: "100%",
          height: 180,
          borderRadius: Radius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderStyle: "dashed",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          gap: Spacing.xs,
        },
        servingsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
        },
        servingsBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        servingsValue: {
          minWidth: 56,
          textAlign: "center",
          fontSize: 24,
          fontWeight: "700",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        // Step 2 — ingredients
        ingCard: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
        },
        ingName: {
          flex: 1,
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
        },
        ingDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        addBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          paddingVertical: 14,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: Accent.primary + "50",
          borderStyle: "dashed",
        },
        addBtnText: {
          color: Accent.primary,
          fontWeight: "600",
          fontSize: 14,
        },
        // Step 3 — instructions
        stepRow: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          gap: Spacing.sm,
        },
        stepHeader: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
        },
        stepIndex: {
          fontSize: 12,
          fontWeight: "700",
          color: Accent.primary,
          letterSpacing: 1,
          flex: 1,
        },
        stepInput: {
          backgroundColor: colors.background,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          color: colors.text,
          fontSize: 15,
          minHeight: 64,
          textAlignVertical: "top",
        },
        stepIconBtn: { padding: 6 },
        // Step 4 — macros
        totalsCard: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Accent.primary + "30",
          padding: Spacing.lg,
        },
        macroFieldRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          paddingVertical: Spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        macroFieldLabel: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          fontWeight: "600",
        },
        macroFieldInput: {
          width: 96,
          textAlign: "right",
          backgroundColor: colors.background,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 10,
          color: colors.text,
          fontSize: 15,
          fontVariant: ["tabular-nums"],
        },
        // Save step
        saveCard: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: Spacing.md,
        },
        // Footer (Continue / Save)
        footer: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background + "f0",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
        },
        primaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          backgroundColor: Accent.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
        },
        primaryBtnText: {
          color: "#fff",
          fontWeight: "700",
          fontSize: 16,
        },
        secondaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          backgroundColor: "transparent",
          borderRadius: Radius.md,
          paddingVertical: 14,
          borderWidth: 1.5,
          borderColor: Accent.primary,
        },
        secondaryBtnText: {
          color: Accent.primary,
          fontWeight: "700",
          fontSize: 15,
        },
      }),
    [colors],
  );

  // ---- Render ----------------------------------------------------------
  const stepIdx = stepIndex(step);
  const counter = stepCounterAnnouncement(step);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={styles.backHit}
          accessibilityLabel={
            stepIdx === 0 ? "Cancel and discard recipe" : "Back to previous step"
          }
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View
          style={styles.topMeta}
          accessible
          accessibilityLabel={counter}
          accessibilityRole="header"
        >
          <Text style={styles.topTitle}>NEW RECIPE</Text>
          <Text style={styles.topStep}>
            Step {stepIdx + 1} of {CREATE_RECIPE_TOTAL_STEPS}
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.progressRow}>
        {CREATE_RECIPE_STEP_IDS.map((id, i) => (
          <View
            key={id}
            style={[
              styles.progressDot,
              i <= stepIdx && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "title-photo" && (
          <View style={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.sectionTitle}>What are you making?</Text>
              <Text style={styles.sectionSub}>
                Give your recipe a name and a hero photo. Photo is optional.
              </Text>
            </View>

            <Pressable
              style={styles.photoTouch}
              onPress={() => void pickImage()}
              accessibilityLabel="Choose recipe photo"
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoFallback}>
                  <Camera size={28} color={colors.textTertiary} />
                  <Text style={styles.label}>Add photo (optional)</Text>
                </View>
              )}
            </Pressable>

            <View style={{ gap: Spacing.sm }}>
              <Text style={styles.label}>Recipe name</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX_LENGTH))}
                placeholder="e.g. Tuesday tomato pasta"
                placeholderTextColor={colors.textTertiary}
                maxLength={TITLE_MAX_LENGTH}
                accessibilityLabel="Recipe name"
              />
              <Text
                style={{ fontSize: 11, color: colors.textTertiary, textAlign: "right" }}
              >
                {title.length}/{TITLE_MAX_LENGTH}
              </Text>
            </View>

            <View style={{ gap: Spacing.sm }}>
              <Text style={styles.label}>Servings</Text>
              <View style={styles.servingsRow}>
                <Pressable
                  style={styles.servingsBtn}
                  onPress={() => stepServings(-1)}
                  accessibilityLabel="Decrease servings"
                >
                  <Minus size={18} color={colors.text} />
                </Pressable>
                <Text style={styles.servingsValue}>{servings}</Text>
                <Pressable
                  style={styles.servingsBtn}
                  onPress={() => stepServings(1)}
                  accessibilityLabel="Increase servings"
                >
                  <Plus size={18} color={colors.text} />
                </Pressable>
                <Text
                  style={{ fontSize: 13, color: colors.textSecondary, marginLeft: Spacing.sm }}
                >
                  {servings === 1 ? "serving" : "servings"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {step === "ingredients" && (
          <View style={{ gap: Spacing.md }}>
            <View>
              <Text style={styles.sectionTitle}>What&apos;s in it?</Text>
              <Text style={styles.sectionSub}>
                Tap to search the food database. We&apos;ll match nutrition where
                we can. {ingredients.length === 0 ? "Add at least one ingredient to continue." : null}
              </Text>
            </View>
            {ingredients.map((ing) => {
              const p = parseIngredientLine(ing.name);
              const display = p.name.trim() || ing.name;
              return (
                <View key={ing.id} style={styles.ingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingName}>{display}</Text>
                    <Text style={styles.ingDetail}>
                      {ing.amount} {ing.unit} · {ing.calories} kcal · {ing.source}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeIngredient(ing.id)}
                    accessibilityLabel={`Remove ${display}`}
                    hitSlop={8}
                  >
                    <X size={20} color={Accent.destructive} />
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setSearchReplaceId(null);
                setSearchOpen(true);
              }}
              accessibilityLabel="Add ingredient"
            >
              <Plus size={18} color={Accent.primary} />
              <Text style={styles.addBtnText}>Add ingredient</Text>
            </Pressable>
          </View>
        )}

        {step === "steps" && (
          <View style={{ gap: Spacing.md }}>
            <View>
              <Text style={styles.sectionTitle}>How do you make it?</Text>
              <Text style={styles.sectionSub}>
                Add one step at a time. Reorder with the arrows. Combine-and-
                serve recipes can skip this step.
              </Text>
            </View>
            {steps.map((s, i) => (
              <View key={s.id} style={styles.stepRow}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepIndex}>STEP {i + 1}</Text>
                  <Pressable
                    style={styles.stepIconBtn}
                    onPress={() => moveStep(s.id, -1)}
                    accessibilityLabel={`Move step ${i + 1} up`}
                    disabled={i === 0}
                    hitSlop={8}
                  >
                    <ArrowUp
                      size={18}
                      color={i === 0 ? colors.textTertiary : colors.text}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.stepIconBtn}
                    onPress={() => moveStep(s.id, 1)}
                    accessibilityLabel={`Move step ${i + 1} down`}
                    disabled={i === steps.length - 1}
                    hitSlop={8}
                  >
                    <ArrowDown
                      size={18}
                      color={
                        i === steps.length - 1
                          ? colors.textTertiary
                          : colors.text
                      }
                    />
                  </Pressable>
                  <Pressable
                    style={styles.stepIconBtn}
                    onPress={() => removeStep(s.id)}
                    accessibilityLabel={`Delete step ${i + 1}`}
                    hitSlop={8}
                  >
                    <Trash2 size={18} color={Accent.destructive} />
                  </Pressable>
                </View>
                <TextInput
                  style={styles.stepInput}
                  value={s.text}
                  onChangeText={(t) => updateStepText(s.id, t)}
                  placeholder="e.g. Heat the olive oil over medium heat."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  accessibilityLabel={`Step ${i + 1} description`}
                />
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={addStep} accessibilityLabel="Add step">
              <Plus size={18} color={Accent.primary} />
              <Text style={styles.addBtnText}>Add step</Text>
            </Pressable>
          </View>
        )}

        {step === "macros" && (
          <View style={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.sectionTitle}>Macros look right?</Text>
              <Text style={styles.sectionSub}>
                Per serving, computed from your {ingredients.length}{" "}
                {ingredients.length === 1 ? "ingredient" : "ingredients"} ÷{" "}
                {servings} {servings === 1 ? "serving" : "servings"}. Override
                any macro if the auto-compute looks wrong — calories stay
                calculated.
              </Text>
            </View>
            <View style={styles.totalsCard}>
              {/* Calories — read-only, derived from ingredient sum / servings.
                  Locked because P*4+C*4+F*9 (Atwater) is an approximation
                  and inventing kcal independent of the ingredient data is
                  a nutrition-accuracy risk. The user can still override
                  P / C / F / Fiber per row below. */}
              <MacroOverrideRow
                label="Calories"
                color={MacroColors.calories}
                suffix="kcal"
                value={perServing.calories}
                override={undefined}
                onChange={() => {}}
                styles={styles}
                colors={colors}
                readOnly
                helperText={`Calculated from your ingredients · ${perServing.calories} kcal`}
              />
              <MacroOverrideRow
                label="Protein"
                color={MacroColors.protein}
                suffix="g"
                value={perServing.protein}
                override={macroOverrides.protein}
                onChange={(raw) => setOverride("protein", raw)}
                styles={styles}
                colors={colors}
              />
              <MacroOverrideRow
                label="Carbs"
                color={MacroColors.carbs}
                suffix="g"
                value={perServing.carbs}
                override={macroOverrides.carbs}
                onChange={(raw) => setOverride("carbs", raw)}
                styles={styles}
                colors={colors}
              />
              <MacroOverrideRow
                label="Fat"
                color={MacroColors.fat}
                suffix="g"
                value={perServing.fat}
                override={macroOverrides.fat}
                onChange={(raw) => setOverride("fat", raw)}
                styles={styles}
                colors={colors}
              />
              <MacroOverrideRow
                label="Fiber"
                color={MacroColors.fiber}
                suffix="g"
                value={perServing.fiberG}
                override={macroOverrides.fiberG}
                onChange={(raw) => setOverride("fiberG", raw)}
                styles={styles}
                colors={colors}
                last
              />
            </View>
            {hasMacroOverrides({ macroOverrides }) && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                Manually edited — these values will save instead of the
                auto-computed totals.
              </Text>
            )}
          </View>
        )}

        {step === "save" && (
          <View style={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.sectionTitle}>Save your recipe</Text>
              <Text style={styles.sectionSub}>
                &ldquo;{normalizeRecipeTitle(title.trim())}&rdquo; — {servings}{" "}
                {servings === 1 ? "serving" : "servings"} ·{" "}
                {ingredients.length}{" "}
                {ingredients.length === 1 ? "ingredient" : "ingredients"} ·{" "}
                {perServing.calories} kcal/serving
              </Text>
            </View>
            <View style={styles.saveCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <ImageIcon size={18} color={Accent.primary} />
                <Text
                  style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}
                >
                  Save private
                </Text>
                <Check size={18} color={colors.textTertiary} />
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Recipe lives in your library only — no one else sees it.
                You can publish later from the recipe page.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        {step === "save" ? (
          <View style={{ gap: Spacing.sm }}>
            <Pressable
              style={[styles.primaryBtn, saving && { opacity: 0.5 }]}
              onPress={() => void onSave(false)}
              disabled={saving}
              accessibilityLabel="Save recipe to private library"
            >
              {saving && !publish ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Save private</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, saving && { opacity: 0.5 }]}
              onPress={() => {
                setPublish(true);
                void onSave(true);
              }}
              disabled={saving}
              accessibilityLabel="Publish recipe to community"
            >
              {saving && publish ? (
                <ActivityIndicator color={Accent.primary} />
              ) : (
                <Text style={styles.secondaryBtnText}>Publish to community</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[
              styles.primaryBtn,
              !advanceEnabled && { opacity: 0.45 },
            ]}
            onPress={goNext}
            disabled={!advanceEnabled}
            accessibilityLabel={`Continue to step ${stepIdx + 2}`}
            accessibilityState={{ disabled: !advanceEnabled }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        )}
      </View>

      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        supabase={supabase}
        userId={userId ?? null}
        onSelect={onFoodSelected}
        onClose={() => {
          setSearchOpen(false);
          setSearchReplaceId(null);
        }}
        // F-128: scan barcode from inside the ingredient search sheet.
        // Close the search first (avoid stacked modals), clear the
        // replace target so the scan appends as a new ingredient via
        // the existing append-only `onBarcodeScanned` path.
        onScanBarcode={() => {
          setSearchReplaceId(null);
          setSearchOpen(false);
          setBarcodeOpen(true);
        }}
      />

      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={onBarcodeScanned}
        onClose={() => setBarcodeOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

/** Single field row on the macro-confirm step.
 *
 *  Display rules (per user feedback 2026-05-02):
 *  - The displayed value (auto-computed OR user override) renders in
 *    `colors.text` at weight 600 — same strength as any other resolved
 *    value in the app. Previously the value rode in the input's
 *    `placeholder` slot, which renders in `colors.textTertiary` on RN
 *    and read like a hint, not an actual figure.
 *  - The placeholder slot is reserved for the literal "auto" cue —
 *    only ever visible if the input is blanked AND the auto value is
 *    not a number. With per-serving math producing finite numbers in
 *    every realistic case, the placeholder is effectively unused; the
 *    cue lives instead in the helper text under the row.
 *  - `readOnly` flips the row to derived/locked: input is non-editable,
 *    a Calculator glyph sits next to the label, the value is dimmed to
 *    0.6 opacity, and `helperText` (e.g. "Calculated from your
 *    ingredients · 40 kcal") renders below the row to make the
 *    derivation explicit. Used for Calories — kcal is computed from
 *    the ingredient sum and is not a user-editable independent
 *    variable. */
type MacroOverrideRowStyles = {
  macroFieldRow: StyleProp<ViewStyle>;
  macroFieldLabel: StyleProp<TextStyle>;
  macroFieldInput: StyleProp<TextStyle>;
};

function MacroOverrideRow({
  label,
  color,
  suffix,
  value,
  override,
  onChange,
  styles,
  colors,
  last,
  readOnly,
  helperText,
}: {
  label: string;
  color: string;
  suffix: string;
  value: number;
  override: number | undefined;
  onChange: (raw: string) => void;
  styles: MacroOverrideRowStyles;
  colors: ReturnType<typeof useThemeColors>;
  last?: boolean;
  /** Disables the input + dims it + shows a Calculator glyph next to
   *  the label. The displayed value is then the immutable derived
   *  total; no user typing is accepted. */
  readOnly?: boolean;
  /** Single-line caption below the row, in textSecondary. Used to
   *  spell out where the value comes from when `readOnly`. */
  helperText?: string;
}) {
  // Resolved per-serving display — override wins, otherwise auto.
  // Rendered as the input's `value` prop (controlled), so it inherits
  // the input's full-strength text colour rather than the placeholder
  // colour (which read as a placeholder hint to users — the bug we're
  // fixing here).
  const displayedNumber = override ?? value;
  // Editable rows show the raw number (no suffix in the editable
  // string — the suffix only ever appeared as part of the placeholder
  // before, and once we move to a controlled value users would have
  // to delete the unit chars to type). Read-only rows still render
  // the suffix because the user can't edit them.
  const displayedString = readOnly
    ? `${displayedNumber}${suffix}`
    : String(displayedNumber);
  const row = (
    <View
      style={[
        styles.macroFieldRow,
        last ? { borderBottomWidth: 0 } : null,
        // When there's helper text, the parent stacks vertically and
        // we drop the horizontal row's bottom border (the wrapper
        // owns separation instead).
        helperText ? { borderBottomWidth: 0, paddingBottom: 0 } : null,
      ]}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={[styles.macroFieldLabel, { color, flex: 0 }]}>{label}</Text>
        {readOnly ? (
          <Calculator
            size={14}
            color={colors.textTertiary}
            accessibilityLabel="Calculated from ingredients"
          />
        ) : null}
      </View>
      <TextInput
        style={[
          styles.macroFieldInput,
          // Resolved value — full text colour, weight 600 — so 40kcal /
          // 1.6g / 0g read as actuals, not placeholders.
          { color: colors.text, fontWeight: "600" },
          readOnly
            ? {
                opacity: 0.6,
                // Subtle disabled treatment: muted bg + no border
                // pop, so the field reads as derived rather than an
                // input the user could tap.
                backgroundColor: "transparent",
                borderColor: "transparent",
              }
            : null,
        ]}
        value={displayedString}
        onChangeText={onChange}
        placeholder="auto"
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
        // `editable={false}` is the canonical RN-native lock; `readOnly`
        // (RN 0.71+) is the parity-friendly mirror that react-native-web
        // forwards to the underlying <input>. We set both so the lock
        // is honoured on iOS native AND on the web build.
        editable={!readOnly}
        readOnly={readOnly}
        accessibilityLabel={
          readOnly
            ? `${label} per serving — calculated · ${displayedNumber}${suffix}`
            : `${label} per serving (auto: ${value}${suffix})`
        }
        accessibilityState={{ disabled: !!readOnly }}
      />
    </View>
  );
  if (!helperText) return row;
  return (
    <View
      style={[
        // Wrap the row + helper caption under a shared bottom border,
        // matching the per-row separators used when no caption is
        // present.
        {
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingVertical: Spacing.sm,
        },
      ]}
    >
      {row}
      <Text
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          textAlign: "right",
          marginTop: 4,
        }}
        accessibilityLabel={helperText}
      >
        {helperText}
      </Text>
    </View>
  );
}
