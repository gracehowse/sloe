"use client";

/**
 * ENG-1597 — contextual "?" hint (web). Opens a short dialog with title + bullets.
 * Mobile: `apps/mobile/components/help/ContextualHelpHint.tsx`.
 */

import { useState } from "react";
import { CircleHelp } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import {
  IN_APP_HELP_IMPORT_FLAG,
  type ContextualHelpTopic,
} from "../../../lib/help/importLoopHints.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export function ContextualHelpHint({
  topic,
  className,
  testId = "contextual-help-hint",
}: {
  topic: ContextualHelpTopic;
  className?: string;
  testId?: string;
}) {
  const enabled = isFeatureEnabled(IN_APP_HELP_IMPORT_FLAG);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className={
          className ??
          "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        aria-label={`Help: ${topic.title}`}
        data-testid={testId}
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background max-w-sm gap-4" data-testid={`${testId}-sheet`}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{topic.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Short guidance for this step.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
            {topic.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
