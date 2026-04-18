"use client";

/**
 * AiPaywallDialog (Batch 5.13) — factual Pro paywall shown when a free
 * user taps the Voice-log or AI-photo-log entry point.
 *
 * Copy rules (CLAUDE.md + product-lead):
 *  - Factual, not pushy. No countdowns. No "only X seats left".
 *  - State exactly which feature is gated and why.
 *  - Link to the pricing page — do not try to upsell anything else.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";

export type AiPaywallFeature = "voice_log" | "photo_log";

const FEATURE_COPY: Record<AiPaywallFeature, { title: string; body: string }> = {
  voice_log: {
    title: "Voice logging is a Pro feature",
    body: "Describe what you ate, and we'll estimate macros using our verified nutrition database. Voice logging is included with a Pro subscription.",
  },
  photo_log: {
    title: "AI photo logging is a Pro feature",
    body: "Snap a photo of your meal and we'll identify foods, estimate portions, and match against our verified nutrition database. AI photo logging is included with a Pro subscription.",
  },
};

export type AiPaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: AiPaywallFeature;
};

export function AiPaywallDialog({ open, onOpenChange, feature }: AiPaywallDialogProps) {
  const copy = FEATURE_COPY[feature];
  const from = feature === "voice_log" ? "voice_log" : "photo_log";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Icons.premium className="size-5 text-primary" aria-hidden />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <a
            href={`/pricing?from=${from}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Icons.sparkles className="size-4" aria-hidden /> See plans
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AiPaywallDialog;
