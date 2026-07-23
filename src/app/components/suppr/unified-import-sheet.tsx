"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { classifyImport } from "../../../lib/recipe-import/classifyImport";
import {
  IMPORT_INPUT_INTRO,
  IMPORT_INPUT_PLACEHOLDER,
  IMPORT_INPUT_SAMPLES,
} from "../../../lib/recipe-import/importInputSamples";
import { routeImport } from "../../../lib/recipe-import/importRoutingWeb";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { ImportDetectedChip } from "./import-detected-chip";
import { SupprButton } from "./suppr-button";

/**
 * UnifiedImportSheet (web, ENG-1225 #3) — WEB twin of
 * `apps/mobile/components/import/UnifiedImportSheet.tsx`. The viral import
 * wedge's single front door: one paste field that accepts ANYTHING (a
 * TikTok/IG/YouTube link, a recipe URL, a meal plan, an MFP/Cronometer CSV, or
 * pasted recipe text), shows a live "Detected: {label}" chip, and routes to the
 * right existing flow on Import. Replaces having to know WHICH import surface to
 * use. The host gates it behind `sloe_v3_unified_import`; the legacy per-surface
 * entries stay alive in the flag-off path.
 */
export interface UnifiedImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Storybook / test harness — prefills the field when the sheet opens. */
  initialText?: string;
}

export function UnifiedImportSheet({ open, onOpenChange, initialText }: UnifiedImportSheetProps) {
  const router = useRouter();
  const v3 = isFeatureEnabled("import_input_v3_polish");
  const [text, setText] = React.useState("");
  const [hint, setHint] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setText(initialText ?? "");
      setHint(null);
    }
  }, [open, initialText]);

  const classification = classifyImport(text);
  const canImport = classification.kind !== "empty";
  const ctaLabel = canImport
    ? `Import ${classification.label.toLowerCase()}`
    : "Paste something to import";

  const onImport = () => {
    const result = routeImport(classification, text, { push: (t) => router.push(t) });
    if (result.routed) {
      onOpenChange(false);
    } else {
      setHint(result.hint ?? null);
    }
  };

  const onChooseFile = () => fileInputRef.current?.click();

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv") || file.type.includes("csv")) {
      try {
        const content = await file.text();
        setText(content.trim() ? content : file.name);
      } catch {
        setText(file.name);
      }
    } else {
      setText(file.name);
    }
    if (hint) setHint(null);
  };

  const legacyDescription =
    "Paste a TikTok, Instagram or YouTube link, a recipe URL, a meal plan, an MFP export, or recipe text — we'll figure out what it is.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm" data-testid="unified-import-sheet">
        <DialogHeader>
          <DialogTitle className="text-foreground">Import</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {v3 ? IMPORT_INPUT_INTRO : legacyDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (hint) setHint(null);
            }}
            rows={v3 ? 1 : 4}
            autoFocus
            data-testid="unified-import-input"
            aria-label="Paste a link, plan, export, or recipe"
            placeholder={v3 ? IMPORT_INPUT_PLACEHOLDER : "Paste here…"}
            className={[
              "w-full resize-none rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary",
              v3 ? "min-h-10" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
          {text.trim().length > 0 ? (
            <button
              type="button"
              data-testid="unified-import-clear"
              aria-label="Clear pasted text"
              onClick={() => {
                setText("");
                if (hint) setHint(null);
              }}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="min-h-[28px]">
          {canImport ? (
            <ImportDetectedChip input={text} />
          ) : v3 ? (
            <div data-testid="unified-import-samples">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2 px-0.5">
                Or try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {IMPORT_INPUT_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    data-testid={`unified-import-sample-${sample.id}`}
                    onClick={() => {
                      setText(sample.value);
                      if (hint) setHint(null);
                    }}
                    className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {v3 ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,image/*"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={onFileChange}
            />
            <button
              type="button"
              data-testid="unified-import-choose-file"
              onClick={onChooseFile}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <FolderOpen className="size-4" aria-hidden />
              Choose a file (.csv, photo)
            </button>
          </>
        ) : null}

        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        <SupprButton
          variant="primary"
          className="w-full"
          disabled={!canImport}
          onClick={onImport}
          data-testid="unified-import-cta"
        >
          {ctaLabel}
        </SupprButton>
      </DialogContent>
    </Dialog>
  );
}

export default UnifiedImportSheet;
