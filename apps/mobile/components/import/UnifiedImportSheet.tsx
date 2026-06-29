import { useEffect, useState } from "react";
import {
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
import { X } from "lucide-react-native";
import { SupprButton } from "@/components/ui/SupprButton";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { classifyImport } from "@suppr/shared/recipe-import/classifyImport";
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
  // v3 prototype detection-driven CTA (ENG-1247 A13): name what you're about to
  // import ("Import recipe link") and guide the empty state ("Paste something to
  // import"), instead of a flat "Import". Web parity: unified-import-sheet.tsx.
  const ctaLabel = canImport
    ? `Import ${classification.label.toLowerCase()}`
    : "Paste something to import";

  const onImport = () => {
    // Adapt expo-router's strictly-typed `push` to the routing helper's generic
    // shape — the destinations are string-literal routes pinned by importRouting.test.
    const result = routeImport(classification, text, {
      push: (t) => router.push(t as never),
    });
    if (result.routed) {
      onClose();
    } else {
      setHint(result.hint ?? null);
    }
  };

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
              Paste a TikTok, Instagram or YouTube link, a recipe URL, a meal plan, an MFP export, or
              recipe text — we&apos;ll figure out what it is.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ position: "relative" }}>
              <TextInput
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  if (hint) setHint(null);
                }}
                multiline
                numberOfLines={4}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Paste here…"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Paste a link, plan, export, or recipe"
                testID="unified-import-input"
                style={{
                  minHeight: 96,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  paddingHorizontal: Spacing.dense,
                  paddingVertical: Spacing.sm,
                  paddingRight: text.trim().length > 0 ? Spacing.xxl : Spacing.dense,
                  color: colors.text,
                  backgroundColor: colors.background,
                  textAlignVertical: "top",
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
                <ImportDetectedChip input={text} />
              </View>

              {hint ? (
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs }}>
                  {hint}
                </Text>
              ) : null}
            </ScrollView>

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
