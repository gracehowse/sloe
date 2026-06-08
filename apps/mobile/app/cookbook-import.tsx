import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { getSupprApiBase } from "@/lib/supprWeb";
import { authedFetch } from "@/lib/authedFetch";
import { isFeatureEnabled } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import {
  commitCookbookImport,
  COOKBOOK_IMPORT_FREE_SAVE_CAP,
} from "@suppr/shared/planning/planImport/commitCookbookImport";
import type {
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "@suppr/shared/planning/planImport/types";
const REVIEW_PAGE_SIZE = 10;

type Step = "pick" | "parsing" | "review";
type PickedFile = { uri: string; name: string; mimeType: string };

type CookbookParseApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  bookName?: string;
  recipes?: PlanImportVerifiedRecipe[];
  parseWarnings?: string[];
  chunkCount?: number;
  lowConfidenceCount?: number;
};

function defaultBookNameFromFile(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Imported cookbook";
}

// Client-side PDF size ceiling. The HARD limit is Vercel's ~4.5 MB
// serverless request-body cap: the PDF is POSTed as multipart FormData to
// /api/cookbook-import/extract (NOT uploaded to Storage), so a larger file is
// rejected by Vercel's infra (413) BEFORE our server-side 20 MB check ever
// runs. We validate at 4 MB on the client so the user gets an honest,
// immediate message instead of a confusing "Server error". Raising this
// requires the direct-to-Supabase-Storage upload path — see the cookbook
// import follow-up; bumping the number alone does nothing.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

export default function CookbookImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the primary import
  // CTA, active segmented control, parse spinner, Save action, and review pager
  // links. Threaded into the memoised StyleSheet via the dep array below.
  const accent = useAccent();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [step, setStep] = useState<Step>("pick");
  const [bookName, setBookName] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [parsingMessage, setParsingMessage] = useState("Reading PDF…");
  const [recipes, setRecipes] = useState<PlanImportVerifiedRecipe[]>([]);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [nutritionMode, setNutritionMode] = useState<PlanImportNutritionMode>("match");
  const [reviewPage, setReviewPage] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // ENG-742 — deep links must respect the same flag as CreateRecipeActionSheet.
  useEffect(() => {
    if (!isFeatureEnabled("cookbook_import_enabled")) {
      router.back();
    }
  }, [router]);

  const apiBase = getSupprApiBase();

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (typeof asset.size === "number" && asset.size > MAX_PDF_BYTES) {
      const mb = (asset.size / (1024 * 1024)).toFixed(1);
      Alert.alert(
        "PDF too large",
        `This PDF is ${mb} MB — the current limit is 4 MB. Export a searchable PDF (selectable text, not a flat scan); those are far smaller than a scanned image. If it's still too big, split the cookbook into sections and import each.`,
      );
      return;
    }
    setPickedFile({
      uri: asset.uri,
      name: asset.name ?? "cookbook.pdf",
      mimeType: asset.mimeType ?? "application/pdf",
    });
    setBookName(defaultBookNameFromFile(asset.name ?? "cookbook.pdf"));
  }, []);

  const extractPdf = useCallback(
    async (file: PickedFile): Promise<string | null> => {
      if (!apiBase) return null;
      const fd = new FormData();
      fd.append(
        "file",
        { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob,
      );
      const res = await authedFetch(`${apiBase}/api/cookbook-import/extract`, {
        method: "POST",
        body: fd,
      });
      const raw = await res.text();
      let json: { ok?: boolean; text?: string; message?: string; error?: string };
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        Alert.alert("Server error", __DEV__ ? `HTTP ${res.status}` : "Try again shortly.");
        return null;
      }
      if (!json.ok || !json.text?.trim()) {
        Alert.alert("Could not read PDF", json.message ?? "Try a searchable PDF export.");
        return null;
      }
      return json.text;
    },
    [apiBase],
  );

  const runParse = useCallback(async () => {
    if (!userId) {
      Alert.alert("Sign in", "Sign in to import a cookbook.");
      return;
    }
    if (!apiBase) {
      Alert.alert("API not configured", "Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.");
      return;
    }
    if (!pickedFile) {
      Alert.alert("PDF required", "Choose a cookbook PDF first.");
      return;
    }
    setStep("parsing");
    setParsingMessage("Reading PDF…");
    try {
      const text = await extractPdf(pickedFile);
      if (!text) {
        setStep("pick");
        return;
      }
      setParsingMessage("Finding recipes…");
      const res = await authedFetch(`${apiBase}/api/cookbook-import/parse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          bookName: bookName.trim() || defaultBookNameFromFile(pickedFile.name),
        }),
      });
      const json = (await res.json()) as CookbookParseApiResponse;
      if (res.status === 403 && json.error === "pro_required") {
        setStep("pick");
        Alert.alert(
          "Pro feature",
          "Cookbook PDF import is included with Pro — same as photo recipe import.",
          [
            { text: "Not now", style: "cancel" },
            { text: "View plans", onPress: () => router.push("/paywall?from=recipe_import") },
          ],
        );
        return;
      }
      if (!json.ok || !json.recipes?.length) {
        setStep("pick");
        Alert.alert(
          "Could not parse cookbook",
          json.message ?? "No recipes found. Use a searchable PDF with ingredient lists.",
        );
        return;
      }
      setRecipes(json.recipes);
      setExcludedKeys(new Set());
      setParseWarnings(json.parseWarnings ?? []);
      if (json.bookName) setBookName(json.bookName);
      const chunkNote =
        json.chunkCount && json.chunkCount > 1 ? ` (${json.chunkCount} batches)` : "";
      setParsingMessage(`Found ${json.recipes.length} recipes${chunkNote}`);
      setReviewPage(0);
      setStep("review");
    } catch {
      setStep("pick");
      Alert.alert("Parse failed", "Check your connection and try again.");
    }
  }, [userId, apiBase, pickedFile, bookName, extractPdf, router]);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => !excludedKeys.has(r.key)),
    [recipes, excludedKeys],
  );

  const reviewSlice = useMemo(() => {
    const start = reviewPage * REVIEW_PAGE_SIZE;
    return recipes.slice(start, start + REVIEW_PAGE_SIZE);
  }, [recipes, reviewPage]);

  const totalReviewPages = Math.max(1, Math.ceil(recipes.length / REVIEW_PAGE_SIZE));

  const toggleExclude = useCallback((key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const finishSave = useCallback(async () => {
    if (!userId || selectedRecipes.length === 0) {
      Alert.alert("Nothing to save", "Include at least one recipe.");
      return;
    }
    setCommitting(true);
    try {
      const { count } = await supabase
        .from("saves")
        .select("recipe_id", { count: "exact", head: true })
        .eq("user_id", userId);
      const savedSoFar = count ?? 0;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_tier")
        .eq("id", userId)
        .maybeSingle();
      const tier = (profile?.user_tier as string | undefined) ?? "free";
      const maxSaves =
        tier === "free"
          ? Math.max(0, COOKBOOK_IMPORT_FREE_SAVE_CAP - savedSoFar)
          : undefined;

      if (tier === "free" && maxSaves === 0) {
        Alert.alert(
          "Save limit reached",
          `Free plan is limited to ${COOKBOOK_IMPORT_FREE_SAVE_CAP} saved recipes.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Upgrade", onPress: () => router.push("/paywall?from=recipe_import") },
          ],
        );
        return;
      }

      const result = await commitCookbookImport(
        supabase,
        {
          userId,
          bookName: bookName.trim() || "Imported cookbook",
          recipes: selectedRecipes,
          nutritionMode,
        },
        maxSaves != null ? { maxSaves } : undefined,
      );

      if (!result.ok) {
        Alert.alert("Save failed", result.error);
        return;
      }

      const label = bookName.trim() || "your cookbook";
      if (result.stoppedEarly && result.stopReason === "save_limit") {
        Alert.alert(
          "Partially saved",
          `Saved ${result.savedCount} of ${selectedRecipes.length} recipes before the free save limit. Upgrade to save the rest.`,
          [
            { text: "Library", onPress: () => router.replace("/(tabs)/library") },
            { text: "Plans", onPress: () => router.replace("/(tabs)/planner") },
          ],
        );
        return;
      }

      Alert.alert(
        "Cookbook saved",
        `${result.savedCount} recipes saved to Library as Imported · ${label}. Build your week in Plan when you're ready.`,
        [
          { text: "Library", onPress: () => router.replace("/(tabs)/library") },
          { text: "Plan", onPress: () => router.replace("/(tabs)/planner") },
        ],
      );
    } finally {
      setCommitting(false);
    }
  }, [userId, selectedRecipes, bookName, nutritionMode, router]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
        label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 },
        // SLOE DS reskin (2026-06-07): cream `surface-card` slabs, 24px Sloe
        // radius (Radius.xl * 2), plum serif headings. Presentation only —
        // PDF pick / extract / parse / commit logic untouched.
        textInput: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          padding: 14,
          fontSize: 15,
          color: colors.text,
          backgroundColor: colors.card,
        },
        uploadZone: {
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: "dashed",
          borderRadius: Radius.xl * 2,
          backgroundColor: colors.card,
          padding: Spacing.xl,
          marginTop: Spacing.sm,
        },
        uploadTitle: { ...Type.headline, color: colors.text },
        uploadHint: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
        primaryBtn: {
          backgroundColor: accent.primary,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          marginTop: Spacing.lg,
        },
        primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
        parseCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.xl * 2,
          padding: Spacing.lg,
          marginBottom: Spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
        cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        seg: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
        segBtn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        },
        segBtnActive: { borderColor: accent.primary, backgroundColor: `${accent.primary}14` },
        pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: Spacing.sm },
      }),
    [colors, insets.bottom, accent],
  );

  if (step === "parsing") {
    return (
      <View style={styles.root} testID="screen-cookbook-import-parsing">
        <PushScreenHeader title="Import cookbook" onBack={() => setStep("pick")} />
        <View style={styles.parseCenter}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={{ ...Type.title, marginTop: Spacing.lg, color: colors.navPrimary, textAlign: "center" }}>
            {parsingMessage}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
            Ingredients are matched to Sloe foods — exclude any bad rows before saving.
          </Text>
        </View>
      </View>
    );
  }

  if (step === "review") {
    return (
      <View style={styles.root} testID="screen-cookbook-import-review">
        <PushScreenHeader
          title="Review recipes"
          onBack={() => setStep("pick")}
          rightSlot={
            <Pressable onPress={() => void finishSave()} disabled={committing} hitSlop={8}>
              <Text style={{ color: accent.primary, fontWeight: "700" }}>
                {committing ? "…" : "Save"}
              </Text>
            </Pressable>
          }
        />
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
          <Text style={{ fontSize: 14, color: colors.text }}>
            {selectedRecipes.length} of {recipes.length} selected ·{" "}
            <Text style={{ fontWeight: "700" }}>{bookName}</Text>
          </Text>
          {parseWarnings.length > 0 ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              Note: {parseWarnings.join(", ").replace(/_/g, " ")}
            </Text>
          ) : null}
          <Text style={styles.label}>Nutrition handling</Text>
          <View style={styles.seg}>
            {(["author", "match"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.segBtn, nutritionMode === mode && styles.segBtnActive]}
                onPress={() => setNutritionMode(mode)}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text }}>
                  {mode === "author" ? "Author's numbers" : "Match & verify"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pager}>
            <Pressable
              disabled={reviewPage === 0}
              onPress={() => setReviewPage((p) => Math.max(0, p - 1))}
            >
              <Text style={{ color: reviewPage === 0 ? colors.textSecondary : accent.primary }}>
                Previous
              </Text>
            </Pressable>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Page {reviewPage + 1} / {totalReviewPages}
            </Text>
            <Pressable
              disabled={reviewPage >= totalReviewPages - 1}
              onPress={() => setReviewPage((p) => Math.min(totalReviewPages - 1, p + 1))}
            >
              <Text
                style={{
                  color:
                    reviewPage >= totalReviewPages - 1 ? colors.textSecondary : accent.primary,
                }}
              >
                Next
              </Text>
            </Pressable>
          </View>
        </View>
        <FlatList
          data={reviewSlice}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => {
            const excluded = excludedKeys.has(item.key);
            const kcal =
              nutritionMode === "author" && item.authorNutrition?.calories
                ? item.authorNutrition.calories
                : item.supprNutrition.calories;
            return (
              <Pressable
                style={[styles.card, excluded && { opacity: 0.45 }]}
                onPress={() => toggleExclude(item.key)}
                testID={`cookbook-recipe-${item.key}`}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.cardTitle, excluded && { textDecorationLine: "line-through" }]}>
                    {item.title}
                  </Text>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{kcal} kcal</Text>
                </View>
                <Text style={styles.cardMeta}>
                  Serves {item.serves} · {item.ingredientCount ?? item.ingredients.length} ingredients ·{" "}
                  {item.confidence} confidence
                  {excluded ? " · excluded" : ""}
                </Text>
              </Pressable>
            );
          }}
        />
        <View style={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.md }}>
          <Pressable style={styles.primaryBtn} onPress={() => void finishSave()} disabled={committing}>
            {committing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                Save {selectedRecipes.length} recipes to Library
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="screen-cookbook-import"
    >
      <PushScreenHeader title="Import cookbook" onBack={() => router.back()} />
      <View style={styles.scroll}>
        <Text style={styles.subtitle}>
          Upload one searchable PDF from your scanner app. Sloe extracts every recipe with
          ingredients — then you build your week in Plan.
        </Text>
        <Pressable testID="cookbook-import-pick-pdf" style={styles.uploadZone} onPress={() => void pickPdf()}>
          <Text style={styles.uploadTitle}>
            {pickedFile ? pickedFile.name : "Choose cookbook PDF"}
          </Text>
          <Text style={styles.uploadHint}>
            {pickedFile
              ? "Tap to replace · export a searchable PDF (not a flat scan)"
              : "Searchable PDF export (not a flat scan) — 4 MB max"}
          </Text>
        </Pressable>
        <Text style={styles.label}>Book name</Text>
        <TextInput
          testID="cookbook-import-book-name"
          style={styles.textInput}
          value={bookName}
          onChangeText={setBookName}
          placeholder="e.g. Fast 800"
        />
        <Pressable testID="cookbook-import-parse" style={styles.primaryBtn} onPress={() => void runParse()}>
          <Text style={styles.primaryBtnText}>Parse cookbook</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
