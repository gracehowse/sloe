/**
 * First-class nutrition-label logging flow (ENG-1336).
 *
 * Captures a label with the native camera, reuses `/api/nutrition/scan-label`,
 * and requires an editable per-serving review before journal commit. Mirrors
 * `src/app/components/suppr/label-log-dialog.tsx`.
 */

import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScanLine, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  confirmedLabelLogItem,
  labelScanResultToReview,
  type LabelLogItem,
  type LabelLogReview,
  type LabelLogReviewFields,
} from "@suppr/nutrition-core/labelLogging";
import {
  LabelLogReview as LabelLogReviewForm,
  type LabelLogReviewTheme,
} from "./label-log/LabelLogReview";

type Stage = "capture" | "reading" | "review";

type Theme = LabelLogReviewTheme;

type Props = {
  visible: boolean;
  onClose: () => void;
  activeSlot: string;
  accessToken?: string | null;
  apiBase: string;
  onCommit: (item: LabelLogItem) => void | Promise<void>;
  colors: Theme;
};

const EMPTY_FIELDS: LabelLogReviewFields = {
  name: "",
  servingSizeG: "100",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

function displayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export default function LabelLogSheet({
  visible,
  onClose,
  activeSlot,
  accessToken,
  apiBase,
  onCommit,
  colors,
}: Props) {
  const accent = useAccent();
  const visibleRef = useRef(visible);
  const requestRef = useRef<AbortController | null>(null);
  visibleRef.current = visible;
  const [stage, setStage] = useState<Stage>("capture");
  const [review, setReview] = useState<LabelLogReview | null>(null);
  const [fields, setFields] = useState<LabelLogReviewFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      requestRef.current?.abort();
      requestRef.current = null;
      return undefined;
    }
    setStage("capture");
    setReview(null);
    setFields(EMPTY_FIELDS);
    setError(null);
    setSaving(false);
    try {
      track(AnalyticsEvents.nutrition_label_log_started, { platform: "ios" });
    } catch {
      /* analytics must never block capture */
    }
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [visible]);

  const updateField = (key: keyof LabelLogReviewFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const capture = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera access is required to scan a nutrition label.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri || !visibleRef.current) return;
      if (!apiBase) {
        setError("Couldn't reach the server. Try again in a moment.");
        return;
      }

      setStage("reading");
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? "nutrition-label.jpg",
      } as never);
      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 55_000);
      try {
        const response = await fetch(`${apiBase}/api/nutrition/scan-label`, {
          method: "POST",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: form,
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as unknown;
        const parsed = labelScanResultToReview(payload);
        if (!response.ok || !parsed) {
          const message =
            payload && typeof payload === "object" && "message" in payload
              ? String((payload as { message?: unknown }).message ?? "")
              : "";
          throw new Error(
            message || "Couldn't read the label. Try a sharper, well-lit photo.",
          );
        }
        setReview(parsed);
        setFields({
          name: parsed.name,
          servingSizeG: displayNumber(parsed.servingSizeG),
          calories: displayNumber(parsed.calories),
          protein: displayNumber(parsed.protein),
          carbs: displayNumber(parsed.carbs),
          fat: displayNumber(parsed.fat),
        });
        setStage("review");
        try {
          track(AnalyticsEvents.nutrition_label_log_parsed, {
            platform: "ios",
            confidence: parsed.confidence,
            implausible: parsed.implausible,
          });
        } catch {
          /* analytics must never block review */
        }
      } finally {
        clearTimeout(timeout);
        if (requestRef.current === controller) requestRef.current = null;
      }
    } catch (cause) {
      if (!visibleRef.current) return;
      setStage("capture");
      setError(
        cause instanceof Error && cause.name === "AbortError"
          ? "Reading the label took too long. Try again with a closer photo."
          : cause instanceof Error
            ? cause.message
            : "Couldn't reach the label scanner. Check your connection and try again.",
      );
    }
  };

  const commit = async () => {
    if (!review || saving) return;
    const item = confirmedLabelLogItem(fields, review);
    if (!item) {
      setError("Add a food name, serving size, and valid calories and macros before logging.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCommit(item);
      try {
        track(AnalyticsEvents.nutrition_label_log_committed, {
          platform: "ios",
          confidence: item.confidence,
          implausible: item.implausible,
        });
      } catch {
        /* analytics must never block commit */
      }
      onClose();
    } catch {
      setError("Couldn't log this food. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const warning = review?.implausible
    ? "These values look unusual. Check every number against the label before logging."
    : review?.confidence === "low"
      ? "The label was hard to read. Check every number before logging."
      : "Read from the label — tap any value to correct it before logging.";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modal}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close nutrition label scanner"
          onPress={onClose}
          style={({ pressed }) => [styles.backdropHit, { opacity: pressed ? 0.95 : 1 }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          testID="label-log-sheet"
        >
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>
                {stage === "review" ? "Check the label" : "Scan a nutrition label"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {stage === "review"
                  ? `Confirm the per-serving values before adding this food to ${activeSlot}.`
                  : "Line up the full nutrition panel in a clear, well-lit photo."}
              </Text>
            </View>
            <PressableScale
              haptic="selection"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <X size={IconSize.xl} color={colors.textSecondary} />
            </PressableScale>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {stage === "capture" ? (
              <View style={styles.centered}>
                <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                  <ScanLine size={IconSize.hero} color={accent.primarySolid} />
                </View>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  Sloe reads only the printed values. You&apos;ll review them before anything is logged.
                </Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <SupprButton
                  variant="primary"
                  label="Capture label"
                  onPress={() => void capture()}
                  testID="label-log-capture"
                  style={styles.fullWidth}
                />
              </View>
            ) : null}

            {stage === "reading" ? (
              <View style={styles.centered} accessibilityLiveRegion="polite">
                <ScanLine size={IconSize.hero} color={accent.primarySolid} />
                <Text style={[styles.heading, { color: colors.text }]}>Reading the values…</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>This can take a few seconds.</Text>
              </View>
            ) : null}

            {stage === "review" && review ? (
              <LabelLogReviewForm
                fields={fields}
                warning={warning}
                error={error}
                saving={saving}
                activeSlot={activeSlot}
                colors={colors}
                onUpdate={updateField}
                onCapture={() => void capture()}
                onCommit={() => void commit()}
              />
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" },
  backdropHit: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, borderWidth: StyleSheet.hairlineWidth, maxHeight: "90%", padding: Spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  headerCopy: { flex: 1, gap: Spacing.xs },
  title: { ...Type.navTitle },
  subtitle: { ...Type.bodyMuted },
  closeButton: { width: Spacing.xxl, height: Spacing.xxl, alignItems: "center", justifyContent: "center", borderRadius: Radius.full },
  content: { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  centered: { alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.xxl },
  iconCircle: { width: 64, height: 64, borderRadius: Radius.full, alignItems: "center", justifyContent: "center" },
  heading: { ...Type.headline, textAlign: "center" },
  body: { ...Type.bodyMuted, textAlign: "center" },
  error: { ...Type.captionSmall, color: Accent.destructive, textAlign: "center" },
  fullWidth: { width: "100%" },
});
