"use client";

import * as React from "react";
import { AlertTriangle, Copyright, HelpCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

/**
 * ReportRecipeDialog — per-recipe "Report an issue" sheet (ENG-1225 #19,
 * UGC-safety + the IP launch bundle ENG-857/858/859).
 *
 * Routing is honest — no report is silently dropped:
 *   - Copyright / "I own this" → the existing DMCA takedown form at `/dmca`,
 *     pre-filled with the recipe id (real flow → `dmca_takedowns` via
 *     `/api/dmca-takedown`).
 *   - Everything else → a pre-filled email to support (the real support
 *     channel; there is no general report table yet — see follow-up).
 *
 * Mirror target: `apps/mobile/app/recipe/[id].tsx` (mobile parity follow-up).
 */
const SUPPORT_EMAIL = "support@getsloe.com";

type ReportReason = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  kind: "dmca" | "email";
};

// Copy reviewed by legal-reviewer (ENG-1225 #19): a *recipe* (ingredients +
// method) isn't copyrightable — only its creative expression is — so the label
// avoids "I own this recipe"; and we "start a request", never promise a takedown.
const REASONS: ReportReason[] = [
  {
    key: "copyright",
    label: "Copyright — this is my content",
    hint: "Starts a copyright takedown request with our team.",
    icon: Copyright,
    kind: "dmca",
  },
  {
    key: "incorrect",
    label: "Incorrect nutrition or instructions",
    hint: "Wrong calories, steps, or ingredients.",
    icon: AlertTriangle,
    kind: "email",
  },
  {
    key: "unsafe",
    label: "Inappropriate or unsafe",
    hint: "Offensive content or an unsafe cooking method.",
    icon: ShieldAlert,
    kind: "email",
  },
  {
    key: "other",
    label: "Something else",
    hint: "Tell us what's wrong.",
    icon: HelpCircle,
    kind: "email",
  },
];

export interface ReportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeTitle?: string;
  /** Injectable for tests; defaults to a real navigation (copyright → DMCA). */
  navigate?: (href: string) => void;
}

type Phase = "choose" | "describe" | "sending" | "sent" | "error";

export function ReportRecipeDialog({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
  navigate,
}: ReportRecipeDialogProps) {
  // Non-copyright reports are durably logged to /api/recipe-report (the OSA/DSA
  // queue, ENG-1225 #19) — never a silent mailto. Email is only the error
  // fallback. State resets whenever the dialog (re)opens.
  const [phase, setPhase] = React.useState<Phase>("choose");
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [description, setDescription] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setPhase("choose");
      setReason(null);
      setDescription("");
    }
  }, [open]);

  const go = (href: string) => {
    if (navigate) navigate(href);
    else if (typeof window !== "undefined") window.location.href = href;
  };

  const pick = (r: ReportReason) => {
    if (r.kind === "dmca") {
      go(`/dmca?recipe=${encodeURIComponent(recipeId)}`);
      onOpenChange(false);
      return;
    }
    setReason(r);
    setPhase("describe");
  };

  const submit = async () => {
    if (!reason) return;
    setPhase("sending");
    try {
      const res = await fetch("/api/recipe-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          reason: reason.key,
          description: description.trim() || undefined,
        }),
      });
      setPhase(res.ok ? "sent" : "error");
    } catch {
      setPhase("error");
    }
  };

  const mailtoFallback = () => {
    const title = recipeTitle?.trim() || `recipe ${recipeId}`;
    const subject = encodeURIComponent(`Recipe report — ${title}`);
    const body = encodeURIComponent(
      `Recipe: ${title} (id: ${recipeId})\nReason: ${reason?.label ?? ""}\n\n${description}`,
    );
    go(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm" data-testid="report-recipe-dialog">
        {phase === "sent" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Thanks for flagging this</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We&apos;ve logged your report and review reports within 5
                business days. Reporting flags content for review and
                doesn&apos;t guarantee removal.
              </DialogDescription>
            </DialogHeader>
            <PrimaryBtn onClick={() => onOpenChange(false)} testId="report-done">Done</PrimaryBtn>
          </>
        ) : phase === "error" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Couldn&apos;t save that</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Something went wrong saving your report. Please email{" "}
                <a className="underline text-foreground/80" href={`mailto:${SUPPORT_EMAIL}`} onClick={mailtoFallback}>
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we&apos;ll look into it.
              </DialogDescription>
            </DialogHeader>
            <PrimaryBtn onClick={() => onOpenChange(false)} testId="report-done">Close</PrimaryBtn>
          </>
        ) : phase === "describe" || phase === "sending" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">{reason?.label}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add anything that helps us review it. Reporting flags content for
                review — it doesn&apos;t guarantee removal.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
              data-testid="report-description"
              placeholder="What's wrong? (optional)"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setPhase("choose")}
                disabled={phase === "sending"}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={phase === "sending"}
                data-testid="report-submit"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary-solid px-4 text-sm font-medium text-primary-foreground hover:bg-primary-solid/90 disabled:opacity-50"
              >
                {phase === "sending" ? "Sending…" : "Submit report"}
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Report an issue</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                What&apos;s wrong with this recipe? Copyright claims go to our
                DMCA team; everything else reaches our review queue. We respond
                within 5 business days.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-1">
              {REASONS.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pick(r)}
                    data-testid={`report-reason-${r.key}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{r.label}</span>
                      <span className="block text-[13px] text-muted-foreground">{r.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrimaryBtn({
  onClick,
  testId,
  children,
}: {
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-primary-solid px-4 text-sm font-medium text-primary-foreground hover:bg-primary-solid/90"
    >
      {children}
    </button>
  );
}

export default ReportRecipeDialog;
