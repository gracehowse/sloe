/**
 * MFP CSV import card (mobile).
 *
 * Mirror of `src/app/components/imports/MfpCsvImportCard.tsx`. Closes
 * the MFP-refugee history-bridge gap (P1 customer-lens) on iOS. Used in
 * two places:
 *
 *   1. Onboarding terminal step (`data-bridges.tsx`) — 5th card after
 *      manual targets / Apple Health / notifications / recipe URL.
 *   2. Settings -> App section — same card so a user who skipped
 *      onboarding can import later.
 *
 * Picker: `expo-document-picker` with the CSV MIME types. We don't use
 * `image-picker` (wrong UX) or share-intent (wrong direction). The
 * upload payload is multipart `file=<the .csv>` plus the user's
 * Supabase bearer via `authedFetch`.
 *
 * Phases mirror the web component exactly so QA + analytics on both
 * platforms read the same.
 */
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { Check, FileSpreadsheet, RotateCcw } from "lucide-react-native";
import { Accent, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | {
      kind: "success";
      imported: number;
      unmatched: number;
      truncated: boolean;
    }
  | { kind: "error"; message: string };

type ImportSuccess = {
  ok: true;
  imported: number;
  unmatched: number;
  truncated: boolean;
};

type ImportFailure = {
  ok: false;
  error: string;
  message?: string;
};

/**
 * Minimal asset shape from `expo-document-picker.getDocumentAsync`.
 * Typed locally so this file does not import the package at module
 * load — the dynamic import inside `handlePick` keeps vitest's
 * vmThreads pool happy when the native module is shimmed.
 */
type DocumentAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

export function MobileMfpCsvImportCard({
  surface = "onboarding",
}: {
  surface?: "onboarding" | "settings";
}) {
  const colors = useThemeColors();
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });

  const uploadFile = React.useCallback(
    async (asset: DocumentAsset) => {
      track(AnalyticsEvents.mfp_csv_import_started, {
        surface,
        platform: "ios",
      });
      setPhase({
        kind: "uploading",
        fileName: asset.name ?? "MyFitnessPal.csv",
      });

      try {
        const base = getSupprApiBase();
        if (!base) {
          setPhase({
            kind: "error",
            message: "API base URL is not configured. Try again later.",
          });
          track(AnalyticsEvents.mfp_csv_import_failed, {
            error: "no_api_base",
            status: 0,
            surface,
            platform: "ios",
          });
          return;
        }

        const form = new FormData();
        // React Native FormData accepts the { uri, name, type } shape
        // for file uploads — multipart wire format is identical to the
        // web `Blob` flavour the API expects.
        form.append("file", {
          uri: asset.uri,
          name: asset.name ?? "MyFitnessPal.csv",
          type: asset.mimeType ?? "text/csv",
        } as unknown as Blob);

        const res = await authedFetch(`${base}/api/imports/mfp-csv`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as ImportSuccess | ImportFailure;

        if (!res.ok || !json.ok) {
          const message =
            ("message" in json && json.message) ||
            (res.status === 429
              ? "Too many imports today. Try again tomorrow."
              : res.status === 413
                ? "File is too large. Split your export and try again."
                : res.status === 401
                  ? "Sign in to import your MyFitnessPal history."
                  : "Import failed. Try again or pick a different file.");
          setPhase({ kind: "error", message });
          track(AnalyticsEvents.mfp_csv_import_failed, {
            error: "error" in json ? json.error : "unknown",
            status: res.status,
            surface,
            platform: "ios",
          });
          return;
        }

        setPhase({
          kind: "success",
          imported: json.imported,
          unmatched: json.unmatched,
          truncated: json.truncated,
        });
        track(AnalyticsEvents.mfp_csv_import_completed, {
          imported: json.imported,
          unmatched: json.unmatched,
          truncated: json.truncated,
          surface,
          platform: "ios",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Import failed.";
        setPhase({ kind: "error", message });
        track(AnalyticsEvents.mfp_csv_import_failed, {
          error: "fetch_failed",
          status: 0,
          surface,
          platform: "ios",
        });
      }
    },
    [surface],
  );

  const handlePick = React.useCallback(async () => {
    try {
      // Dynamic import: keeps vitest from loading the native module
      // at module-load time. The package is a runtime dependency for
      // the iOS build only.
      const DocumentPicker = (await import(
        "expo-document-picker"
      )) as typeof import("expo-document-picker");
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "public.comma-separated-values-text",
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      void uploadFile(asset);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not open the file picker.";
      Alert.alert("Import failed", message);
    }
  }, [uploadFile]);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg ?? 14,
        padding: 16,
        borderWidth: 1,
        borderColor:
          phase.kind === "success" ? Accent.success + "66" : colors.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Accent.primaryLight + "26",
          }}
        >
          <FileSpreadsheet
            size={18}
            color={Accent.primaryLight}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "700",
                color: colors.text,
                letterSpacing: -0.2,
              }}
            >
              Import from MyFitnessPal
            </Text>
            {phase.kind === "success" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: Accent.success + "26",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Check
                  size={10}
                  color={Accent.successLight ?? Accent.success}
                  strokeWidth={3}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: Accent.successLight ?? Accent.success,
                  }}
                >
                  Imported
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            Upload your MFP CSV export — we&rsquo;ll bring your meal history
            into Suppr without changing the macros you already logged.
          </Text>

          {phase.kind === "idle" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose CSV file"
              testID="mfp-csv-choose-file"
              onPress={handlePick}
              style={({ pressed }) => ({
                marginTop: 12,
                alignSelf: "flex-start",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: colors.text }}
              >
                Choose CSV file
              </Text>
            </Pressable>
          )}

          {phase.kind === "uploading" && (
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator size="small" color={Accent.primaryLight} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Importing {phase.fileName}&hellip;
              </Text>
            </View>
          )}

          {phase.kind === "success" && (
            <View style={{ marginTop: 12 }}>
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <Check
                  size={14}
                  color={Accent.successLight ?? Accent.success}
                  strokeWidth={2.5}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: Accent.successLight ?? Accent.success,
                  }}
                >
                  Imported {phase.imported} meal
                  {phase.imported === 1 ? "" : "s"} from MyFitnessPal
                </Text>
              </View>
              {phase.unmatched > 0 ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {phase.unmatched} row{phase.unmatched === 1 ? "" : "s"}{" "}
                  skipped (missing calories).
                </Text>
              ) : null}
              {phase.truncated ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  First 1000 rows imported — upload again for older history.
                </Text>
              ) : null}
            </View>
          )}

          {phase.kind === "error" && (
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: Accent.warning,
                  marginBottom: 8,
                }}
                accessibilityRole="alert"
              >
                {phase.message}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                testID="mfp-csv-retry"
                onPress={handlePick}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <RotateCcw size={13} color={colors.text} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
