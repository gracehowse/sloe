/**
 * PhotoLogSheet (Batch 5.13) — mobile Pro-tier AI photo logging sheet.
 *
 * Mirrors `src/app/components/suppr/photo-log-dialog.tsx` behaviour:
 *  1. Camera / library picker via expo-image-picker.
 *  2. Preview the selected image.
 *  3. "Analyse" POSTs multipart form-data to `/api/nutrition/photo-log`.
 *  4. Review list with per-item confidence badge + inline macro edit.
 *  5. Tap "Log all" → caller commits each item as a `JournalMeal` with
 *     source `"AI photo"`.
 *
 * Shares sanitisation / confidence classification / totals with web via
 * `src/lib/nutrition/aiLogging.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  sanitiseAiItems,
  type AiLoggedItem,
} from "../../../src/lib/nutrition/aiLogging";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import Badge from "./Badge";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStage("pick");
      setAsset(null);
      setItems([]);
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
      setStage("review");
    } catch {
      setErrorMsg("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [accessToken, apiBase, asset]);

  const totals = useMemo(() => aggregateTotals(items), [items]);
  const hasLowConfidence = items.some((i) => isLowConfidence(i));

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

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
  ) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numeric"
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
        }}
      />
    </View>
  );

  const confidenceColor = (c: number) => {
    const level = classifyConfidence(c);
    if (level === "high") return Accent.success;
    if (level === "medium") return Accent.warning;
    return "#EF4444";
  };

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Ionicons name="camera" size={20} color={Accent.primary} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Photo log</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
              {stage === "review"
                ? `We identified ${items.length} item${items.length === 1 ? "" : "s"}. Review, edit or remove before logging.`
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
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Analysing your photo…</Text>
              </View>
            )}

            {stage === "error" && (
              <View
                accessibilityRole="alert"
                style={{
                  borderWidth: 1,
                  borderColor: "#EF444466",
                  backgroundColor: "#EF444410",
                  borderRadius: Radius.md,
                  padding: Spacing.md,
                }}
              >
                <Text style={{ fontSize: 13, color: "#B91C1C" }}>{errorMsg ?? "Something went wrong."}</Text>
              </View>
            )}

            {stage === "review" && (
              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
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
                {items.map((item, i) => {
                  const low = isLowConfidence(item);
                  const cColor = confidenceColor(item.confidence);
                  return (
                    <View
                      key={`${item.name}-${i}`}
                      style={{
                        borderWidth: 1,
                        borderColor: low ? "#F59E0B55" : colors.cardBorder,
                        backgroundColor: low ? "#F59E0B0F" : colors.background,
                        borderRadius: Radius.md,
                        padding: Spacing.md,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
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
                          {item.unit && (
                            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                              {item.unit}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              borderRadius: 999,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              backgroundColor: cColor + "22",
                            }}
                          >
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cColor }} />
                            <Text style={{ fontSize: 10, fontWeight: "700", color: cColor }}>
                              {classifyConfidence(item.confidence) === "high"
                                ? "High"
                                : classifyConfidence(item.confidence) === "medium"
                                  ? "Med"
                                  : "Low"}
                            </Text>
                          </View>
                          <Badge
                            variant="ai"
                            accessibilityLabel="AI estimated nutrition"
                            icon={<Ionicons name="sparkles-outline" size={10} color="#8b5cf6" />}
                          >
                            AI estimate
                          </Badge>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                          onPress={() => removeItem(i)}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: Spacing.sm }}>
                        {numField("kcal", item.calories, (n) => updateItem(i, { calories: n }), `${item.name} calories`)}
                        {numField("P (g)", item.protein, (n) => updateItem(i, { protein: n }), `${item.name} protein`)}
                        {numField("C (g)", item.carbs, (n) => updateItem(i, { carbs: n }), `${item.name} carbs`)}
                        {numField("F (g)", item.fat, (n) => updateItem(i, { fat: n }), `${item.name} fat`)}
                      </View>
                      {low && (
                        <Text
                          accessibilityRole="alert"
                          style={{ fontSize: 11, color: "#B45309", marginTop: 6 }}
                        >
                          Low confidence — please verify portion and macros before logging.
                        </Text>
                      )}
                    </View>
                  );
                })}
                <View
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: Radius.md,
                    padding: Spacing.md,
                    marginTop: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Logging to <Text style={{ color: colors.text, fontWeight: "700" }}>{activeSlot}</Text>. Total: {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
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
                  accessibilityLabel="Log all items"
                  onPress={handleLogAll}
                  disabled={items.length === 0}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: items.length === 0 ? colors.cardBorder : Accent.primary,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    {hasLowConfidence ? "Log anyway" : "Log all"}
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
