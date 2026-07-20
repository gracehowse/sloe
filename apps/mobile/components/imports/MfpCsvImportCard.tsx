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
 * Picker: `expo-document-picker` with the CSV MIME types. Two-phase
 * (ENG-1234): the picked file uploads to `?mode=preview` (parse, no write),
 * the card shows the parsed sample (`<CsvImportPreview>`), and only on
 * confirm does it re-send the same file to `?mode=commit`. The shared
 * `useCsvImportFlow` hook owns the state machine + analytics so this card
 * and the web card drive an identical flow.
 */
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Check, FileSpreadsheet, RotateCcw } from "lucide-react-native";
import { Accent, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { AnalyticsEventName } from "@suppr/shared/analytics/events";
import { useCsvImportFlow } from "@suppr/shared/imports/useCsvImportFlow";
import type { CsvUploadResult } from "@suppr/shared/imports/useCsvImportFlow";
import { CsvImportPreview } from "@/components/imports/CsvImportPreview";
import { NamedTrackerReassuranceStrip } from "@/components/imports/NamedTrackerReassuranceStrip";

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
  highlightApp = null,
}: {
  surface?: "onboarding" | "settings";
  /** ENG-990 — when the user picked an importable app on the app-choice
   *  step, the data-bridges step passes its display name (e.g.
   *  "MyFitnessPal") so this card leads with their app and reads as the
   *  pre-selected next step. `null` keeps the generic multi-app copy. */
  highlightApp?: string | null;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the highlighted-card
  // border + the spreadsheet-icon tile/spinner.
  const accent = useAccent();
  const flow = useCsvImportFlow({
    surface,
    platform: "ios",
    track: (event, props) => track(event as AnalyticsEventName, props),
    events: {
      started: AnalyticsEvents.mfp_csv_import_started,
      previewed: AnalyticsEvents.mfp_csv_import_previewed,
      completed: AnalyticsEvents.mfp_csv_import_completed,
      failed: AnalyticsEvents.mfp_csv_import_failed,
    },
  });
  const { state } = flow;

  const startUpload = React.useCallback(
    (asset: DocumentAsset) => {
      // Reused by the hook for both preview + commit round-trips.
      const uploader = async (
        mode: "preview" | "commit",
      ): Promise<CsvUploadResult> => {
        const base = getSupprApiBase();
        if (!base) {
          return {
            httpOk: false,
            status: 0,
            json: {
              ok: false,
              error: "no_api_base",
              message: "API base URL is not configured. Try again later.",
            },
          };
        }
        const form = new FormData();
        // React Native FormData accepts the { uri, name, type } shape for
        // file uploads — multipart wire format is identical to the web
        // `Blob` flavour the API expects.
        form.append("file", {
          uri: asset.uri,
          name: asset.name ?? "import.csv",
          type: asset.mimeType ?? "text/csv",
        } as unknown as Blob);
        const res = await authedFetch(
          `${base}/api/imports/mfp-csv?mode=${mode}`,
          { method: "POST", body: form },
        );
        const json = await res.json();
        return { httpOk: res.ok, status: res.status, json };
      };

      void flow.startPreview(asset.name ?? "import.csv", uploader);
    },
    [flow],
  );

  const handlePick = React.useCallback(async () => {
    try {
      // Dynamic import keeps vitest from loading the native module at
      // module-load time; it's a runtime dependency for the iOS build only.
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
      startUpload(res.assets[0]);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not open the file picker.";
      Alert.alert("Import failed", message);
    }
  }, [startUpload]);

  // ENG-990 — lead with the user's app when they told us they're switching
  // from one we can import. `highlightApp` is `null` on the generic Settings
  // surface and when no importable app was chosen.
  const highlighted = highlightApp != null;
  const reassuranceStrip =
    isFeatureEnabled("mfp_tracker_reassurance_v1") && !highlighted && state.kind === "idle";
  const title = highlighted
    ? `Bring your ${highlightApp} history`
    : "Import from another app";
  const body = highlighted
    ? `Upload your ${highlightApp} CSV export and we'll bring your meal history into Sloe — your numbers stay exactly as you logged them.`
    : "MyFitnessPal, Lose It, or Cronometer — upload the CSV export and we'll bring your meal history into Sloe without changing the macros you already logged.";

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: // ENG-1572 — solid Light borders, no alpha
          state.kind === "success"
            ? Accent.successLight
            : highlighted && state.kind === "idle"
              ? accent.primaryLight
              : colors.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.primarySoft,
          }}
        >
          <FileSpreadsheet size={18} color={accent.primaryLight} />
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
              {title}
            </Text>
            {state.kind === "success" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: Accent.successSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: Radius.full,
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
              ...Type.captionSmall,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            {body}
          </Text>

          {reassuranceStrip ? <NamedTrackerReassuranceStrip /> : null}

          {state.kind === "idle" && (
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
                borderRadius: Radius.full,
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

          {state.kind === "previewing" && (
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator size="small" color={accent.primaryLight} />
              <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>
                Reading {state.fileName}&hellip;
              </Text>
            </View>
          )}

          {state.kind === "preview" && (
            <CsvImportPreview
              source={state.source}
              total={state.total}
              unmatched={state.unmatched}
              truncated={state.truncated}
              sample={state.sample}
              committing={state.committing}
              onConfirm={flow.confirm}
              onCancel={flow.reset}
            />
          )}

          {state.kind === "success" && (
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
                    fontFamily: Type.captionSmall.fontFamily,
                    fontSize: Type.captionSmall.fontSize,
                    lineHeight: Type.captionSmall.lineHeight,
                    fontWeight: "600",
                    color: Accent.successLight ?? Accent.success,
                  }}
                >
                  Imported {state.imported} meal
                  {state.imported === 1 ? "" : "s"}
                </Text>
              </View>
              {state.unmatched > 0 ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {state.unmatched} row{state.unmatched === 1 ? "" : "s"}{" "}
                  skipped (missing calories).
                </Text>
              ) : null}
              {state.truncated ? (
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

          {state.kind === "error" && (
            <View style={{ marginTop: 12 }}>
              <Text
                style={{ ...Type.captionSmall, color: Accent.warningSolid, marginBottom: 8 }}
                accessibilityRole="alert"
              >
                {state.message}
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
                  borderRadius: Radius.full,
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
                  style={{ fontSize: 13, fontWeight: "600", color: colors.text }}
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
