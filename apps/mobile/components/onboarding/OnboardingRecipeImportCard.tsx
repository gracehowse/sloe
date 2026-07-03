import * as React from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Check, Link2 } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { authedFetch } from "@/lib/authedFetch";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  saveImportedRecipe,
  type ApiImportedRecipe,
} from "@/lib/saveImportedRecipe";
import { ImportRunnerError } from "@suppr/shared/recipes/recipeImportScheduler";
import { coerceImportErrorCode, IMPORT_ERROR_COPY } from "@suppr/shared/recipes/importErrorCopy";
import {
  buildOnboardingRecipeImportSummary,
  onboardingRecipeImportErrorMessage,
  useOnboardingRecipeImport,
} from "@suppr/shared/onboarding/useOnboardingRecipeImport";
import { useOnboarding } from "./context";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { ImportProgress, ImportSuccess } from "./OnboardingRecipeImportStates";

type Extra = { supprApiUrl?: string };

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
}

/**
 * ENG-1304 — real recipe import inside onboarding data-bridges (mobile).
 * Web mirror: `src/app/components/onboarding/OnboardingRecipeImportCard.tsx`.
 */
export function MobileOnboardingRecipeImportCard() {
  const colors = useThemeColors();
  const accent = useAccent();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { set } = useOnboarding();
  const base = apiBase();

  const runImport = React.useCallback(
    async (url: string) => {
      try {
        if (!base) {
          throw new Error(IMPORT_ERROR_COPY.import_failed);
        }
        if (!userId) {
          throw new Error(IMPORT_ERROR_COPY.client_signin_required_to_save);
        }

        const res = await authedFetch(`${base}/api/recipe-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
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

        const saved = await saveImportedRecipe(userId, {
          ...data.recipe,
          sourceUrl: data.recipe.sourceUrl ?? url,
        });
        if ("error" in saved) {
          throw new Error(saved.error);
        }

        set({ dataBridgeChosen: "recipe" });
        track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "recipe" });
        let importHost = url;
        try {
          importHost = new URL(url).hostname;
        } catch {
          /* keep raw */
        }
        track(AnalyticsEvents.recipe_imported, {
          host: importHost,
          source: "url" as const,
        });
        track(AnalyticsEvents.recipe_import_saved_first, {
          platform: Platform.OS === "ios" ? "ios" : "android",
        });

        return buildOnboardingRecipeImportSummary(data.recipe, url);
      } catch (e) {
        throw new Error(onboardingRecipeImportErrorMessage(e));
      }
    },
    [base, set, userId],
  );

  const flow = useOnboardingRecipeImport(runImport);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: CARD_RADIUS,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: Spacing.dense, alignItems: "flex-start" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Accent.success + "26",
          }}
        >
          <Link2 size={18} color={Accent.successLight} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "700",
                color: colors.text,
                letterSpacing: -0.2,
              }}
            >
              Recipe import
            </Text>
            {flow.phase === "success" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: Accent.success + "26",
                  paddingHorizontal: 8,
                  paddingVertical: Spacing.xs,
                  borderRadius: Radius.full,
                }}
              >
                <Check size={10} strokeWidth={2.5} color={Accent.successLight} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: Accent.successLight,
                  }}
                >
                  Saved
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            Paste a link from Instagram, TikTok, YouTube, or any recipe blog —
            Sloe parses ingredients and saves it to your Library.
          </Text>
        </View>
      </View>

      {flow.phase === "idle" || flow.phase === "error" ? (
        <View style={{ marginTop: Spacing.dense }}>
          <View
            style={{
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: Radius.md,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.dense,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: colors.textTertiary,
                marginBottom: 4,
              }}
            >
              Recipe URL
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Link2 size={14} color={colors.textTertiary} />
              <TextInput
                value={flow.url}
                onChangeText={flow.setUrl}
                placeholder="https://www.instagram.com/reel/…"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel="Recipe URL"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  paddingVertical: 0,
                }}
              />
            </View>
          </View>
          {flow.phase === "error" && flow.errorMessage ? (
            <Text
              style={{
                fontSize: 11,
                color: Accent.warningSolid,
                marginTop: 8,
                lineHeight: 16,
              }}
            >
              {flow.errorMessage}
            </Text>
          ) : null}
          <Pressable
            onPress={flow.importCurrentUrl}
            disabled={!flow.url.trim()}
            accessibilityRole="button"
            accessibilityLabel={
              flow.url.trim() ? "Import this recipe" : "Paste a link to import"
            }
            accessibilityState={{ disabled: !flow.url.trim() }}
            style={({ pressed }) => ({
              marginTop: Spacing.dense,
              height: 40,
              borderRadius: Radius.md,
              backgroundColor: accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: !flow.url.trim() ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: accent.primaryForeground, fontSize: 13, fontWeight: "700" }}>
              {flow.url.trim() ? "Import this recipe" : "Paste a link to import"}
            </Text>
          </Pressable>
          <Pressable
            onPress={flow.importSample}
            accessibilityRole="button"
            accessibilityLabel="Try a sample recipe"
            style={({ pressed }) => ({
              marginTop: Spacing.sm,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: accent.primaryLight }}>
              Try a sample recipe
            </Text>
          </Pressable>
        </View>
      ) : null}

      {flow.phase === "importing" ? <ImportProgress /> : null}

      {flow.phase === "success" && flow.summary ? (
        <ImportSuccess summary={flow.summary} onImportAnother={flow.reset} />
      ) : null}
    </View>
  );
}
