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

import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { saveImportedRecipe, type ApiImportedRecipe } from "@/lib/saveImportedRecipe";
import { classifyMealType } from "@/lib/classifyMealType";
import MealTypePicker from "@/components/MealTypePicker";
import {
  extractUrlFromShareText,
  urlFromDeepLink,
  urlFromRouterParams,
} from "@/lib/resolveImportUrl";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try { ImagePicker = require("expo-image-picker"); } catch { /* native build only */ }

type Extra = { platemateApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

type ImportState = "idle" | "checking" | "importing" | "review" | "saving" | "success" | "error";

export default function ImportSharedScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;

  const [state, setState] = useState<ImportState>("idle");
  const [title, setTitle] = useState<string | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [pendingRecipe, setPendingRecipe] = useState<ApiImportedRecipe | null>(null);
  const [mealTags, setMealTags] = useState<string[]>([]);
  const base = apiBase();
  const runImportRef = useRef<(url: string) => Promise<void>>(async () => {});
  /** Same URL can be delivered via router + Linking + clipboard; avoid parallel duplicate imports. */
  const importInFlightRef = useRef<string | null>(null);

  const runImport = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;

      if (!base) {
        setState("error");
        setError("API not configured. Set platemateApiUrl in app config.");
        return;
      }

      if (!userId) {
        setState("error");
        setError("Sign in to save imported recipes to your library.");
        return;
      }

      setState("importing");
      setError(null);
      setSavedRecipeId(null);

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
        };

        if (!data.ok || !data.recipe) {
          setState("error");
          setError(data.message ?? "Could not extract a recipe from this link.");
          return;
        }

        console.log("[import] API response - calories:", data.recipe.calories,
          "ingredientMacros:", data.recipe.ingredientMacros?.length,
          "first:", JSON.stringify(data.recipe.ingredientMacros?.[0])?.substring(0, 100));

        // Auto-classify meal type as default, let user edit
        const ingredients = Array.isArray(data.recipe.ingredients)
          ? data.recipe.ingredients.map(String)
          : [];
        const autoTags = classifyMealType({
          title: data.recipe.title ?? "",
          ingredients,
          caloriesPerServing: data.recipe.calories ?? null,
        });
        setMealTags(autoTags);
        setPendingRecipe(data.recipe);
        setTitle((data.recipe.title ?? "Imported recipe").trim() || "Imported recipe");
        setState("review");
      } catch {
        setState("error");
        setError("Network error. Check your connection.");
      }
    },
    [base, userId],
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
        setError(data.message ?? data.error ?? "Could not extract a recipe from this image.");
        return;
      }

      const recipe: ApiImportedRecipe = {
        title: data.title ?? "Photo Import",
        ingredients: data.ingredients,
        steps: data.steps ?? [],
        servings: 1,
        calories: data.nutrition?.perServing?.calories ?? null,
        protein: data.nutrition?.perServing?.protein ?? null,
        carbs: data.nutrition?.perServing?.carbs ?? null,
        fat: data.nutrition?.perServing?.fat ?? null,
      };
      const autoTags = classifyMealType({
        title: recipe.title ?? "",
        ingredients: data.ingredients,
        caloriesPerServing: recipe.calories,
      });
      setMealTags(autoTags);
      setPendingRecipe(recipe);
      setTitle(recipe.title ?? "Photo Import");
      setState("review");
    } catch {
      setState("error");
      setError("Network error during image import.");
    }
  }, [base, userId]);

  const confirmSave = useCallback(async () => {
    if (!pendingRecipe || !userId) return;
    setState("saving");
    const recipeWithTags = { ...pendingRecipe, mealType: mealTags };
    const saved = await saveImportedRecipe(userId, recipeWithTags);
    if ("error" in saved) {
      setState("error");
      setError(saved.error);
      return;
    }
    setSavedRecipeId(saved.recipeId);
    setState("success");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingRecipe, userId, mealTags]);

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
      if (!cancelled) await runImportOnce(routerUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, routerUrl, runImportOnce]);

  /**
   * No ?url= yet: read platemate:// initial link, then clipboard (delayed retries for iOS pasteboard).
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
      if (!/^platemate:/i.test(href)) return;
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
      setError("Paste a full URL (Instagram, TikTok, or a recipe page).");
      setState("error");
      return;
    }
    void runImport(url);
  };

  const onPasteFromClipboard = async () => {
    const t = await safeGetClipboardString();
    if (!t) {
      setError("Clipboard isn’t available in this build. Run a fresh native build (expo run:ios / run:android) or paste a URL manually.");
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
    setError("Clipboard doesn’t contain a link we can use.");
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
      color: Neon.purple,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 3,
    },
    scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, paddingTop: Spacing.lg, gap: Spacing.lg },
    scrollCentered: { flexGrow: 1, justifyContent: "center", paddingTop: Spacing.md },

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
    brandCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Neon.purple,
      justifyContent: "center",
      alignItems: "center",
    },
    brandLetter: { color: "#fff", fontSize: 24, fontWeight: "800" },
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
      backgroundColor: Neon.purple + "18",
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
      borderColor: Neon.green + "35",
      paddingVertical: Spacing.xxxl,
      paddingHorizontal: Spacing.xxl,
      alignItems: "center",
      gap: Spacing.md,
      // subtle "sheet" depth
      shadowColor: Neon.purple,
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
      color: Neon.green,
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
      backgroundColor: Neon.purple + "22",
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Neon.purple + "44",
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    libraryChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#e9d5ff",
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
      backgroundColor: Neon.purple,
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
      borderColor: Neon.purple + "55",
      marginTop: Spacing.xs,
    },
    outlineBtnPressed: { backgroundColor: Neon.purple + "12" },
    outlineBtnText: { color: Neon.purple, fontWeight: "700", fontSize: 15 },

    textLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: Spacing.md,
    },
    textLinkLabel: { color: Neon.purple, fontWeight: "600", fontSize: 15 },
  }), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
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
        {(authLoading || state === "checking" || state === "importing") && (
          <View style={styles.panelCard}>
            <View style={styles.brandCircle}>
              <Text style={styles.brandLetter}>P</Text>
            </View>
            <ActivityIndicator size="large" color={Neon.purple} style={styles.loaderGap} />
            <Text style={styles.panelTitle}>
              {authLoading || state === "checking" ? "Looking for a link…" : "Pulling recipe…"}
            </Text>
            <Text style={styles.panelSub}>
              Instagram, TikTok, or any recipe page — we’ll save it to your library.
            </Text>
          </View>
        )}

        {(state === "review" || state === "saving") && pendingRecipe && (
          <View style={styles.panelCard}>
            <Ionicons name="restaurant-outline" size={36} color={Neon.purple} />
            <Text style={styles.panelTitle}>{title ?? "Imported recipe"}</Text>
            {pendingRecipe.calories != null && (
              <Text style={styles.panelSub}>
                {pendingRecipe.calories} kcal · {pendingRecipe.protein ?? 0}g protein · {pendingRecipe.servings ?? 1} serving{(pendingRecipe.servings ?? 1) !== 1 ? "s" : ""}
              </Text>
            )}

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
              <Ionicons name="checkmark-circle" size={72} color={Neon.green} />
            </View>
            <Text style={styles.successKicker}>SAVED</Text>
            <Text style={styles.successRecipeTitle} numberOfLines={4}>
              {title}
            </Text>
            <View style={styles.libraryChip}>
              <Ionicons name="bookmark" size={18} color={Neon.purple} />
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
              <Ionicons name="nutrition-outline" size={18} color={Neon.purple} style={{ marginRight: 6 }} />
              <Text style={styles.outlineBtnText}>Review ingredients</Text>
            </Pressable>
          </View>
        )}

        {!authLoading && !userId && state === "idle" && (
          <View style={styles.panelCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="person-outline" size={40} color={Neon.purple} />
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
              <Ionicons name="alert-circle" size={44} color={Neon.red} />
            </View>
            <Text style={styles.panelTitle}>Couldn’t import</Text>
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
              <Ionicons name="clipboard-outline" size={18} color={Neon.purple} />
              <Text style={styles.textLinkLabel}>Paste from clipboard</Text>
            </Pressable>
          </View>
        )}

        {!authLoading && userId && state === "idle" && (
          <View style={styles.panelCard}>
            <View style={styles.brandCircle}>
              <Text style={styles.brandLetter}>P</Text>
            </View>
            <Text style={styles.panelTitle}>Paste a recipe link</Text>
            <Text style={styles.panelSub}>
              From Instagram, TikTok, or any recipe site. If you just shared to Platemate, the link may already be on
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
            <Pressable style={styles.primaryBtn} onPress={onManualImport}>
              <Text style={styles.primaryBtnText}>Import</Text>
            </Pressable>
            <Pressable style={styles.textLinkBtn} onPress={onPasteFromClipboard}>
              <Ionicons name="clipboard-outline" size={18} color={Neon.purple} />
              <Text style={styles.textLinkLabel}>Use clipboard</Text>
            </Pressable>
            {ImagePicker && (
              <Pressable style={styles.textLinkBtn} onPress={() => void runImageImport()}>
                <Ionicons name="camera-outline" size={18} color={Neon.purple} />
                <Text style={styles.textLinkLabel}>Import from photo</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
