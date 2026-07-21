"use client";

/**
 * First-class nutrition-label logging flow (ENG-1336).
 *
 * Reuses `/api/nutrition/scan-label` for label-specific vision parsing, then
 * presents the extracted per-serving macros as editable fields before a single
 * journal commit. Mirrors `apps/mobile/components/LabelLogSheet.tsx`.
 */

import { useEffect, useRef, useState } from "react";
import { Camera, Info, ScanLine } from "lucide-react";

import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import {
  confirmedLabelLogItem,
  labelScanResultToReview,
  type LabelLogItem,
  type LabelLogReview,
  type LabelLogReviewFields,
} from "../../../lib/nutrition/labelLogging";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SupprButton } from "./suppr-button";

type Stage = "capture" | "reading" | "review";

export type LabelLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlot: string;
  onCommit: (item: LabelLogItem) => void | Promise<void>;
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

function ReviewField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        type="number"
        min="0"
        step="0.1"
      />
    </div>
  );
}

export function LabelLogDialog({
  open,
  onOpenChange,
  activeSlot,
  onCommit,
}: LabelLogDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [review, setReview] = useState<LabelLogReview | null>(null);
  const [fields, setFields] = useState<LabelLogReviewFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      requestRef.current?.abort();
      requestRef.current = null;
      setStage("capture");
      setReview(null);
      setFields(EMPTY_FIELDS);
      setError(null);
      setSaving(false);
      return undefined;
    }
    try {
      track(AnalyticsEvents.nutrition_label_log_started, { platform: "web" });
    } catch {
      /* analytics must never block capture */
    }
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [open]);

  const updateField = (key: keyof LabelLogReviewFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const readLabel = async (file: File) => {
    setStage("reading");
    setError(null);
    const form = new FormData();
    form.append("image", file);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch("/api/nutrition/scan-label", {
        method: "POST",
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
          message || "Couldn't read the label. Try a sharper, well-lit photo of the nutrition panel.",
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
          platform: "web",
          confidence: parsed.confidence,
          implausible: parsed.implausible,
        });
      } catch {
        /* analytics must never block review */
      }
    } catch (cause) {
      if (requestRef.current !== controller) return;
      setStage("capture");
      setError(
        cause instanceof DOMException && cause.name === "AbortError"
          ? "Reading the label took too long. Try again with a closer photo."
          : cause instanceof Error
            ? cause.message
            : "Couldn't reach the label scanner. Check your connection and try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
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
          platform: "web",
          confidence: item.confidence,
          implausible: item.implausible,
        });
      } catch {
        /* analytics must never block commit */
      }
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="label-log-dialog" className="max-w-md">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="image/*"
          capture="environment"
          data-testid="label-log-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readLabel(file);
          }}
        />

        <DialogHeader>
          <DialogTitle>{stage === "review" ? "Check the label" : "Scan a nutrition label"}</DialogTitle>
          <DialogDescription>
            {stage === "review"
              ? `Confirm the per-serving values before adding this food to ${activeSlot}.`
              : "Line up the full nutrition panel in a clear, well-lit photo."}
          </DialogDescription>
        </DialogHeader>

        {stage === "capture" ? (
          <div className="grid gap-4 py-4 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-primary-solid">
              <ScanLine className="size-6" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">
              Sloe reads only the printed values. You&apos;ll review them before anything is logged.
            </p>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <SupprButton
              variant="primary"
              data-testid="label-log-capture"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              Capture label
            </SupprButton>
          </div>
        ) : null}

        {stage === "reading" ? (
          <div className="grid gap-4 py-8 text-center" aria-live="polite">
            <ScanLine className="mx-auto size-8 animate-pulse text-primary-solid" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Reading the values…</p>
              <p className="mt-2 text-sm text-muted-foreground">This can take a few seconds.</p>
            </div>
          </div>
        ) : null}

        {stage === "review" && review ? (
          <>
            <div className="grid gap-4 py-2">
              <div
                className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-solid"
                role={review.implausible || review.confidence === "low" ? "alert" : "status"}
              >
                <Info className="mt-1 size-4 shrink-0" aria-hidden />
                <span>{warning}</span>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="label-log-name">Food name</Label>
                <Input
                  id="label-log-name"
                  value={fields.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Name this food"
                  autoFocus
                />
              </div>
              <ReviewField
                id="label-log-serving"
                label="Serving size (g)"
                value={fields.servingSizeG}
                onChange={(value) => updateField("servingSizeG", value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <ReviewField id="label-log-calories" label="Calories" value={fields.calories} onChange={(value) => updateField("calories", value)} />
                <ReviewField id="label-log-protein" label="Protein (g)" value={fields.protein} onChange={(value) => updateField("protein", value)} />
                <ReviewField id="label-log-carbs" label="Carbs (g)" value={fields.carbs} onChange={(value) => updateField("carbs", value)} />
                <ReviewField id="label-log-fat" label="Fat (g)" value={fields.fat} onChange={(value) => updateField("fat", value)} />
              </div>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <SupprButton
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                Scan again
              </SupprButton>
              <SupprButton
                variant="primary"
                loading={saving}
                data-testid="label-log-commit"
                onClick={() => void commit()}
              >
                Log to {activeSlot}
              </SupprButton>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default LabelLogDialog;
