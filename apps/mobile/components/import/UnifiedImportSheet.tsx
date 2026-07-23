import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FolderOpen, X } from "lucide-react-native";
import { SupprButton } from "@/components/ui/SupprButton";
import { PressableScale } from "@/components/ui/PressableScale";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { classifyImport } from "@suppr/shared/recipe-import/classifyImport";
import {
  IMPORT_INPUT_INTRO,
  IMPORT_INPUT_PLACEHOLDER,
  IMPORT_INPUT_SAMPLES,
} from "@suppr/shared/recipe-import/importInputSamples";
import { isFeatureEnabled } from "@/lib/analytics";
import { ImportDetectedChip } from "./ImportDetectedChip";
import { routeImport } from "@/lib/importRouting";

/**
 * UnifiedImportSheet (ENG-1225 #3) — the viral import wedge's single front door:
 * one paste field that accepts ANYTHING (a TikTok/IG/YouTube link, a recipe URL,
 * a meal plan, an MFP/Cronometer CSV, or pasted recipe text), shows a live
 * "Detected: {label}" chip, and routes to the right existing flow on Import.
 * Replaces having to know WHICH import surface to use. Gated by the host behind
 * `sloe_v3_unified_import`; the legacy per-surface entries stay alive in the
 * flag-off path.
 */
export function UnifiedImportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const v3 = isFeatureEnabled("import_input_v3_polish");
  const [text, setText] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText("");
      setHint(null);
    }
  }, [visible]);

  const classification = classifyImport(text);
  const canImport = classification.kind !== "empty";
  const ctaLabel = canImport
    ? `Import ${classification.label.toLowerCase()}`
    : "Paste something to import";

  const onImport = () => {
    const result = routeImport(classification, text, {
      push: (t) => router.push(t as never),
    });
    if (result.routed) {
      onClose();
    } else {
      setHint(result.hint ?? null);
    }
  };

  const onChooseFile = useCallback(async () => {
    Alert.alert("Choose a file", undefined, [
      {
        text: "CSV export",
        onPress: async () => {
          try {
            const DocumentPicker = (await import("expo-document-picker")) as typeof import("expo-document-picker");
            const res = await DocumentPicker.getDocumentAsync({
              type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"],
              copyToCacheDirectory: true,
            });
            if (res.canceled || !res.assets?.[0]) return;
            const asset = res.assets[0];
            const response = await fetch(asset.uri);
            const content = await response.text();
            setText(content.trim() ? content : (asset.name ?? "import.csv"));
            if (hint) setHint(null);
          } catch (e) {
            Alert.alert("Import failed", e instanceof Error ? e.message : "Could not open the file picker.");
          }
        },
      },
      {
        text: "Photo",
        onPress: async () => {
          try {
            const ImagePicker = (await import("expo-image-picker")) as typeof import("expo-image-picker");
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert("Photos access", "Allow photo access to import a recipe photo.");
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.9,
            });
            if (res.canceled || !res.assets?.[0]) return;
            setText(res.assets[0].fileName ?? "recipe-photo.jpg");
            if (hint) setHint(null);
          } catch (e) {
            Alert.alert("Import failed", e instanceof Error ? e.message : "Could not open the photo picker.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [hint]);

  const legacyIntro =
    "Paste a TikTok, Instagram or YouTube link, a recipe URL, a meal plan, an MFP export, or recipe text — we'll figure out what it is.";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              gap: Spacing.md,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...Type.navTitle, color: colors.text }}>Import</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>
            <Text style={{ ...Type.bodyMuted, color: colors.textSecondary }}>
              {v3 ? IMPORT_INPUT_INTRO : legacyIntro}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ position: "relative" }}>
                <TextInput
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    if (hint) setHint(null);
                  }}
                  multiline={!v3}
                  numberOfLines={v3 ? 1 : 4}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={v3 ? IMPORT_INPUT_PLACEHOLDER : "Paste here…"}
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Paste a link, plan, export, or recipe"
                  testID="unified-import-input"
                  style={{
                    minHeight: v3 ? 40 : 96,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderRadius: Radius.md,
                    paddingHorizontal: Spacing.dense,
                    paddingVertical: Spacing.sm,
                    paddingRight: text.trim().length > 0 ? Spacing.xxl : Spacing.dense,
                    color: colors.text,
                    backgroundColor: colors.background,
                    textAlignVertical: v3 ? "center" : "top",
                    ...Type.body,
                  }}
                />
                {text.trim().length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setText("");
                      if (hint) setHint(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear pasted text"
                    testID="unified-import-clear"
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      right: Spacing.sm,
                      top: Spacing.sm,
                      width: 32,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: Radius.full,
                    }}
                  >
                    <X size={IconSize.md} color={colors.textSecondary} strokeWidth={2.25} />
                  </Pressable>
                ) : null}
              </View>

              <View style={{ marginTop: Spacing.sm, minHeight: 28, justifyContent: "center" }}>
                {canImport ? (
                  <ImportDetectedChip input={text} />
                ) : v3 ? (
                  <View testID="unified-import-samples">
                    <Text
                      style={{
                        ...Type.captionSmall,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        color: colors.textSecondary,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      Or try an example
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
                      {IMPORT_INPUT_SAMPLES.map((sample) => (
                        <PressableScale
                          key={sample.id}
                          haptic="selection"
                          onPress={() => {
                            setText(sample.value);
                            if (hint) setHint(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Try example: ${sample.label}`}
                          testID={`unified-import-sample-${sample.id}`}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            borderRadius: Radius.full,
                            paddingHorizontal: Spacing.dense,
                            paddingVertical: Spacing.sm,
                            backgroundColor: colors.background,
                          }}
                        >
                          <Text style={{ ...Type.caption, fontWeight: "600", color: colors.text }}>
                            {sample.label}
                          </Text>
                        </PressableScale>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              {hint ? (
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs }}>
                  {hint}
                </Text>
              ) : null}
            </ScrollView>

            {v3 ? (
              <PressableScale
                haptic="light"
                onPress={onChooseFile}
                accessibilityRole="button"
                accessibilityLabel="Choose a file"
                testID="unified-import-choose-file"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: Spacing.sm,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  paddingVertical: Spacing.md,
                  backgroundColor: colors.background,
                }}
              >
                <FolderOpen size={16} color={colors.text} />
                <Text style={{ ...Type.body, fontWeight: "600", color: colors.text }}>
                  Choose a file (.csv, photo)
                </Text>
              </PressableScale>
            ) : null}

            <SupprButton
              variant="primary"
              label={ctaLabel}
              onPress={onImport}
              disabled={!canImport}
              accessibilityLabel="Import the pasted content"
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default UnifiedImportSheet;
