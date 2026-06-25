"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { classifyImport } from "../../../lib/recipe-import/classifyImport";
import { routeImport } from "../../../lib/recipe-import/importRoutingWeb";
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
}

export function UnifiedImportSheet({ open, onOpenChange }: UnifiedImportSheetProps) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [hint, setHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText("");
      setHint(null);
    }
  }, [open]);

  const classification = classifyImport(text);
  const canImport = classification.kind !== "empty";
  // v3 prototype detection-driven CTA (ENG-1247 A13): the label names what
  // you're about to import ("Import recipe link") and the empty state guides
  // ("Paste something to import"), instead of a flat "Import". Mirrors the
  // prototype `det ? 'Import '+det.label.toLowerCase() : 'Paste something to import'`.
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm" data-testid="unified-import-sheet">
        <DialogHeader>
          <DialogTitle className="text-foreground">Import</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste a TikTok, Instagram or YouTube link, a recipe URL, a meal plan, an MFP export,
            or recipe text — we&apos;ll figure out what it is.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (hint) setHint(null);
          }}
          rows={4}
          autoFocus
          data-testid="unified-import-input"
          aria-label="Paste a link, plan, export, or recipe"
          placeholder="Paste here…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="min-h-[28px]">
          <ImportDetectedChip input={text} />
        </div>
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
