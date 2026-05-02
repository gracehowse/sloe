/**
 * PhotoLogSheet (Batch 5.13 + 2026-05-02 confidence-framing port).
 *
 * Mobile Pro-tier AI photo logging review sheet. Mirrors the web
 * dialog at `src/app/components/suppr/photo-log-dialog.tsx`.
 *
 * Flow:
 *  1. Camera / library picker via expo-image-picker.
 *  2. Preview the selected image.
 *  3. "Analyse" POSTs multipart form-data to `/api/nutrition/photo-log`.
 *  4. Review:
 *     - Plate hero card: midpoint kcal headline + plate-level confidence
 *       meter + tappable range caption.
 *     - Item list: collapsed by default (name + midpoint + meter +
 *       chevron + remove). Expand to edit macros / verify against USDA
 *       / Open Food Facts.
 *     - "AI estimate" badge swaps to a green "database · verified"
 *       badge after the user matches against the database.
 *  5. Tri-state save copy ("Log verified" / "Log meal" / "Log estimate").
 *
 * Why midpoint-with-confidence-meter framing? See
 * `docs/decisions/2026-05-02-photo-log-confidence-framing.md` — keeps
 * the honest-uncertainty posture the customer-lens P1 caveat called
 * for, presented in a way that converts Cal AI users.
 *
 * Shares sanitisation / confidence classification / totals / midpoint /
 * range / tri-state save copy with web via `src/lib/nutrition/aiLogging.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Check, ChevronDown, ChevronUp, MoreHorizontal, ShieldCheck, X } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import {
  aggregateRange,
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  midpoint,
  photoLogSaveCopy,
  plateConfidence,
  rangeFor,
  sanitiseAiItems,
  type AiLoggedItem,
  type ConfidenceLevel,
} from "../../../src/lib/nutrition/aiLogging";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import Badge from "./Badge";

// Enable LayoutAnimation on Android (no-op on iOS where it's always on).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
  border: string;
};

type PickedAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  activeSlot: string;
  accessToken?: string | null;
  apiBase: string;
  onCommit: (items: AiLoggedItem[]) => void;
  colors: Theme;
};

type Stage = "pick" | "analysing" | "review" | "error";

/**
 * 4-segment confidence meter — 12px wide × 28px tall on mobile (vs
 * 16×40 on web), 2px gaps between segments.
 *
 *  - high (>=0.75): 4/4 filled, Accent.success
 *  - medium (0.5–0.75): 2/4 filled, Accent.warning
 *  - low (<0.5): 1/4 filled, Accent.destructive
 *  - verified: 4/4 Accent.success + leading 10px check glyph
 */
function ConfidenceMeter({
  level,
  verified = false,
  onPress,
  accessibilityLabel,
}: {
  level: ConfidenceLevel;
  verified?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const filled = verified || level === "high" ? 4 : level === "medium" ? 2 : 1;
  const color = verified || level === "high"
    ? Accent.success
    : level === "medium"
      ? Accent.warning
      : Accent.destructive;

  const meterContent = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {verified && <Check size={10} color={Accent.success} strokeWidth={3} />}
      <View
        style={{
          width: 12,
          height: 28,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {[0, 1, 2, 3].map((idx) => {
          // Fill from the bottom up — segment idx 0 is bottom.
          const isFilled = idx < filled;
          return (
            <View
              key={idx}
              style={{
                width: 12,
                height: (28 - 6) / 4, // 4 bars + 3 × 2px gaps = 22 / 4 = 5.5
                backgroundColor: isFilled ? color : "#94a3b822",
                borderRadius: 2,
              }}
            />
          );
        })}
      </View>
    </View>
  );

  const a11y =
    accessibilityLabel ??
    (verified
      ? "Verified against database"
      : level === "high"
        ? "High confidence"
        : level === "medium"
          ? "Medium confidence"
          : "Low confidence");

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        hitSlop={6}
      >
        {meterContent}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={a11y} accessibilityRole="image">
      {meterContent}
    </View>
  );
}

function levelLabel(level: ConfidenceLevel): string {
  if (level === "high") return "high confidence";
  if (level === "medium") return "medium confidence";
  return "low confidence";
}

export default function PhotoLogSheet({
  visible,
  onClose,
  activeSlot,
  accessToken,
  apiBase,
  onCommit,
  colors,
}: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [asset, setAsset] = useState<PickedAsset | null>(null);
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [verifyingIndex, setVerifyingIndex] = useState<number | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStage("pick");
      setAsset(null);
      setItems([]);
      setExpanded({});
      setVerifyingIndex(null);
      setVerifyError(null);
      setTooltipOpen(false);
      setErrorMsg(null);
      track(AnalyticsEvents.ai_photo_log_started);
    }
  }, [visible]);

  const pickFromCamera = useCallback(async () => {
    setErrorMsg(null);
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Camera access is required for photo logging.");
        setStage("error");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const a = result.assets[0];
      setAsset({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
    } catch {
      setErrorMsg("Camera unavailable — use a development build with expo-image-picker.");
      setStage("error");
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    setErrorMsg(null);
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Photo library permission is required.");
        setStage("error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const a = result.assets[0];
      setAsset({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
    } catch {
      setErrorMsg("Library picker unavailable.");
      setStage("error");
    }
  }, []);

  const submitPhoto = useCallback(async () => {
    if (!asset) return;
    setStage("analysing");
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? "meal.jpg",
      } as any);
      const resp = await fetch(`${apiBase}/api/nutrition/photo-log`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: form,
      });
      const data = await resp.json();
      if (resp.status === 403 && data?.error === "upgrade_required") {
        setErrorMsg(
          typeof data.message === "string"
            ? data.message
            : "AI photo logging is a Pro feature. Upgrade to use it.",
        );
        setStage("error");
        return;
      }
      if (!data?.ok || !Array.isArray(data.items)) {
        setErrorMsg(
          typeof data?.message === "string"
            ? data.message
            : "Could not identify food in that photo. Try a clearer angle.",
        );
        setStage("error");
        return;
      }
      const cleaned = sanitiseAiItems(data.items, "ai_photo");
      if (cleaned.length === 0) {
        setErrorMsg("No food items were identified. Try a clearer, well-lit photo.");
        setStage("error");
        return;
      }
      setItems(cleaned);
      setExpanded({});
      setStage("review");
    } catch {
      setErrorMsg("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [accessToken, apiBase, asset]);

  const totals = useMemo(() => aggregateTotals(items), [items]);
  const plateRange = useMemo(() => aggregateRange(items), [items]);
  const plateConf = useMemo(() => plateConfidence(items), [items]);
  const allVerified = useMemo(
    () => items.length > 0 && items.every((i) => i.verified === true),
    [items],
  );
  const saveCopy = useMemo(() => photoLogSaveCopy(items), [items]);

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        // Edit-without-verify must NOT auto-set `verified`.
        const editingMacroOrName =
          "name" in patch ||
          "calories" in patch ||
          "protein" in patch ||
          "carbs" in patch ||
          "fat" in patch ||
          "fiber" in patch;
        if (editingMacroOrName && !("verified" in patch)) {
          next.verified = false;
        }
        return next;
      }),
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        if (idx > index) next[idx - 1] = v;
      });
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const expandAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next: Record<number, boolean> = {};
    items.forEach((_, i) => {
      next[i] = true;
    });
    setExpanded(next);
  };

  const handleVerify = useCallback(
    async (index: number) => {
      const item = items[index];
      if (!item) return;
      const before = classifyConfidence(item.confidence);
      track(AnalyticsEvents.ai_photo_log_verify_tapped, {
        confidenceBefore: before,
        itemIndex: index,
      });
      setVerifyingIndex(index);
      setVerifyError(null);
      try {
        // Reuse the existing recipe-line verifier (USDA → OFF → Edamam
        // → FatSecret → estimation) with a single-ingredient payload.
        const amountStr =
          item.grams != null && Number.isFinite(item.grams)
            ? String(item.grams)
            : "100";
        const resp = await fetch(`${apiBase}/api/nutrition/verify-recipe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            ingredients: [{ name: item.name, amount: amountStr, unit: "g" }],
            servings: 1,
          }),
        });
        if (!resp.ok) throw new Error(`status_${resp.status}`);
        const data = await resp.json();
        const verified = data?.verified?.[0];
        const macros = verified?.macros;
        if (!data?.ok || !verified || !macros || verified.confidence < 0.5) {
          track(AnalyticsEvents.ai_photo_log_verify_failed, {
            itemIndex: index,
            reason: "no_match",
          });
          setVerifyError("No high-confidence match in our database — keep the AI estimate or edit manually.");
          return;
        }
        setItems((prev) =>
          prev.map((it, i) => {
            if (i !== index) return it;
            const next: AiLoggedItem = {
              ...it,
              verified: true,
              confidence: 1,
            };
            if (Number.isFinite(macros.calories)) next.calories = Math.round(Number(macros.calories));
            if (Number.isFinite(macros.protein)) next.protein = Math.round(Number(macros.protein));
            if (Number.isFinite(macros.carbs)) next.carbs = Math.round(Number(macros.carbs));
            if (Number.isFinite(macros.fat)) next.fat = Math.round(Number(macros.fat));
            if (macros.fiber != null && Number.isFinite(macros.fiber)) {
              next.fiber = Math.round(Number(macros.fiber));
            }
            next.caloriesLow = undefined;
            next.caloriesHigh = undefined;
            return next;
          }),
        );
        track(AnalyticsEvents.ai_photo_log_verify_succeeded, { itemIndex: index });
      } catch {
        track(AnalyticsEvents.ai_photo_log_verify_failed, {
          itemIndex: index,
          reason: "server_error",
        });
        setVerifyError("Can't reach database — try again.");
      } finally {
        setVerifyingIndex(null);
      }
    },
    [accessToken, apiBase, items],
  );

  const handleLogAll = () => {
    if (items.length === 0) return;
    onCommit(items);
    track(AnalyticsEvents.ai_photo_log_committed, {
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    });
    onClose();
  };

  const numField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    accessibilityLabel: string,
    editable: boolean,
  ) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numeric"
        editable={editable}
        value={String(value)}
        onChangeText={(t) => {
          const n = Math.max(0, Number(t.replace(/[^0-9.]/g, "")));
          onChange(Number.isFinite(n) ? Math.round(n) : 0);
        }}
        style={{
          backgroundColor: colors.inputBg,
          borderRadius: Radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 6,
          fontSize: 13,
          color: colors.text,
          marginTop: 2,
          opacity: editable ? 1 : 0.6,
        }}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xxl,
              maxHeight: "90%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder }} />
            </View>
            {/* Header row: title + X close (audit 2026-04-30 modal-dismiss
                sweep — keyboard-up on iOS can hide the backdrop strip). */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="camera" size={20} color={Accent.primary} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Photo log</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
              {stage === "review"
                ? `We identified ${items.length} item${items.length === 1 ? "" : "s"}. Review, edit or verify before logging.`
                : stage === "analysing"
                  ? "Identifying items and estimating portions…"
                  : "Snap a photo of your meal and we'll estimate portions and macros."}
            </Text>

            {stage === "pick" && (
              <View>
                {asset ? (
                  <Image
                    source={{ uri: asset.uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.inputBg,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.inputBg,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
                    <Text style={{ fontSize: 13, color: colors.textTertiary }}>Pick a photo to analyse</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                    onPress={pickFromCamera}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderRadius: Radius.md,
                      backgroundColor: Accent.primary + "22",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="camera" size={16} color={Accent.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>Camera</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pick from photo library"
                    onPress={pickFromLibrary}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="images" size={16} color={colors.text} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Library</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.md }}>
                  AI estimates. Photo is sent to our servers and processed by OpenAI.
                  Low-confidence items will be flagged for verification.
                </Text>
              </View>
            )}

            {stage === "analysing" && (
              <View style={{ alignItems: "center", paddingVertical: Spacing.xl, gap: 10 }}>
                <ActivityIndicator size="small" color={Accent.primary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Identifying items and estimating portions…
                </Text>
              </View>
            )}

            {stage === "error" && (
              <View
                accessibilityRole="alert"
                style={{
                  borderWidth: 1,
                  borderColor: Accent.destructive + "66",
                  backgroundColor: Accent.destructive + "10",
                  borderRadius: Radius.md,
                  padding: Spacing.md,
                }}
              >
                <Text style={{ fontSize: 13, color: Accent.destructive }}>
                  {errorMsg ?? "Something went wrong."}
                </Text>
              </View>
            )}

            {stage === "review" && (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {asset && (
                  <Image
                    source={{ uri: asset.uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      marginBottom: Spacing.sm,
                    }}
                    resizeMode="cover"
                  />
                )}

                {/* Plate hero card — midpoint headline + meter + range. */}
                <View
                  accessible
                  accessibilityLabel={`Plate total ${totals.calories} kilocalories, ${items.length} item${items.length === 1 ? "" : "s"}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.background,
                    borderRadius: Radius.md,
                    padding: Spacing.md,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: colors.text,
                        lineHeight: 30,
                      }}
                    >
                      ~{totals.calories} kcal
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      plate total · {items.length} item{items.length === 1 ? "" : "s"}
                    </Text>
                    {(plateRange.low > 0 || plateRange.high > 0) && !allVerified && (
                      <Pressable
                        onPress={expandAll}
                        accessibilityRole="button"
                        accessibilityLabel="Expand all items"
                        hitSlop={4}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                      >
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                          Range {plateRange.low}–{plateRange.high} · {levelLabel(plateConf)}
                        </Text>
                        <ChevronDown size={12} color={colors.textTertiary} />
                      </Pressable>
                    )}
                    {allVerified && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Check size={12} color={Accent.success} strokeWidth={3} />
                        <Text style={{ fontSize: 11, color: Accent.success }}>all items verified</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ marginLeft: Spacing.sm }}>
                    <ConfidenceMeter
                      level={plateConf}
                      verified={allVerified}
                      onPress={() => setTooltipOpen((v) => !v)}
                      accessibilityLabel={
                        allVerified
                          ? "All items verified"
                          : `Plate ${levelLabel(plateConf)}. Tap for details.`
                      }
                    />
                  </View>
                </View>
                {tooltipOpen && (
                  <View
                    accessibilityRole="alert"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.card,
                      borderRadius: Radius.sm,
                      padding: Spacing.sm,
                      marginBottom: Spacing.sm,
                      marginTop: -Spacing.xs,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.text }}>
                      Estimated from photo. Tap &ldquo;Verify&rdquo; to match against
                      USDA / Open Food Facts.
                    </Text>
                  </View>
                )}

                {items.map((item, i) => {
                  const level = classifyConfidence(item.confidence);
                  const verified = item.verified === true;
                  const range = rangeFor(item);
                  const isExpanded = !!expanded[i];
                  const isVerifying = verifyingIndex === i;
                  const itemMid = midpoint(item);

                  const borderColor = verified
                    ? Accent.success + "66"
                    : level === "low"
                      ? Accent.destructive + "66"
                      : level === "medium"
                        ? Accent.warning + "66"
                        : colors.cardBorder;
                  const bgColor = verified
                    ? Accent.success + "0F"
                    : level === "low"
                      ? Accent.destructive + "0F"
                      : level === "medium"
                        ? Accent.warning + "0F"
                        : colors.background;

                  return (
                    <View
                      key={`${item.name}-${i}`}
                      style={{
                        borderWidth: 1,
                        borderColor,
                        backgroundColor: bgColor,
                        borderRadius: Radius.md,
                        padding: Spacing.md,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      {/* Row 1: name + midpoint + meter + chevron + remove */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            accessibilityLabel={`Item ${i + 1} name`}
                            value={item.name}
                            onChangeText={(t) => updateItem(i, { name: t })}
                            style={{
                              backgroundColor: colors.inputBg,
                              borderRadius: Radius.sm,
                              paddingHorizontal: 8,
                              paddingVertical: 6,
                              fontSize: 14,
                              fontWeight: "600",
                              color: colors.text,
                            }}
                          />
                        </View>
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: "700",
                            color: colors.text,
                          }}
                        >
                          ~{itemMid} kcal
                        </Text>
                        <ConfidenceMeter level={level} verified={verified} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                          onPress={() => toggleExpand(i)}
                          hitSlop={6}
                        >
                          {isExpanded ? (
                            <ChevronUp size={18} color={colors.textSecondary} />
                          ) : (
                            <ChevronDown size={18} color={colors.textSecondary} />
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                          onPress={() => removeItem(i)}
                          hitSlop={6}
                        >
                          <MoreHorizontal size={18} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                      {/* Row 2: range caption + chip */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        {!verified && (
                          <Text style={{ fontSize: 11, color: colors.textTertiary, flex: 1 }}>
                            range {range.low}–{range.high} ·
                          </Text>
                        )}
                        {verified ? (
                          <Badge
                            variant="added"
                            accessibilityLabel="Verified against database"
                            icon={<Check size={10} color={Accent.success} strokeWidth={3} />}
                          >
                            database · verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="ai"
                            accessibilityLabel="AI estimated nutrition"
                            icon={<Ionicons name="sparkles-outline" size={10} color="#8b5cf6" />}
                          >
                            AI estimate
                          </Badge>
                        )}
                      </View>
                      {/* Row 3 (expanded): macro inputs + verify CTA */}
                      {isExpanded && (
                        <>
                          <View style={{ flexDirection: "row", gap: 6, marginTop: Spacing.sm }}>
                            {numField("kcal", item.calories, (n) => updateItem(i, { calories: n }), `${item.name} calories`, !isVerifying)}
                            {numField("P (g)", item.protein, (n) => updateItem(i, { protein: n }), `${item.name} protein`, !isVerifying)}
                            {numField("C (g)", item.carbs, (n) => updateItem(i, { carbs: n }), `${item.name} carbs`, !isVerifying)}
                            {numField("F (g)", item.fat, (n) => updateItem(i, { fat: n }), `${item.name} fat`, !isVerifying)}
                          </View>
                          {!verified && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Verify ${item.name} with database`}
                              disabled={isVerifying}
                              onPress={() => handleVerify(i)}
                              style={{
                                marginTop: Spacing.sm,
                                alignSelf: "flex-start",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: Radius.md,
                                borderWidth: 1,
                                borderColor: Accent.primary + "55",
                                backgroundColor: Accent.primary + "11",
                                opacity: isVerifying ? 0.6 : 1,
                              }}
                            >
                              {isVerifying ? (
                                <ActivityIndicator size="small" color={Accent.primary} />
                              ) : (
                                <ShieldCheck size={14} color={Accent.primary} />
                              )}
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: Accent.primary,
                                }}
                              >
                                {isVerifying ? "Verifying…" : "Verify with database"}
                              </Text>
                            </Pressable>
                          )}
                          {!verified && verifyingIndex === null && verifyError && (
                            <Text
                              accessibilityRole="alert"
                              style={{ fontSize: 11, color: Accent.destructive, marginTop: 6 }}
                            >
                              {verifyError}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}

                <Text
                  style={{
                    fontSize: 11,
                    fontStyle: "italic",
                    color: colors.textTertiary,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                >
                  AI estimates. Verify with the database to lock macros to a known source.
                </Text>

                <View
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: Radius.md,
                    padding: Spacing.md,
                    marginTop: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Logging to <Text style={{ color: colors.text, fontWeight: "700" }}>{activeSlot}</Text> · midpoints shown.
                    Total: {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
                    {totals.fiber != null ? ` · Fi ${totals.fiber}g` : ""}
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Action row */}
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={stage === "review" ? "Back" : "Cancel"}
                onPress={stage === "review" ? () => setStage("pick") : onClose}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {stage === "review" ? "Back" : "Cancel"}
                </Text>
              </Pressable>
              {stage === "pick" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Analyse photo"
                  onPress={submitPhoto}
                  disabled={!asset}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: asset ? Accent.primary : colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Analyse</Text>
                </Pressable>
              )}
              {stage === "error" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  onPress={() => setStage("pick")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Try again</Text>
                </Pressable>
              )}
              {stage === "review" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    saveCopy.subcaption
                      ? `${saveCopy.primary}. ${saveCopy.subcaption}`
                      : saveCopy.primary
                  }
                  onPress={handleLogAll}
                  disabled={items.length === 0}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor:
                      items.length === 0
                        ? colors.cardBorder
                        : saveCopy.primary === "Log verified"
                          ? Accent.success
                          : Accent.primary,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    {saveCopy.primary}
                  </Text>
                  {saveCopy.subcaption && (
                    <Text
                      style={{ fontSize: 10, fontWeight: "500", color: "#ffffffcc", marginTop: 2 }}
                    >
                      {saveCopy.subcaption}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
