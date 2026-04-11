import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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

import { Colors, Neon, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { saveImportedRecipe, type ApiImportedRecipe } from "@/lib/saveImportedRecipe";
import {
  extractUrlFromShareText,
  urlFromDeepLink,
  urlFromRouterParams,
} from "@/lib/resolveImportUrl";

type Extra = { platemateApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

type ImportState = "idle" | "checking" | "importing" | "success" | "error";

export default function ImportSharedScreen() {
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
        const res = await fetch(`${base}/api/recipe-import`, {
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

        const saved = await saveImportedRecipe(userId, data.recipe);
        if ("error" in saved) {
          setState("error");
          setError(saved.error);
          return;
        }

        setTitle((data.recipe.title ?? "Imported recipe").trim() || "Imported recipe");
        setSavedRecipeId(saved.recipeId);
        setState("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setState("error");
        setError("Network error. Check your connection.");
      }
    },
    [base, userId],
  );

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
              onPress={() => router.replace("/(tabs)/library")}
            >
              <Text style={styles.outlineBtnText}>Browse library</Text>
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
                placeholderTextColor="#64748b"
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
              <Ionicons name="alert-circle" size={44} color={Neon.pink} />
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
              placeholderTextColor="#64748b"
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
              placeholderTextColor="#64748b"
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
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const c = Colors.dark;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backHit: { paddingVertical: 6, paddingHorizontal: 6 },
  backText: { color: c.text, fontSize: 17, fontWeight: "600" },
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
    backgroundColor: c.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Neon.pink + "30",
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
    color: c.text,
    textAlign: "center",
  },
  panelSub: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Neon.pink + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBody: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },

  successSheet: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    backgroundColor: c.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Neon.green + "35",
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.md,
    // subtle “sheet” depth
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
    color: c.text,
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
    backgroundColor: "#1e1e2a",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    color: c.text,
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
});
