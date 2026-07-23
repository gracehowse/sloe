import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { getSupprApiBase } from "@/lib/supprWeb";
import { authedFetch } from "@/lib/authedFetch";
import { isFeatureEnabled } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { alertApiNotConfigured, apiNotConfiguredMessage } from "@/lib/importApiGuard";
import { commitCookbookImport, COOKBOOK_IMPORT_FREE_SAVE_CAP } from "@suppr/shared/planning/planImport/commitCookbookImport";
import type { PlanImportNutritionMode, PlanImportVerifiedRecipe } from "@suppr/shared/planning/planImport/types";
import { CookbookParsingView } from "@/components/cookbook/CookbookParsingView";
import { CookbookSuccessView } from "@/components/cookbook/CookbookSuccessView";
import { CookbookReviewRow } from "@/components/cookbook/CookbookReviewRow";
import {
  CookbookFooterSaveButton,
  CookbookHeaderSaveButton,
  CookbookImportBanner,
  CookbookLegacyRecipeCard,
  CookbookNutritionModeSeg,
  CookbookParseButton,
  CookbookUploadZone,
  makeCookbookImportPressableStyles,
} from "@/components/cookbook/CookbookImportPressables";

type Step = "pick" | "parsing" | "review" | "success";
type PickedFile = { uri: string; name: string; mimeType: string };
// Inline banner for non-destructive feedback (DS §10.8 / §6.3).
// Alert is only used when an action is genuinely destructive or irreversible.
type InlineBanner =
  | { kind: "error"; message: string }
  | { kind: "warning"; message: string; upgradeAction?: () => void }
  | null;

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
  // Secondary accent (Frost flag → damson, else clay) for CTAs, active states,
  // and the review pager links. Threaded into the memoised StyleSheet via the
  // dep array below.
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
  const [committing, setCommitting] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [banner, setBanner] = useState<InlineBanner>(null);

  // Structural redesign (success state, FlatList review, row affordances,
  // inline banners) ships behind this flag. Token-only fixes (serif, on-scale
  // spacing, button radius) apply unconditionally per DS §15.
  const redesignOn = isFeatureEnabled("recipe-import-redesign");

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
      if (redesignOn) {
        // DS §10.8: inline banner for recoverable validation errors.
        setBanner({
          kind: "error",
          message: `This PDF is ${mb} MB — the limit is 4 MB. Export a searchable PDF (selectable text, not a flat scan) which is far smaller. If it's still too big, split the cookbook into sections.`,
        });
      } else {
        Alert.alert(
          "PDF too large",
          `This PDF is ${mb} MB — the current limit is 4 MB. Export a searchable PDF (selectable text, not a flat scan); those are far smaller than a scanned image. If it's still too big, split the cookbook into sections and import each.`,
        );
      }
      return;
    }
    setBanner(null);
    setPickedFile({
      uri: asset.uri,
      name: asset.name ?? "cookbook.pdf",
      mimeType: asset.mimeType ?? "application/pdf",
    });
    setBookName(defaultBookNameFromFile(asset.name ?? "cookbook.pdf"));
  }, [redesignOn]);

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
        if (redesignOn) {
          setBanner({ kind: "error", message: "Server error — try again shortly." });
        } else {
          Alert.alert("Server error", __DEV__ ? `HTTP ${res.status}` : "Try again shortly.");
        }
        return null;
      }
      if (!json.ok || !json.text?.trim()) {
        if (redesignOn) {
          setBanner({ kind: "error", message: json.message ?? "Try a searchable PDF export." });
        } else {
          Alert.alert("Could not read PDF", json.message ?? "Try a searchable PDF export.");
        }
        return null;
      }
      return json.text;
    },
    [apiBase, redesignOn],
  );

  const runParse = useCallback(async () => {
    setBanner(null);
    if (!userId) {
      if (redesignOn) {
        setBanner({ kind: "error", message: "Sign in to import a cookbook." });
      } else {
        Alert.alert("Sign in", "Sign in to import a cookbook.");
      }
      return;
    }
    if (!apiBase) {
      // ENG-1456: env detail is dev-only — production gets register copy.
      if (redesignOn) {
        setBanner({ kind: "error", message: apiNotConfiguredMessage() });
      } else {
        alertApiNotConfigured();
      }
      return;
    }
    if (!pickedFile) {
      if (redesignOn) {
        setBanner({ kind: "error", message: "Choose a cookbook PDF first." });
      } else {
        Alert.alert("PDF required", "Choose a cookbook PDF first.");
      }
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
        if (redesignOn) {
          setBanner({
            kind: "warning",
            message: "Cookbook PDF import is included with Pro — same as photo recipe import.",
            upgradeAction: () => router.push("/paywall?from=recipe_import"),
          });
        } else {
          Alert.alert(
            "Pro feature",
            "Cookbook PDF import is included with Pro — same as photo recipe import.",
            [
              { text: "Not now", style: "cancel" },
              { text: "View plans", onPress: () => router.push("/paywall?from=recipe_import") },
            ],
          );
        }
        return;
      }
      if (!json.ok || !json.recipes?.length) {
        setStep("pick");
        if (redesignOn) {
          setBanner({
            kind: "error",
            message: json.message ?? "No recipes found. Use a searchable PDF with ingredient lists.",
          });
        } else {
          Alert.alert(
            "Could not parse cookbook",
            json.message ?? "No recipes found. Use a searchable PDF with ingredient lists.",
          );
        }
        return;
      }
      setRecipes(json.recipes);
      setExcludedKeys(new Set());
      setParseWarnings(json.parseWarnings ?? []);
      if (json.bookName) setBookName(json.bookName);
      setStep("review");
    } catch {
      setStep("pick");
      if (redesignOn) {
        setBanner({ kind: "error", message: "Parse failed — check your connection and try again." });
      } else {
        Alert.alert("Parse failed", "Check your connection and try again.");
      }
    }
  }, [userId, apiBase, pickedFile, bookName, extractPdf, router, redesignOn]);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => !excludedKeys.has(r.key)),
    [recipes, excludedKeys],
  );

  const toggleExclude = useCallback((key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const finishSave = useCallback(async () => {
    setBanner(null);
    if (!userId || selectedRecipes.length === 0) {
      if (redesignOn) {
        setBanner({ kind: "error", message: "Include at least one recipe before saving." });
      } else {
        Alert.alert("Nothing to save", "Include at least one recipe.");
      }
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
        if (redesignOn) {
          setBanner({
            kind: "warning",
            message: `Free plan allows up to ${COOKBOOK_IMPORT_FREE_SAVE_CAP} saved recipes.`,
            upgradeAction: () => router.push("/paywall?from=recipe_import"),
          });
        } else {
          Alert.alert(
            "Save limit reached",
            `Free plan is limited to ${COOKBOOK_IMPORT_FREE_SAVE_CAP} saved recipes.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Upgrade", onPress: () => router.push("/paywall?from=recipe_import") },
            ],
          );
        }
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
        if (redesignOn) {
          setBanner({ kind: "error", message: result.error ?? "Save failed — try again." });
        } else {
          Alert.alert("Save failed", result.error);
        }
        return;
      }

      setSavedCount(result.savedCount);

      if (redesignOn) {
        setStep("success");
      } else {
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
          `${result.savedCount} ${result.savedCount === 1 ? "recipe" : "recipes"} saved to Library as Imported · ${label}. Build your week in Plan when you're ready.`,
          [
            { text: "Library", onPress: () => router.replace("/(tabs)/library") },
            { text: "Plan", onPress: () => router.replace("/(tabs)/planner") },
          ],
        );
      }
    } finally {
      setCommitting(false);
    }
  }, [userId, selectedRecipes, bookName, nutritionMode, router, redesignOn]);

  const styles = useMemo(
    () => ({
      ...StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        subtitle: {
          fontFamily: FontFamily.sansRegular,
          fontSize: 14,
          color: colors.textSecondary,
          lineHeight: 20,
          marginBottom: Spacing.md,
        },
        label: {
          fontFamily: FontFamily.sansSemibold,
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: Spacing.md,
          marginBottom: Spacing.xs,
        },
        textInput: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.xl,
          padding: Spacing.md,
          ...Type.bodyLarge,
          color: colors.text,
          backgroundColor: colors.card,
        },
      }),
      ...makeCookbookImportPressableStyles(colors, accent, insets.bottom),
    }),
    [colors, insets.bottom, accent],
  );

  const saveLabel = committing
    ? "Saving…"
    : `Save ${selectedRecipes.length} recipes to Library`;

  // ─── Parsing state ────────────────────────────────────────────────────────

  if (step === "parsing") {
    return (
      <CookbookParsingView
        parsingMessage={parsingMessage}
        onBack={() => setStep("pick")}
      />
    );
  }

  // ─── Success state (redesign-on only) ─────────────────────────────────────

  if (step === "success" && redesignOn) {
    return (
      <CookbookSuccessView
        savedCount={savedCount}
        bookName={bookName}
        onViewLibrary={() => router.replace("/(tabs)/library")}
        onBuildPlan={() => router.replace("/(tabs)/planner")}
      />
    );
  }

  // ─── Review state ─────────────────────────────────────────────────────────

  if (step === "review") {
    return (
      <View style={styles.root} testID="screen-cookbook-import-review">
        <PushScreenHeader
          title="Review recipes"
          onBack={() => setStep("pick")}
          rightSlot={
            !redesignOn ? (
              <CookbookHeaderSaveButton
                committing={committing}
                onPress={() => void finishSave()}
                accentPrimarySolid={accent.primarySolid}
              />
            ) : undefined
          }
        />
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
          {redesignOn && banner ? (
            <CookbookImportBanner banner={banner} styles={styles} />
          ) : null}
          <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 15, color: colors.text }}>
            {selectedRecipes.length} of {recipes.length} selected ·{" "}
            <Text style={{ fontFamily: FontFamily.serifMedium }}>{bookName}</Text>
          </Text>
          {parseWarnings.length > 0 ? (
            <Text style={{ fontFamily: FontFamily.sansRegular, fontSize: 12, color: colors.textSecondary, marginTop: Spacing.xs }}>
              Note: {parseWarnings.join(", ").replace(/_/g, " ")}
            </Text>
          ) : null}
          <Text style={styles.label}>Nutrition handling</Text>
          <CookbookNutritionModeSeg
            nutritionMode={nutritionMode}
            onSelect={setNutritionMode}
            styles={styles}
          />
        </View>

        {redesignOn ? (
          /* Single scrollable list + sticky running-totals footer (import.md §3.5). */
          <>
            <FlatList
              data={recipes}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{
                paddingHorizontal: Spacing.md,
                paddingBottom: insets.bottom + 120,
              }}
              renderItem={({ item }) => (
                <CookbookReviewRow
                  item={item}
                  excluded={excludedKeys.has(item.key)}
                  nutritionMode={nutritionMode}
                  onToggle={toggleExclude}
                />
              )}
            />
            <View style={styles.reviewFooter}>
              <Text style={styles.reviewCount}>
                {selectedRecipes.length} of {recipes.length} selected
              </Text>
              <CookbookFooterSaveButton
                label={saveLabel}
                committing={committing}
                onPress={() => void finishSave()}
                styles={styles}
              />
            </View>
          </>
        ) : (
          /* Legacy pager (flag-off). Pagination + old dimmed-opacity row treatment.
             Kept so the flag-off path is byte-equivalent to the pre-redesign behaviour. */
          <>
            <FlatList
              data={recipes}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 80 }}
              renderItem={({ item }) => (
                <CookbookLegacyRecipeCard
                  item={item}
                  excluded={excludedKeys.has(item.key)}
                  nutritionMode={nutritionMode}
                  onToggle={toggleExclude}
                  styles={styles}
                  colors={colors}
                />
              )}
            />
            <View style={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.md }}>
              <CookbookFooterSaveButton
                label={saveLabel}
                committing={committing}
                onPress={() => void finishSave()}
                styles={styles}
                containerStyle={styles.primaryBtn}
              />
            </View>
          </>
        )}
      </View>
    );
  }

  // ─── Pick state ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="screen-cookbook-import"
    >
      <PushScreenHeader title="Import cookbook" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {banner ? <CookbookImportBanner banner={banner} styles={styles} /> : null}
        <Text style={styles.subtitle}>
          Upload one searchable PDF from your scanner app. Sloe extracts every recipe with
          ingredients — then you build your week in Plan.
        </Text>
        <CookbookUploadZone
          pickedFileName={pickedFile?.name ?? null}
          onPress={() => void pickPdf()}
          styles={styles}
        />
        <Text style={styles.label}>Book name</Text>
        <TextInput
          testID="cookbook-import-book-name"
          style={styles.textInput}
          value={bookName}
          onChangeText={setBookName}
          placeholder="e.g. Fast 800"
          placeholderTextColor={colors.textSecondary}
        />
        <CookbookParseButton onPress={() => void runParse()} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
