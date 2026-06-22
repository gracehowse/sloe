/**
 * ReportRecipeSheet — the per-recipe "Report an issue" sheet (ENG-1227), the
 * iOS-primary parity mirror of the web `ReportRecipeDialog` (ENG-1225 #19).
 *
 * Routing is honest — no report is silently dropped:
 *   - Copyright / "this is my content" → opens the web DMCA takedown form
 *     (`/dmca?recipe=<id>`, the real `dmca_takedowns` flow) in the browser.
 *   - Everything else → durably POSTed to `/api/recipe-report` (the OSA/DSA
 *     review queue) → acknowledgement. Email is only the error fallback.
 *
 * Copy is the legal-reviewed web copy verbatim: a *recipe* (ingredients +
 * method) isn't copyrightable — only its creative expression is — so we avoid
 * "I own this recipe", and we "start a request", never promise a takedown.
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertTriangle,
  Copyright,
  HelpCircle,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { getSupprApiBase } from "@/lib/supprWeb";

const SUPPORT_EMAIL = "support@getsloe.com";

type ReportReason = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  kind: "dmca" | "report";
};

const REASONS: ReportReason[] = [
  {
    key: "copyright",
    label: "Copyright — this is my content",
    hint: "Starts a copyright takedown request with our team.",
    icon: Copyright,
    kind: "dmca",
  },
  {
    key: "incorrect",
    label: "Incorrect nutrition or instructions",
    hint: "Wrong calories, steps, or ingredients.",
    icon: AlertTriangle,
    kind: "report",
  },
  {
    key: "unsafe",
    label: "Inappropriate or unsafe",
    hint: "Offensive content or an unsafe cooking method.",
    icon: ShieldAlert,
    kind: "report",
  },
  {
    key: "other",
    label: "Something else",
    hint: "Tell us what's wrong.",
    icon: HelpCircle,
    kind: "report",
  },
];

type Phase = "choose" | "describe" | "sending" | "sent" | "error";

export interface ReportRecipeSheetProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle?: string;
}

export function ReportRecipeSheet({
  visible,
  onClose,
  recipeId,
  recipeTitle,
}: ReportRecipeSheetProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [phase, setPhase] = useState<Phase>("choose");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");

  // Reset whenever the sheet (re)opens so a prior session doesn't leak in.
  useEffect(() => {
    if (visible) {
      setPhase("choose");
      setReason(null);
      setDescription("");
    }
  }, [visible]);

  const pick = (r: ReportReason) => {
    if (r.kind === "dmca") {
      const base = getSupprApiBase();
      void Linking.openURL(`${base}/dmca?recipe=${encodeURIComponent(recipeId)}`);
      onClose();
      return;
    }
    setReason(r);
    setPhase("describe");
  };

  const submit = async () => {
    if (!reason) return;
    setPhase("sending");
    try {
      const res = await fetch(`${getSupprApiBase()}/api/recipe-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          reason: reason.key,
          description: description.trim() || undefined,
        }),
      });
      setPhase(res.ok ? "sent" : "error");
    } catch {
      setPhase("error");
    }
  };

  const mailtoFallback = () => {
    const title = recipeTitle?.trim() || `recipe ${recipeId}`;
    const subject = encodeURIComponent(`Recipe report — ${title}`);
    const body = encodeURIComponent(
      `Recipe: ${title} (id: ${recipeId})\nReason: ${reason?.label ?? ""}\n\n${description}`,
    );
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const sending = phase === "sending";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
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
              maxHeight: "85%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <View
                style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }}
              />
            </View>

            {phase === "sent" ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ ...Type.navTitle, color: colors.text }}>Thanks for flagging this</Text>
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs }}>
                  We&apos;ve logged your report and review reports within 5 business days. Reporting
                  flags content for review and doesn&apos;t guarantee removal.
                </Text>
                <PrimaryButton label="Done" onPress={onClose} accent={accent.primary} ink={colors.primaryForeground} />
              </ScrollView>
            ) : phase === "error" ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ ...Type.navTitle, color: colors.text }}>Couldn&apos;t save that</Text>
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs }}>
                  Something went wrong saving your report.{" "}
                  <Text style={{ ...Type.body, color: colors.text }} onPress={mailtoFallback}>
                    Email {SUPPORT_EMAIL}
                  </Text>{" "}
                  and we&apos;ll look into it.
                </Text>
                <PrimaryButton label="Close" onPress={onClose} accent={accent.primary} ink={colors.primaryForeground} />
              </ScrollView>
            ) : phase === "describe" || sending ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={{ ...Type.navTitle, color: colors.text }}>{reason?.label}</Text>
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md }}>
                  Add anything that helps us review it. Reporting flags content for review — it
                  doesn&apos;t guarantee removal.
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={5000}
                  multiline
                  numberOfLines={4}
                  editable={!sending}
                  placeholder="What's wrong? (optional)"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Describe the issue"
                  style={{
                    minHeight: 96,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderRadius: Radius.md,
                    paddingHorizontal: Spacing.dense,
                    paddingVertical: Spacing.sm,
                    color: colors.text,
                    backgroundColor: colors.background,
                    textAlignVertical: "top",
                    ...Type.body,
                  }}
                />
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                  <SecondaryButton label="Back" onPress={() => setPhase("choose")} disabled={sending} colors={colors} />
                  <PrimaryButton
                    label={sending ? "Sending…" : "Submit report"}
                    onPress={() => void submit()}
                    disabled={sending}
                    accent={accent.primary}
                    ink={colors.primaryForeground}
                    flex
                  />
                </View>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm }}
                >
                  <Text style={{ flex: 1, ...Type.navTitle, color: colors.text }}>Report an issue</Text>
                  <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                    <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
                  </Pressable>
                </View>
                <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md }}>
                  What&apos;s wrong with this recipe? Copyright claims go to our DMCA team; everything
                  else reaches our review queue. We respond within 5 business days.
                </Text>
                <View style={{ gap: Spacing.sm }}>
                  {REASONS.map((r) => {
                    const Icon = r.icon;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => pick(r)}
                        accessibilityRole="button"
                        accessibilityLabel={r.label}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: Spacing.dense,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          borderRadius: Radius.xl,
                          paddingHorizontal: Spacing.dense,
                          paddingVertical: Spacing.dense,
                          backgroundColor: colors.background,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: Radius.lg,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.cardBorder,
                          }}
                        >
                          <Icon size={16} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ ...Type.body, color: colors.text }}>{r.label}</Text>
                          <Text style={{ ...Type.bodyMuted, color: colors.textSecondary, marginTop: 2 }}>
                            {r.hint}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PrimaryButton({
  label,
  onPress,
  accent,
  ink,
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  accent: string;
  ink: string;
  disabled?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        flex: flex ? 1 : undefined,
        marginTop: flex ? 0 : Spacing.md,
        paddingVertical: Spacing.dense,
        alignItems: "center",
        borderRadius: Radius.md,
        backgroundColor: accent,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ ...Type.button, color: ink }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: { text: string; cardBorder: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        paddingVertical: Spacing.dense,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: Radius.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ ...Type.button, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export default ReportRecipeSheet;
