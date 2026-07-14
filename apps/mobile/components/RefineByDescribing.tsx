/**
 * RefineByDescribing (ENG-974) — mobile "refine by describing" correction input.
 *
 * Rendered inside the REVIEW stage of the photo + voice log sheets, below the
 * items, once an estimate exists. The user types a calm free-text correction
 * ("that was a large bowl, no rice, add a fried egg") and taps submit; the
 * component POSTs to `/api/nutrition/refine-log`, which re-estimates the whole
 * result server-side (the model call is server-side ONLY — never from here) and
 * returns the corrected result in the SAME schema. Conversational: each refine
 * operates on the CURRENT result (the host passes the latest items back in).
 *
 * Trust posture (CLAUDE.md): the re-estimate obeys the same validators as the
 * first analyse — a vague correction can only widen a range / drop to low
 * confidence, never fabricate a tight number. This component just handles the
 * input, the fetch, and reporting the corrected result up to the host.
 *
 * Flag-gated by `log_refine_describe_v1` (default-on; off → the host renders
 * without this row). Extracted as its own file so the pinned host sheets stay
 * near net-neutral (screen-budget).
 *
 * Mirrors `src/app/components/suppr/refine-by-describing.tsx` (web).
 */
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { ArrowUp, Sparkles } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  REFINE_MAX_ROUNDS,
  REFINE_TEXT_MAX_CHARS,
  type RefineLogSource,
  type RefineVoiceItem,
} from "@suppr/nutrition-core/refineLog";
import type { PhotoLogItemRanged } from "@suppr/nutrition-core/photoLogRanges";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
  border: string;
  primaryForeground: string;
};

/** Discriminated payload the host passes so the component can send the CURRENT
 *  result back to the route (conversational — refines the latest, not the
 *  original) and hand the corrected result back up. */
export type RefinePhotoContext = {
  source: "photo";
  items: PhotoLogItemRanged[];
  notes?: string | null;
  onRefined: (next: { items: PhotoLogItemRanged[]; notes?: string | null }) => void;
};

export type RefineVoiceContext = {
  source: "voice";
  items: RefineVoiceItem[];
  transcript?: string | null;
  onRefined: (next: { items: RefineVoiceItem[] }) => void;
};

export type RefineByDescribingProps = (RefinePhotoContext | RefineVoiceContext) & {
  /** Bearer token for the API call. */
  accessToken?: string | null;
  /** Base URL — mobile reads this from `expo-constants`. */
  apiBase: string;
  /** 1-indexed refine round for THIS result (host owns the counter). */
  round: number;
  /** Called after a successful refine so the host can bump its round counter. */
  onRoundComplete: () => void;
  accent: { primary: string };
  colors: Theme;
};

type Stage = "idle" | "submitting" | "error";

const PLACEHOLDER = "Add a detail — 'large portion', 'no rice', 'add a fried egg'";

export default function RefineByDescribing(props: RefineByDescribingProps) {
  const { accessToken, apiBase, round, onRoundComplete, accent, colors } = props;
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const atRoundLimit = round > REFINE_MAX_ROUNDS;
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && stage !== "submitting" && !atRoundLimit;

  const submit = useCallback(async () => {
    const value = text.trim();
    if (!value || stage === "submitting" || atRoundLimit) return;
    if (!apiBase) {
      setErrorMsg("Couldn't reach the server. Please try again in a moment.");
      setStage("error");
      return;
    }
    setStage("submitting");
    setErrorMsg(null);
    // Fire the funnel on SUBMIT (before the response) — text length only, never
    // the refinement text itself (could be PII-adjacent).
    track(AnalyticsEvents.ai_log_refine_submitted, {
      source: props.source as RefineLogSource,
      round,
      textLength: value.length,
    });

    const requestBody =
      props.source === "photo"
        ? {
            source: "photo" as const,
            refinementText: value,
            round,
            items: props.items,
            notes: props.notes ?? null,
          }
        : {
            source: "voice" as const,
            refinementText: value,
            round,
            items: props.items,
            transcript: props.transcript ?? null,
          };

    try {
      const resp = await fetch(`${apiBase}/api/nutrition/refine-log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });
      const data = await resp.json().catch(() => null);
      if (!data) {
        setErrorMsg("The server's reply was unreadable. Please try again.");
        setStage("error");
        return;
      }
      if (!resp.ok || data.ok === false) {
        setErrorMsg(
          typeof data.message === "string"
            ? data.message
            : "Couldn't apply that correction. Try rephrasing it.",
        );
        setStage("error");
        return;
      }
      if (props.source === "photo") {
        if (!Array.isArray(data.items) || data.items.length === 0) {
          setErrorMsg("That correction left nothing on the plate. Add an item or start over.");
          setStage("error");
          return;
        }
        props.onRefined({
          items: data.items as PhotoLogItemRanged[],
          notes: typeof data.notes === "string" ? data.notes : null,
        });
      } else {
        if (!Array.isArray(data.items) || data.items.length === 0) {
          setErrorMsg("That correction left no foods to log. Add an item or start over.");
          setStage("error");
          return;
        }
        props.onRefined({ items: data.items as RefineVoiceItem[] });
      }
      setText("");
      setStage("idle");
      onRoundComplete();
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
      setStage("error");
    }
  }, [text, stage, atRoundLimit, apiBase, accessToken, round, onRoundComplete, props]);

  if (atRoundLimit) {
    return (
      <View style={{ marginTop: Spacing.sm }}>
        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
          {"That's plenty of refining for one estimate — log it or start over."}
        </Text>
      </View>
    );
  }

  const submitting = stage === "submitting";

  return (
    <View style={{ marginTop: Spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs }}>
        <Sparkles size={IconSize.sm} color={accent.primary} strokeWidth={2.25} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Refine by describing
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm }}>
        <TextInput
          accessibilityLabel="Add a detail to refine the estimate"
          placeholder={PLACEHOLDER}
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          editable={!submitting}
          maxLength={REFINE_TEXT_MAX_CHARS}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
          style={{
            flex: 1,
            backgroundColor: colors.inputBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
            color: colors.text,
            minHeight: 44,
            maxHeight: 96,
            opacity: submitting ? 0.6 : 1,
          }}
        />
        <PressableScale
          haptic="confirm"
          accessibilityRole="button"
          accessibilityLabel="Apply this correction"
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          onPress={submit}
          disabled={!canSubmit}
          style={{
            width: 44,
            height: 44,
            borderRadius: Radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canSubmit ? accent.primary : colors.cardBorder,
          }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <ArrowUp size={IconSize.xl} color={colors.primaryForeground} strokeWidth={2.5} />
          )}
        </PressableScale>
      </View>
      {stage === "error" && (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 11, color: Accent.destructive, marginTop: Spacing.xs }}
        >
          {errorMsg ?? "Something went wrong. Try again."}
        </Text>
      )}
      {!submitting && stage !== "error" && (
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.xs }}>
          {"We'll re-estimate the whole meal. Vague changes stay estimated — we won't invent exact numbers."}
        </Text>
      )}
      {submitting && (
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}>
          Re-estimating…
        </Text>
      )}
    </View>
  );
}
