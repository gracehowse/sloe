/**
 * VoiceLogSheet (Batch 5.13) — mobile Pro-tier voice logging sheet.
 *
 * Mirrors `src/app/components/suppr/voice-log-dialog.tsx` behaviour:
 *  1. Press-and-hold mic (native STT via expo-speech-recognition when
 *     available; typed fallback otherwise) to populate the transcript.
 *  2. Submit transcript to `/api/nutrition/voice-log`.
 *  3. Review list with per-item confidence badge + inline macro edit.
 *  4. Tap "Log all" → caller commits each item as a `JournalMeal`.
 *
 * Shares `sanitiseAiItems`, `classifyConfidence`, `aggregateTotals`,
 * `averageConfidence` with web via `src/lib/nutrition/aiLogging.ts`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Mic, X } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import {
  averageConfidence,
  isLowConfidence,
  sanitiseAiItems,
  type AiLoggedItem,
} from "../../../src/lib/nutrition/aiLogging";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import AiLogReviewItem from "./AiLogReviewItem";
import AiLogReviewSummary from "./AiLogReviewSummary";

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

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The meal slot committed items belong to (Breakfast / Lunch / etc). */
  activeSlot: string;
  /** Bearer token for calling `/api/nutrition/voice-log`. */
  accessToken?: string | null;
  /** Base URL for the API — mobile reads this from `expo-constants`. */
  apiBase: string;
  /** Commit reviewed items — parent turns them into `JournalMeal`s. */
  onCommit: (items: AiLoggedItem[]) => void;
  colors: Theme;
};

type Stage = "input" | "parsing" | "review" | "error";

export default function VoiceLogSheet({
  visible,
  onClose,
  activeSlot,
  accessToken,
  apiBase,
  onCommit,
  colors,
}: Props) {
  const [stage, setStage] = useState<Stage>("input");
  const [transcript, setTranscript] = useState("");
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const stopSpeechRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (visible) {
      setStage("input");
      setTranscript("");
      setItems([]);
      setErrorMsg(null);
      setIsRecording(false);
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. See plan doc §4.
      track(AnalyticsEvents.voice_log_started);
      track(AnalyticsEvents.ai_voice_log_started);
    } else {
      const stop = stopSpeechRef.current;
      if (stop) stop();
      stopSpeechRef.current = null;
    }
  }, [visible]);

  const beginRecording = useCallback(async () => {
    try {
      const { isSpeechAvailable, listenForSpeech } = await import("@/lib/voiceLog");
      if (!isSpeechAvailable()) {
        setErrorMsg(null); // typing fallback is already visible
        return;
      }
      setIsRecording(true);
      // listenForSpeech resolves when the user stops or the timeout hits.
      // We capture the resolver via a cancel ref so Press-out stops it.
      let cancelled = false;
      stopSpeechRef.current = () => {
        cancelled = true;
      };
      const result = await listenForSpeech({ maxDurationMs: 10_000 });
      if (!cancelled) setTranscript(result);
    } catch {
      // Native module missing / permission denied — silently allow typing.
    } finally {
      setIsRecording(false);
      stopSpeechRef.current = null;
    }
  }, []);

  const endRecording = useCallback(() => {
    const stop = stopSpeechRef.current;
    if (stop) stop();
    stopSpeechRef.current = null;
    setIsRecording(false);
  }, []);

  const submitTranscript = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setStage("parsing");
      setErrorMsg(null);
      try {
        const resp = await fetch(`${apiBase}/api/nutrition/voice-log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ transcript: text.trim() }),
        });
        const data = await resp.json();
        if (resp.status === 403 && data?.error === "upgrade_required") {
          setErrorMsg(
            typeof data.message === "string"
              ? data.message
              : "Voice logging is a Pro feature. Upgrade to use it.",
          );
          setStage("error");
          return;
        }
        if (!data?.ok || !Array.isArray(data.items)) {
          setErrorMsg(
            typeof data?.message === "string"
              ? data.message
              : "Could not parse your description. Try again.",
          );
          setStage("error");
          return;
        }
        const cleaned = sanitiseAiItems(data.items, "voice");
        if (cleaned.length === 0) {
          setErrorMsg("No food items could be parsed. Try describing portions too.");
          setStage("error");
          return;
        }
        setItems(cleaned);
        setStage("review");
      } catch {
        setErrorMsg("Voice logging failed. Check your connection and try again.");
        setStage("error");
      }
    },
    [accessToken, apiBase],
  );

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
    // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. See plan doc §4.
    const committedPayload = {
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    };
    track(AnalyticsEvents.voice_log_committed, committedPayload);
    track(AnalyticsEvents.ai_voice_log_committed, committedPayload);
    onClose();
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
              maxHeight: "85%",
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
                <Mic size={IconSize.xl} color={Accent.success} strokeWidth={2.25} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Voice log</Text>
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
                ? `Review the ${items.length} item${items.length === 1 ? "" : "s"} we parsed. Edit or remove before logging.`
                : "Describe what you ate — we'll estimate macros using verified nutrition data."}
            </Text>

            {stage === "input" && (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Record voice log"
                    accessibilityState={{ selected: isRecording }}
                    onPressIn={beginRecording}
                    onPressOut={endRecording}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isRecording ? Accent.success : Accent.success + "22",
                      borderWidth: 1,
                      borderColor: Accent.success + "55",
                    }}
                  >
                    <Mic
                      size={IconSize.hero}
                      color={isRecording ? "#fff" : Accent.success}
                      strokeWidth={2.25}
                    />
                  </Pressable>
                  <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>
                    {isRecording
                      ? "Listening… release to stop."
                      : "Press and hold to record, or type below."}
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel="Describe what you ate"
                  placeholder={'e.g. "2 scrambled eggs and toast with butter"'}
                  placeholderTextColor={colors.textTertiary}
                  value={transcript}
                  onChangeText={setTranscript}
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: Radius.md,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.md,
                    fontSize: 15,
                    color: colors.text,
                    minHeight: 48,
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => submitTranscript(transcript)}
                />
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>
                  AI estimates. Text is processed on our servers. Low-confidence items
                  will be flagged for you to verify before logging.
                </Text>
              </View>
            )}

            {stage === "parsing" && (
              <View style={{ alignItems: "center", paddingVertical: Spacing.xl, gap: 10 }}>
                <ActivityIndicator size="small" color={Accent.primary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Parsing your description…</Text>
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
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {items.map((item, i) => (
                  <AiLogReviewItem
                    key={`${item.name}-${i}`}
                    item={item}
                    index={i}
                    onChange={(patch) => updateItem(i, patch)}
                    onRemove={() => removeItem(i)}
                    colors={colors}
                  />
                ))}
                <AiLogReviewSummary
                  items={items}
                  slotLabel={activeSlot}
                  colors={colors}
                />
              </ScrollView>
            )}

            {/* Action row */}
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
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
              {stage === "input" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Parse description"
                  onPress={() => submitTranscript(transcript)}
                  disabled={!transcript.trim()}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: transcript.trim() ? Accent.primary : colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Parse</Text>
                </Pressable>
              )}
              {stage === "error" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  onPress={() => setStage("input")}
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
