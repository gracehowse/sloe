import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";

import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { decodeEntities } from "@/lib/decodeEntities";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";
import {
  IMPORT_ERROR_COPY,
  mapPersistenceError,
  userFacingImportError,
} from "../../../src/lib/recipes/importErrorCopy";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import FoodSearchModal, { type SelectedFood } from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import VoiceLogSheet from "@/components/VoiceLogSheet";
import PhotoLogSheet from "@/components/PhotoLogSheet";
import type { BarcodeProduct } from "@/lib/verifyRecipe";
import type { AiLoggedItem } from "../../../src/lib/nutrition/aiLogging";
import MealTypePicker from "@/components/MealTypePicker";
import { normaliseInstructions } from "../../../src/lib/recipes/normaliseInstructions";
import { normalizeRecipeTitle } from "../../../src/lib/recipes/normalizeRecipeTitle";
import { parseIngredientLine } from "../../../src/lib/recipe-ingredients/parseIngredientLine";
import { parseRawIngredients } from "../../../src/lib/recipe-ingredients/parseRawIngredients";
import { splitPastedIngredientLines } from "../../../src/lib/recipe-ingredients/splitPastedIngredientLines";
import { flatMacroRowsFromVerifyJson } from "../../../src/lib/nutrition/verifyRecipeResponse";
import { ingredientVerifyNeedsReview } from "../../../src/lib/nutrition/verifyConfidencePolicy";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
} catch {
  // Native module not available (Expo Go) — image picker will be disabled
}

type Ingredient = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  source: string;
};

let _nextId = 0;
function newIngId() {
  return `ing_${Date.now()}_${_nextId++}`;
}

type ImageImportNutritionRow = {
  name?: string;
  amount?: string;
  unit?: string;
  confidence?: number;
  source?: string;
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
  } | null;
};

function ingredientsFromLinesAndVerify(
  lines: string[],
  verifyJson: Record<string, unknown>,
): Ingredient[] {
  const rows = flatMacroRowsFromVerifyJson(verifyJson);
  const out: Ingredient[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const p = parseIngredientLine(line);
    const r = rows?.[i];
    if (r) {
      out.push({
        id: newIngId(),
        name: line,
        amount: p.amount || "1",
        unit: p.unit || "",
        calories: Math.round(r.calories),
        protein: Math.round(r.protein * 10) / 10,
        carbs: Math.round(r.carbs * 10) / 10,
        fat: Math.round(r.fat * 10) / 10,
        fiberG: Math.round(r.fiber * 10) / 10,
        source: r.source || "Verified",
      });
    } else {
      out.push({
        id: newIngId(),
        name: line,
        amount: p.amount || "1",
        unit: p.unit || "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiberG: 0,
        source: "Pending",
      });
    }
  }
  return out;
}

function ingredientsFromImageResponse(
  lines: string[],
  nutrition: { ingredientRows?: ImageImportNutritionRow[] } | null | undefined,
): Ingredient[] {
  if (!nutrition?.ingredientRows?.length) {
    return lines.map((line) => {
      const p = parseIngredientLine(line.trim());
      return {
        id: newIngId(),
        name: line.trim(),
        amount: p.amount || "1",
        unit: p.unit || "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiberG: 0,
        source: "Pending",
      };
    });
  }
  const out: Ingredient[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const row = nutrition.ingredientRows[i];
    const p = parseIngredientLine(line);
    const m = row?.macros;
    out.push({
      id: newIngId(),
      name: line,
      amount: row?.amount ?? p.amount ?? "1",
      unit: row?.unit ?? p.unit ?? "",
      calories: Math.round(m?.calories ?? 0),
      protein: Math.round((m?.protein ?? 0) * 10) / 10,
      carbs: Math.round((m?.carbs ?? 0) * 10) / 10,
      fat: Math.round((m?.fat ?? 0) * 10) / 10,
      fiberG: Math.round((m?.fiberG ?? 0) * 10) / 10,
      source: row?.source ?? (m ? "Verified" : "Pending"),
    });
  }
  return out;
}

export default function CreateRecipeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBackOrCancel = useSafeBack("/(tabs)/more");
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [mealTags, setMealTags] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  /** When set, the food search modal replaces this ingredient instead of appending. */
  const [searchReplaceId, setSearchReplaceId] = useState<string | null>(null);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [bulkMatching, setBulkMatching] = useState(false);
  const [imageExtracting, setImageExtracting] = useState(false);
  // F-122 (TestFlight `ACwYhlziV5Fop37xCsbuL2I`, 2026-05-06): Create
  // recipe page now supports barcode scan as a third quick-add path
  // alongside Paste list / Scan photo, mirroring verify.tsx.
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  // F-128 (Grace, 2026-05-07): voice + photo log as ingredient
  // entry-points — same sheets food-log uses; AI items append as
  // ingredients via `onAiItemsCommit`.
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [apiBase, setApiBase] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Constants = (await import("expo-constants")).default;
        const extra = Constants.expoConfig?.extra as
          | { supprApiUrl?: string }
          | undefined;
        if (!cancelled) setApiBase(extra?.supprApiUrl ?? "");
      } catch {
        if (!cancelled) setApiBase("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs,
        fat: acc.fat + i.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [ingredients]);

  const srv = parseInt(servings) || 1;
  const perServing = {
    calories: Math.round(totals.calories / srv),
    protein: Math.round(totals.protein / srv),
    carbs: Math.round(totals.carbs / srv),
    fat: Math.round(totals.fat / srv),
  };

  const mergePastedIngredients = useCallback((built: Ingredient[], mode: "replace" | "append") => {
    setIngredients((prev) => (mode === "append" ? [...prev, ...built] : built));
  }, []);

  const matchPastedIngredients = useCallback(async () => {
    if (!session?.access_token) {
      Alert.alert("Sign in", "You need to be signed in to match ingredients.");
      return;
    }
    const apiBase = getSupprApiBase();
    if (!apiBase) {
      Alert.alert("API not configured", "Set supprApiUrl in app config.");
      return;
    }
    const lines = splitPastedIngredientLines(pasteDraft);
    if (lines.length === 0) {
      Alert.alert("Nothing to paste", "Add one ingredient per line (e.g. 2 cups diced tomatoes).");
      return;
    }
    if (lines.length > 60) {
      Alert.alert("Too many lines", "Use at most 60 ingredients per batch.");
      return;
    }
    const srv = Math.max(1, parseInt(servings, 10) || 1);
    setBulkMatching(true);
    try {
      const res = await fetch(`${apiBase}/api/nutrition/verify-recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ingredients: parseRawIngredients(lines),
          servings: srv,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      const rows = flatMacroRowsFromVerifyJson(json);
      if (!json.ok || !rows?.length) {
        Alert.alert(
          "Could not match",
          (json.message as string) || (json.error as string) || "Try again or shorten the list.",
        );
        return;
      }
      const built = ingredientsFromLinesAndVerify(lines, json);
      const needsReview = ingredientVerifyNeedsReview(
        typeof json.avgIngredientConfidence === "number" ? json.avgIngredientConfidence : undefined,
        typeof json.minIngredientConfidence === "number" ? json.minIngredientConfidence : undefined,
      );
      const apply = (mode: "replace" | "append") => {
        mergePastedIngredients(built, mode);
        const plat = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
        track(AnalyticsEvents.recipe_create_paste_list_matched, {
          lineCount: lines.length,
          platform: plat,
          avgConfidence:
            typeof json.avgIngredientConfidence === "number" ? json.avgIngredientConfidence : undefined,
        });
        if (needsReview) {
          track(AnalyticsEvents.recipe_verify_needs_review, {
            source: "create_paste",
            platform: plat,
            avgIngredientConfidence:
              typeof json.avgIngredientConfidence === "number" ? json.avgIngredientConfidence : undefined,
            minIngredientConfidence:
              typeof json.minIngredientConfidence === "number" ? json.minIngredientConfidence : undefined,
          });
        }
        setPasteModalOpen(false);
        setPasteDraft("");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (needsReview) {
          Alert.alert(
            "Review nutrition matches",
            "Some ingredient lines matched with low confidence. Check each line before saving or publishing.",
          );
        }
      };
      if (ingredients.length > 0) {
        Alert.alert(
          "Add matched ingredients",
          needsReview
            ? "Lines were matched against USDA, Open Food Facts, FatSecret, Edamam, and Suppr foods. Some matches are uncertain—review each row after adding."
            : "Lines were matched against USDA, Open Food Facts, FatSecret, Edamam, and Suppr foods.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Append", onPress: () => apply("append") },
            { text: "Replace all", style: "destructive", onPress: () => apply("replace") },
          ],
        );
      } else {
        apply("replace");
      }
    } catch (e) {
      // Audit I01 (2026-05-05) — sanitise via central mapper so any
      // Postgrest / vendor leak in the thrown Error is stripped.
      console.error("[create-recipe] bulk match failed:", e instanceof Error ? e.message : e);
      Alert.alert("Error", userFacingImportError(e));
    } finally {
      setBulkMatching(false);
    }
  }, [session?.access_token, pasteDraft, servings, ingredients.length, mergePastedIngredients]);

  const importRecipeFromPhoto = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert("Unavailable", "Photo import needs a development build (not Expo Go).");
      return;
    }
    if (!session?.access_token) {
      Alert.alert("Sign in", "Sign in to scan a recipe photo.");
      return;
    }
    const apiBase = getSupprApiBase();
    if (!apiBase) {
      Alert.alert("API not configured", "Set supprApiUrl in app config.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setImageExtracting(true);
    try {
      const asset = result.assets[0];
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);

      const res = await authedFetch(`${apiBase}/api/recipe-import/image`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        title?: string | null;
        ingredients?: string[];
        steps?: string[];
        message?: string;
        error?: string;
        nutrition?: { ingredientRows?: ImageImportNutritionRow[] } | null;
      };
      if (res.status === 403 && data.error === "pro_required") {
        Alert.alert("Pro feature", data.message ?? "Scanning recipe photos requires Pro.");
        return;
      }
      if (!data.ok || !data.ingredients?.length) {
        Alert.alert(
          "Could not read photo",
          data.message ?? data.error ?? "Try a clearer photo of the ingredient list or card.",
        );
        return;
      }
      const lines = data.ingredients.map((s) => String(s).trim()).filter(Boolean);
      const decodedTitle = decodeEntities((data.title ?? "").trim());
      setTitle((t) => (t.trim() ? t : decodedTitle || "Imported recipe"));
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        setInstructions((prev) => (prev.trim() ? prev : data.steps!.map((s) => String(s).trim()).join("\n\n")));
      }
      setImageUri(asset.uri);
      const merged = ingredientsFromImageResponse(lines, data.nutrition);
      const plat = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
      track(AnalyticsEvents.recipe_create_photo_extracted, {
        ingredientCount: lines.length,
        platform: plat,
        hasServerNutrition: Boolean(data.nutrition?.ingredientRows?.length),
      });
      if (ingredients.length > 0) {
        Alert.alert("Replace ingredients?", "Photo scan found ingredients with database nutrition where possible.", [
          { text: "Cancel", style: "cancel" },
          { text: "Append", onPress: () => setIngredients((p) => [...p, ...merged]) },
          { text: "Replace all", style: "destructive", onPress: () => setIngredients(merged) },
        ]);
      } else {
        setIngredients(merged);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Network error while scanning the photo.");
    } finally {
      setImageExtracting(false);
    }
  }, [session?.access_token, ingredients.length]);

  const onFoodSelected = useCallback((result: SelectedFood) => {
    // 2026-05-06: per-serving-only FatSecret foods (no metric grounding)
    // can't be used as recipe ingredients — recipe math is per-gram.
    // Use macrosPerServing × quantity for the totals; mark as a single
    // "1 serving" unit so the recipe still adds up correctly even
    // though we can't scale by grams.
    const isPerServingOnly =
      result.macrosPer100g === null && Boolean(result.macrosPerServing);
    const grams = isPerServingOnly ? 0 : result.chosenPortion.gramWeight * result.quantity;
    const f = isPerServingOnly ? 0 : grams / 100;
    const ps = result.macrosPerServing;
    const q = result.quantity;
    const patch: Omit<Ingredient, "id"> = {
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
        return prev.map((i) => (i.id === searchReplaceId ? { ...i, ...patch } : i));
      }
      return [...prev, { id: newIngId(), ...patch }];
    });
    setSearchReplaceId(null);
    setSearchOpen(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [searchReplaceId]);

  // F-128 — AI items (voice/photo) → recipe ingredients. Same shape
  // mapping as the wizard so the two surfaces stay byte-identical.
  const onAiItemsCommit = useCallback((items: AiLoggedItem[]) => {
    if (items.length === 0) return;
    setIngredients((prev) => [
      ...prev,
      ...items.map((item) => {
        const amount =
          typeof item.grams === "number" && Number.isFinite(item.grams) && item.grams > 0
            ? item.grams
            : typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
              ? item.quantity
              : 1;
        const unit =
          typeof item.grams === "number" && Number.isFinite(item.grams) && item.grams > 0
            ? "g"
            : item.unit?.trim() || "piece";
        return {
          id: newIngId(),
          name: item.name,
          amount: String(amount),
          unit,
          calories: Math.round(item.calories),
          protein: Math.round(item.protein * 10) / 10,
          carbs: Math.round(item.carbs * 10) / 10,
          fat: Math.round(item.fat * 10) / 10,
          fiberG: Math.round((item.fiber ?? 0) * 10) / 10,
          source: item.source === "voice" ? "AI voice" : "AI photo",
        };
      }),
    ]);
    setVoiceLogOpen(false);
    setPhotoLogOpen(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const onBarcodeScanned = useCallback(
    (_barcode: string, product: BarcodeProduct) => {
      // Default to 100 g of the scanned product. The user can edit
      // the row afterward — same as Paste list / Scan photo paths.
      const grams = product.servingSizeG ?? 100;
      const f = grams / 100;
      setIngredients((prev) => [
        ...prev,
        {
          id: newIngId(),
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
      setBarcodeOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [],
  );

  const openAddIngredientSearch = useCallback(() => {
    setSearchReplaceId(null);
    setSearchOpen(true);
  }, []);

  const openReplaceIngredientSearch = useCallback((id: string) => {
    setSearchReplaceId(id);
    setSearchOpen(true);
  }, []);

  const searchModalIngredient = useMemo(
    () => (searchReplaceId ? ingredients.find((i) => i.id === searchReplaceId) : undefined),
    [ingredients, searchReplaceId],
  );

  const foodSearchInitial = useMemo(() => {
    const ing = searchModalIngredient;
    if (!ing) {
      return { query: "", amount: null as number | null, unit: null as string | null, original: null as string | null };
    }
    const p = parseIngredientLine(ing.name);
    const q = p.name.trim() || ing.name.trim();
    const amt = parseFloat(ing.amount);
    return {
      query: q,
      amount: Number.isFinite(amt) && amt > 0 ? amt : null,
      unit: ing.unit?.trim() ? ing.unit.trim() : null,
      original: ing.name.trim(),
    };
  }, [searchModalIngredient]);

  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const pickImage = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert("Image picker unavailable", "Image upload requires a development build. It is not supported in Expo Go.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  async function uploadImage(recipeId: string): Promise<string | null> {
    if (!imageUri) return null;
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `recipes/${recipeId}.${ext}`;
      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(path, decode(base64), { contentType: `image/${ext}`, upsert: true });
      if (error) return null;

      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  const onSave = useCallback(async () => {
    if (!userId) { Alert.alert("Sign in", "You need to be signed in to create a recipe."); return; }
    if (!title.trim()) { Alert.alert("Missing title", "Give your recipe a name."); return; }
    if (ingredients.length === 0) { Alert.alert("No ingredients", "Add at least one ingredient."); return; }

    // CR-03 fix (audit 2026-04-28): mobile Publish toggle was
    // unguarded — a user could flip the Switch and publish someone
    // else's recipe under their name. Web requires the GoPublicDialog
    // attestation checkbox; mobile had nothing equivalent. Now we
    // confirm via Alert when `publish` is on at save time. Cancel
    // returns to the form; OK proceeds with publish=true.
    if (publish) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Publish to community?",
          "I created this recipe and I have the right to share it publicly. Publishing makes it visible in Discover.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Publish", style: "default", onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const { data: row, error: insErr } = await supabase
        .from("recipes")
        .insert({
          author_id: userId,
          // Polish (2026-04-25): if the user typed in ALL CAPS by accident,
          // store as Title Case. Mixed-case inputs pass through untouched.
          title: normalizeRecipeTitle(title.trim()),
          description: description.trim() || null,
          instructions: normaliseInstructions(instructions) || null,
          servings: srv,
          published: publish,
          meal_type: mealTags.length > 0 ? mealTags : null,
          calories: perServing.calories,
          protein: perServing.protein,
          carbs: perServing.carbs,
          fat: perServing.fat,
        })
        .select("id")
        .single();

      if (insErr || !row) {
        // Audit I01 (2026-05-05) — never echo `insErr.message`;
        // Postgrest leaks table names + JWT + RLS hints.
        console.error("[create-recipe] insert failed:", insErr?.message ?? "no row");
        Alert.alert("Error", IMPORT_ERROR_COPY[mapPersistenceError(insErr ?? null)]);
        setSaving(false);
        return;
      }

      const recipeId = (row as { id: string }).id;

      const imgUrl = await uploadImage(recipeId);
      if (imgUrl) {
        await supabase.from("recipes").update({ image_url: imgUrl }).eq("id", recipeId);
      }

      const ingRows = ingredients.map((ing) => ({
        recipe_id: recipeId,
        name: ing.name,
        amount: parseFloat(ing.amount) || null,
        unit: ing.unit || null,
        calories: Math.round(ing.calories),
        protein: Math.round(ing.protein),
        carbs: Math.round(ing.carbs),
        fat: Math.round(ing.fat),
        fiber_g: ing.fiberG,
        is_verified: true,
        source: ing.source,
      }));

      await supabase.from("recipe_ingredients").insert(ingRows);
      await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/recipe/${recipeId}`);
    } catch {
      Alert.alert("Error", "Something went wrong.");
    }
    setSaving(false);
  }, [userId, title, description, instructions, srv, ingredients, perServing, mealTags, publish, imageUri, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 17, fontWeight: "600" },
    topTitle: { color: Accent.primary, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 120 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase" as const },
    input: {
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      color: colors.text, fontSize: 16,
    },
    multilineInput: { minHeight: 100, textAlignVertical: "top" as const },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

    // Ingredients
    ingCard: {
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: Spacing.md, flexDirection: "row", alignItems: "center",
    },
    ingName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
    ingDetail: { fontSize: 12, color: colors.textSecondary },
    removeBtn: { padding: 4 },

    addBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: Accent.primary + "50", borderStyle: "dashed" as const,
    },
    addBtnText: { color: Accent.primary, fontWeight: "600", fontSize: 14 },

    // Totals
    totalsCard: {
      backgroundColor: colors.card, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: Accent.primary + "30",
      padding: Spacing.lg,
    },
    totalsRow: { flexDirection: "row", justifyContent: "space-around" },
    totalItem: { alignItems: "center", gap: 2 },
    totalValue: { fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
    totalKey: { fontSize: 10, color: colors.textTertiary, fontWeight: "600" },

    // Footer
    footer: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.background + "f0",
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    },
    // 2026-04-26 polish: was Accent.success (green) — every other primary
    // submit action in the app uses Accent.primary (purple/blue). The green
    // save was a visual orphan; aligning to the canonical primary colour.
    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, backgroundColor: Accent.primary,
      borderRadius: Radius.md, paddingVertical: 16,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    imagePicker: { alignItems: "center" },
    imagePreview: { width: "100%", height: 200, borderRadius: Radius.lg },
    imagePlaceholder: {
      width: "100%", height: 160, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed" as const,
      justifyContent: "center", alignItems: "center",
      backgroundColor: colors.card,
    },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    quickBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    quickBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
    modalBackdrop: { flex: 1, backgroundColor: "#0007", justifyContent: "flex-end" },
    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
      maxHeight: "88%",
    },
    pasteInput: {
      minHeight: 160,
      textAlignVertical: "top" as const,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      color: colors.text,
      fontSize: 15,
    },
    modalActions: { flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" },
    modalBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: Radius.md },
    publishRow: {
      flexDirection: "row", alignItems: "center", gap: Spacing.md,
      backgroundColor: colors.card, borderRadius: Radius.md,
      padding: Spacing.lg, borderWidth: 1, borderColor: colors.border,
    },
  }), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 2026-04-26 polish: pre-fix this strip carried "Cancel" (Title case)
          AND "CREATE" (uppercase) AND a bottom "Save Recipe" button — three
          competing affordances. Two were duplicates of the same submit
          action. Now: Cancel left, screen title centered, no top-right
          submit. The bottom-of-form Save Recipe button is the single
          submit affordance, matching every other form in the app. */}
      <View style={styles.topBar}>
        <Pressable onPress={goBackOrCancel} hitSlop={12}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>New recipe</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Image */}
        <Pressable onPress={() => void pickImage()} style={styles.imagePicker}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.label, { marginTop: Spacing.xs }]}>Add photo</Text>
            </View>
          )}
        </Pressable>

        {/* Title */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Recipe name</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Chicken stir-fry" placeholderTextColor={colors.textTertiary} />
        </View>

        {/* Description */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="A short description of your recipe"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Servings */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Servings</Text>
          <TextInput style={[styles.input, { width: 80 }]} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textTertiary} />
        </View>

        {/* Meal type */}
        <MealTypePicker selected={mealTags} onChange={setMealTags} label="MEAL TYPE" />

        {/* Ingredients */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Ingredients</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            Paste a list or scan a photo to pre-fill lines. Tap the search icon on any row to pick the correct food from
            the database if a match looks wrong.
          </Text>
          <View style={styles.quickRow}>
            <Pressable
              style={[styles.quickBtn, (bulkMatching || !session) && { opacity: 0.45 }]}
              onPress={() => setPasteModalOpen(true)}
              disabled={bulkMatching || !session}
            >
              <Ionicons name="clipboard-outline" size={18} color={Accent.primary} />
              <Text style={styles.quickBtnText}>Paste list</Text>
            </Pressable>
            <Pressable
              style={[styles.quickBtn, (imageExtracting || !session) && { opacity: 0.45 }]}
              onPress={() => void importRecipeFromPhoto()}
              disabled={imageExtracting || !session}
            >
              <Ionicons name="scan-outline" size={18} color={Accent.primary} />
              <Text style={styles.quickBtnText}>Scan photo</Text>
            </Pressable>
            <Pressable
              style={[styles.quickBtn, !session && { opacity: 0.45 }]}
              onPress={() => setBarcodeOpen(true)}
              disabled={!session}
              accessibilityRole="button"
              accessibilityLabel="Scan barcode to add ingredient"
            >
              <Ionicons name="barcode-outline" size={18} color={Accent.primary} />
              <Text style={styles.quickBtnText}>Scan barcode</Text>
            </Pressable>
          </View>
          {(bulkMatching || imageExtracting) && (
            <View style={styles.row}>
              <ActivityIndicator color={Accent.primary} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {imageExtracting ? "Reading recipe from photo…" : "Matching ingredients to database…"}
              </Text>
            </View>
          )}
          {ingredients.map((ing) => (
            <View key={ing.id} style={styles.ingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingName}>{ing.name}</Text>
                <Text style={styles.ingDetail}>
                  {ing.amount} {ing.unit} · {ing.calories} kcal · {ing.source}
                </Text>
              </View>
              <Pressable
                style={styles.removeBtn}
                onPress={() => openReplaceIngredientSearch(ing.id)}
                accessibilityRole="button"
                accessibilityLabel="Search or change ingredient"
                hitSlop={8}
              >
                <Ionicons name="search-outline" size={22} color={Accent.primary} />
              </Pressable>
              <Pressable style={styles.removeBtn} onPress={() => removeIngredient(ing.id)} accessibilityLabel="Remove ingredient">
                <Ionicons name="close-circle" size={22} color={Accent.destructive + "80"} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={openAddIngredientSearch}>
            <Ionicons name="add" size={18} color={Accent.primary} />
            <Text style={styles.addBtnText}>Add ingredient</Text>
          </Pressable>
        </View>

        {/* Totals */}
        {ingredients.length > 0 && (
          <View style={styles.totalsCard}>
            <Text style={[styles.label, { marginBottom: Spacing.sm }]}>Per serving ({srv} serving{srv !== 1 ? "s" : ""})</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{perServing.calories}</Text>
                <Text style={styles.totalKey}>kcal</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.protein }]}>{perServing.protein}g</Text>
                <Text style={styles.totalKey}>protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.carbs }]}>{perServing.carbs}g</Text>
                <Text style={styles.totalKey}>carbs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.fat }]}>{perServing.fat}g</Text>
                <Text style={styles.totalKey}>fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Instructions (optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={instructions}
            onChangeText={setInstructions}
            // P1-26 (TestFlight `AO4NtyNBpP4FJRgq7mCV5cs`, 2026-04-25):
            // RN's TextInput placeholder doesn't honour the `\n` escape
            // on iOS — the user saw a literal "\n" in the field.
            // Switch to a single-line directive that holds up across
            // platforms.
            placeholder="Describe each step on a new line"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        {/* Publish toggle */}
        <View style={styles.publishRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { marginBottom: 2 }]}>Publish to community</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Others can discover and save your recipe
            </Text>
          </View>
          <Switch
            value={publish}
            onValueChange={setPublish}
            trackColor={{ false: colors.border, true: Accent.success + "80" }}
            thumbColor={publish ? Accent.success : colors.textTertiary}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[styles.saveBtn, (saving || !title.trim()) && { opacity: 0.5 }]}
          onPress={() => void onSave()}
          disabled={saving || !title.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Recipe</Text>
            </>
          )}
        </Pressable>
      </View>

      <Modal visible={pasteModalOpen} animationType="slide" transparent onRequestClose={() => setPasteModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !bulkMatching && setPasteModalOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.label, { letterSpacing: 0 }]}>Paste ingredient list</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              One ingredient per line (amounts help). We match each line like MyFitnessPal: USDA, Open Food Facts, FatSecret, Edamam, then Suppr foods.
            </Text>
            <TextInput
              style={styles.pasteInput}
              value={pasteDraft}
              onChangeText={setPasteDraft}
              placeholder={"2 tbsp olive oil\n1 onion, diced\n400g canned tomatoes"}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={() => !bulkMatching && setPasteModalOpen(false)}
                disabled={bulkMatching}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: Accent.primary }]}
                onPress={() => void matchPastedIngredients()}
                disabled={bulkMatching}
              >
                {bulkMatching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontWeight: "700", color: "#fff" }}>Match</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Food search modal */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery={foodSearchInitial.query}
        initialAmount={foodSearchInitial.amount}
        initialUnit={foodSearchInitial.unit}
        originalDescription={foodSearchInitial.original}
        supabase={supabase}
        userId={userId ?? null}
        onSelect={onFoodSelected}
        onClose={() => {
          setSearchOpen(false);
          setSearchReplaceId(null);
        }}
        // F-128 (Grace, 2026-05-07): scan barcode from inside the
        // ingredient search sheet — same input mode the food-log
        // sheet exposes. We close the search first (avoid stacked
        // modals) and clear any in-flight replace target so the scan
        // appends as a new ingredient via the existing
        // `onBarcodeScanned` flow.
        onScanBarcode={() => {
          setSearchReplaceId(null);
          setSearchOpen(false);
          setBarcodeOpen(true);
        }}
        onVoiceLog={() => {
          setSearchReplaceId(null);
          setSearchOpen(false);
          setVoiceLogOpen(true);
        }}
        onPhotoLog={() => {
          setSearchReplaceId(null);
          setSearchOpen(false);
          setPhotoLogOpen(true);
        }}
      />

      {/* F-122: barcode scanner — adds a new ingredient using the
          scanned product's per-100g macros. */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={onBarcodeScanned}
        onClose={() => setBarcodeOpen(false)}
      />

      <VoiceLogSheet
        visible={voiceLogOpen}
        onClose={() => setVoiceLogOpen(false)}
        activeSlot="recipe"
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={onAiItemsCommit}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
          primaryForeground: colors.primaryForeground,
        }}
      />

      <PhotoLogSheet
        visible={photoLogOpen}
        onClose={() => setPhotoLogOpen(false)}
        activeSlot="recipe"
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={onAiItemsCommit}
        onUpgradeRequired={() => setPhotoLogOpen(false)}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
          primaryForeground: colors.primaryForeground,
        }}
      />
    </KeyboardAvoidingView>
  );
}
