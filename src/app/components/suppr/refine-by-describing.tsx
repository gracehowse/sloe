"use client";

/**
 * RefineByDescribing (ENG-974) — web "refine by describing" correction input.
 *
 * Rendered inside the REVIEW stage of the photo + voice log dialogs, below the
 * items, once an estimate exists. The user types a calm free-text correction
 * ("that was a large bowl, no rice, add a fried egg") and submits; the component
 * POSTs to `/api/nutrition/refine-log`, which re-estimates the whole result
 * server-side (the model call is server-side ONLY) and returns the corrected
 * result in the SAME schema. Conversational: each refine operates on the CURRENT
 * result (the host passes the latest items back in).
 *
 * Trust posture (CLAUDE.md): the re-estimate obeys the same validators as the
 * first analyse — a vague correction can only widen a range / drop to low
 * confidence, never fabricate a tight number.
 *
 * Flag-gated by `log_refine_describe_v1` (default-on; off → the host renders
 * without this row). Mirrors `apps/mobile/components/RefineByDescribing.tsx`.
 */

import { useCallback, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import {
  REFINE_MAX_ROUNDS,
  REFINE_TEXT_MAX_CHARS,
  type RefineVoiceItem,
} from "../../../lib/nutrition/refineLog";
import type { PhotoLogItemRanged } from "../../../lib/nutrition/photoLogRanges";

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
  /** 1-indexed refine round for THIS result (host owns the counter). */
  round: number;
  /** Called after a successful refine so the host can bump its round counter. */
  onRoundComplete: () => void;
};

type Stage = "idle" | "submitting" | "error";

const PLACEHOLDER = "Add a detail — 'large portion', 'no rice', 'add a fried egg'";

export function RefineByDescribing(props: RefineByDescribingProps) {
  const { round, onRoundComplete } = props;
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const atRoundLimit = round > REFINE_MAX_ROUNDS;
  const submitting = stage === "submitting";
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !submitting && !atRoundLimit;

  const submit = useCallback(async () => {
    const value = text.trim();
    if (!value || submitting || atRoundLimit) return;
    setStage("submitting");
    setError(null);
    // Fire the funnel on SUBMIT — text length only, never the text itself.
    track(AnalyticsEvents.ai_log_refine_submitted, {
      source: props.source,
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
      const resp = await fetch("/api/nutrition/refine-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await resp.json().catch(() => null);
      if (!data) {
        setError("The server's reply was unreadable. Please try again.");
        setStage("error");
        return;
      }
      if (!resp.ok || data.ok === false) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Couldn't apply that correction. Try rephrasing it.",
        );
        setStage("error");
        return;
      }
      if (props.source === "photo") {
        if (!Array.isArray(data.items) || data.items.length === 0) {
          setError("That correction left nothing on the plate. Add an item or start over.");
          setStage("error");
          return;
        }
        props.onRefined({
          items: data.items as PhotoLogItemRanged[],
          notes: typeof data.notes === "string" ? data.notes : null,
        });
      } else {
        if (!Array.isArray(data.items) || data.items.length === 0) {
          setError("That correction left no foods to log. Add an item or start over.");
          setStage("error");
          return;
        }
        props.onRefined({ items: data.items as RefineVoiceItem[] });
      }
      setText("");
      setStage("idle");
      onRoundComplete();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStage("error");
    }
  }, [text, submitting, atRoundLimit, round, onRoundComplete, props]);

  if (atRoundLimit) {
    return (
      <p className="text-[11px] text-muted-foreground" data-testid="refine-round-limit">
        That's plenty of refining for one estimate — log it or start over.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5" data-testid="refine-by-describing">
      <div className="flex items-center gap-1.5">
        <Icons.sparkles
          className="size-3.5"
          style={{ color: "var(--accent-win)" }}
          aria-hidden
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Refine by describing
        </span>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Add a detail to refine the estimate"
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
          maxLength={REFINE_TEXT_MAX_CHARS}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSubmit) {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-h-11 flex-1 text-sm"
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          aria-label="Apply this correction"
          aria-busy={submitting}
          className="shrink-0"
        >
          {submitting ? (
            <span
              className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden
            />
          ) : (
            <Icons.arrowRight className="size-4" aria-hidden />
          )}
        </Button>
      </div>
      {stage === "error" && (
        <p role="alert" className="text-[11px] text-destructive">
          {error ?? "Something went wrong. Try again."}
        </p>
      )}
      {submitting ? (
        <p className="text-[11px] text-muted-foreground">Re-estimating…</p>
      ) : (
        stage !== "error" && (
          <p className="text-[11px] text-muted-foreground">
            We&apos;ll re-estimate the whole meal. Vague changes stay estimated — we won&apos;t
            invent exact numbers.
          </p>
        )
      )}
    </div>
  );
}

export default RefineByDescribing;
