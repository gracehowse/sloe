"use client";

/**
 * VoiceLogDialog (Batch 5.13) — Pro-tier voice logging.
 *
 * Flow:
 *  1. Dialog opens on "Voice" entry point (press-and-hold mic OR type fallback).
 *  2. MediaRecorder captures audio when supported; otherwise the user types.
 *     (Transcription of the recording is out of scope for this release — the
 *     Pro feature shipped today uses the mobile OS STT on mobile and the
 *     browser Web Speech API / typed fallback on web. The recording UX
 *     lives here so we have a consistent press-to-record control to
 *     populate when Whisper-style upload is enabled next release.)
 *  3. Transcript is POSTed to `/api/nutrition/voice-log` which runs it
 *     through the verified-nutrition pipeline.
 *  4. Review list: each parsed item is editable (quantity/name/macros)
 *     and flagged as low / medium / high confidence via `classifyConfidence`.
 *  5. "Log all" commits each item as a separate `LoggedMeal`. Items below
 *     0.5 confidence require explicit confirmation — they can be logged but
 *     never auto-logged.
 *
 * Shared with mobile via `src/lib/nutrition/aiLogging.ts` for sanitisation,
 * confidence classification, and aggregation. The UI shell differs but the
 * data contract, low-confidence gating, and analytics events match.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icons } from "../ui/icons";
import { ConfidenceDot } from "./confidence-dot";
import { Badge } from "./badge";
import {
  aggregateTotals,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  sanitiseAiItems,
  type AiLoggedItem,
} from "../../../lib/nutrition/aiLogging";
import { track } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";

export type VoiceLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The meal slot items will be logged to (e.g. "Breakfast"). */
  activeSlot: string;
  /** Commit the reviewed items — one LoggedMeal per item. Source = "voice". */
  onCommit: (items: AiLoggedItem[]) => void;
};

type Stage = "input" | "parsing" | "review" | "error";

export function VoiceLogDialog({
  open,
  onOpenChange,
  activeSlot,
  onCommit,
}: VoiceLogDialogProps) {
  const [stage, setStage] = useState<Stage>("input");
  const [transcript, setTranscript] = useState("");
  const [items, setItems] = useState<AiLoggedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (open) {
      setStage("input");
      setTranscript("");
      setItems([]);
      setError(null);
      setIsRecording(false);
      track(AnalyticsEvents.voice_log_started);
    }
  }, [open]);

  const mediaRecorderSupported =
    typeof window !== "undefined" &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !==
      "undefined" &&
    !!navigator?.mediaDevices?.getUserMedia;

  const webSpeechSupported =
    typeof window !== "undefined" &&
    !!((window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown })
      .webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition);

  /** Press-to-record: live transcription via Web Speech API when available. */
  const beginSpeechRecognition = useCallback(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => any })
        .webkitSpeechRecognition;
    if (!SR) return null;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text.trim());
    };
    recognition.onerror = () => {
      // Silent — user can still type.
    };
    recognition.start();
    return recognition;
  }, []);

  const handleRecordPressIn = useCallback(async () => {
    setError(null);
    if (webSpeechSupported) {
      setIsRecording(true);
      const rec = beginSpeechRecognition();
      if (rec) {
        recorderRef.current = {
          stop: () => {
            try {
              rec.stop();
            } catch {
              /* ignore */
            }
          },
        } as unknown as MediaRecorder;
      }
      return;
    }
    if (!mediaRecorderSupported) {
      setError("Voice capture isn't supported on this browser. Type instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setIsRecording(true);
    } catch {
      setError("Microphone permission is required to record. Type instead.");
    }
  }, [beginSpeechRecognition, mediaRecorderSupported, webSpeechSupported]);

  const handleRecordPressOut = useCallback(() => {
    setIsRecording(false);
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
  }, []);

  const submitTranscript = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setStage("parsing");
      setError(null);
      try {
        const resp = await fetch("/api/nutrition/voice-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text.trim() }),
        });
        const data = await resp.json();
        if (resp.status === 403 && data?.error === "upgrade_required") {
          setError(
            typeof data.message === "string"
              ? data.message
              : "Voice logging is a Pro feature. Upgrade to use it.",
          );
          setStage("error");
          return;
        }
        if (!data?.ok || !Array.isArray(data.items)) {
          setError(
            typeof data?.message === "string"
              ? data.message
              : "Could not parse your description. Try again or type more detail.",
          );
          setStage("error");
          return;
        }
        const cleaned = sanitiseAiItems(data.items, "voice");
        if (cleaned.length === 0) {
          setError("No food items could be parsed. Try describing the portions too.");
          setStage("error");
          return;
        }
        setItems(cleaned);
        setStage("review");
      } catch {
        setError("Voice logging failed. Check your connection and try again.");
        setStage("error");
      }
    },
    [],
  );

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
    track(AnalyticsEvents.voice_log_committed, {
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Icons.mic className="size-5 text-success" aria-hidden />
            Voice log
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {stage === "review"
              ? `Review the ${items.length} item${items.length === 1 ? "" : "s"} we parsed. Edit or remove before logging.`
              : "Describe what you ate — we'll estimate macros using verified nutrition data. You can edit each item before logging."}
          </DialogDescription>
        </DialogHeader>

        {stage === "input" && (
          <div className="grid gap-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={handleRecordPressIn}
                onPointerUp={handleRecordPressOut}
                onPointerLeave={handleRecordPressOut}
                onPointerCancel={handleRecordPressOut}
                aria-label="Record voice log"
                aria-pressed={isRecording}
                className={`size-12 inline-flex items-center justify-center rounded-full border ${
                  isRecording
                    ? "bg-success text-white border-success shadow-lg animate-pulse"
                    : "bg-success/10 text-success border-success/30 hover:bg-success/20"
                }`}
              >
                <Icons.mic className="size-5" />
              </button>
              <div className="text-xs text-muted-foreground">
                {isRecording
                  ? "Listening… release to stop."
                  : webSpeechSupported || mediaRecorderSupported
                    ? "Press and hold to record, or type below."
                    : "Voice capture not supported — type below."}
              </div>
            </div>
            <Input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={'e.g. "2 scrambled eggs and a slice of toast"'}
              onKeyDown={(e) => {
                if (e.key === "Enter" && transcript.trim()) {
                  submitTranscript(transcript);
                }
              }}
              aria-label="Describe what you ate"
            />
            <p className="text-[11px] text-muted-foreground">
              AI estimates. Text is processed on our servers via OpenAI. Low-confidence
              items will be flagged for you to verify before logging.
            </p>
          </div>
        )}

        {stage === "parsing" && (
          <div className="py-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden />
            Parsing your description…
          </div>
        )}

        {stage === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error ?? "Something went wrong. Please try again."}
          </div>
        )}

        {stage === "review" && (
          <div className="grid gap-2 py-2 max-h-[50vh] overflow-y-auto">
            {items.map((item, i) => {
              const level = classifyConfidence(item.confidence);
              const low = isLowConfidence(item);
              return (
                <div
                  key={`${item.name}-${i}`}
                  className={`rounded-lg border p-2.5 text-sm ${
                    low ? "border-amber-400/50 bg-amber-400/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        aria-label={`Item ${i + 1} name`}
                        className="h-8 text-sm font-medium"
                      />
                      {item.unit && (
                        <p className="text-[11px] text-muted-foreground mt-1">{item.unit}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <ConfidenceDot level={level} showLabel />
                      <Badge
                        variant="ai"
                        ariaLabel="AI estimated nutrition"
                        icon={<Icons.sparkles />}
                      >
                        AI estimate
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Icons.close className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                      <label key={key} className="grid gap-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {key === "calories" ? "kcal" : `${key.charAt(0).toUpperCase()}${key.slice(1)} (g)`}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={item[key]}
                          onChange={(e) => {
                            const n = Math.max(0, Number(e.target.value));
                            updateItem(i, { [key]: Number.isFinite(n) ? n : 0 });
                          }}
                          className="h-7 text-xs"
                          aria-label={`${item.name} ${key}`}
                        />
                      </label>
                    ))}
                  </div>
                  {low && (
                    <p role="alert" className="mt-1.5 text-[11px] text-amber-700">
                      Low confidence — please verify the portion and macros before logging.
                    </p>
                  )}
                </div>
              );
            })}
            <div className="mt-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              Logging to <span className="font-semibold text-foreground">{activeSlot}</span>.
              Total: {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
              {totals.fiber != null ? ` · Fi ${totals.fiber}g` : ""}
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === "input" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitTranscript(transcript)}
                disabled={!transcript.trim()}
              >
                Parse
              </Button>
            </>
          )}
          {stage === "error" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setStage("input")}>Try again</Button>
            </>
          )}
          {stage === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStage("input")}>
                Back
              </Button>
              <Button onClick={handleLogAll} disabled={items.length === 0}>
                {hasLowConfidence ? "Log anyway" : "Log all"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VoiceLogDialog;
