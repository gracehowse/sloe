"use client";

import * as React from "react";
import { Download, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  WeeklyRecapCard,
  recapSvgToPngBlob,
  type WeeklyRecapCardProps,
} from "./weekly-recap-card";
import { WeeklyRecapDetailRows } from "./WeeklyRecapDetailRows";
import type { WeeklyRecapDetailRow } from "../../../lib/nutrition-core/weeklyRecapDetailRows";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * WeeklyRecapDialog — the web recap destination (ENG-1225 #20). Hosts the
 * shareable `WeeklyRecapCard` (#4) and the Save / Share actions that rasterise
 * it to a PNG via `recapSvgToPngBlob` (no dependency). Opened by the Today
 * StreakPip (previously a dead pip). Mirror of mobile's recap share flow.
 */
export interface WeeklyRecapDialogProps
  extends Omit<WeeklyRecapCardProps, "ratio" | "width" | "className"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailRows?: WeeklyRecapDetailRow[];
}

export function WeeklyRecapDialog({
  open,
  onOpenChange,
  onTargetDays,
  detailRows = [],
  ...card
}: WeeklyRecapDialogProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState<null | "save" | "share">(null);

  const fileName = `sloe-recap-${card.weekLabel.replace(/[^\w]+/g, "-").toLowerCase()}.png`;

  const blob = React.useCallback(async () => {
    const svg = cardRef.current?.querySelector("svg");
    if (!svg) throw new Error("recap card not mounted");
    return recapSvgToPngBlob(svg as unknown as SVGSVGElement);
  }, []);

  const handleSave = async () => {
    setBusy("save");
    try {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* render/encode failed — leave the dialog open so the user can retry */
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const file = new File([await blob()], fileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "My Sloe week",
          text: `${onTargetDays}/7 days on target this week.`,
        });
      } else {
        // No Web Share (or no file support) — fall back to a download.
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* user dismissed the share sheet, or it failed — no-op */
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Your week</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-1">
          <div ref={cardRef} className="overflow-hidden rounded-2xl shadow-lg">
            <WeeklyRecapCard onTargetDays={onTargetDays} {...card} ratio="portrait" width={280} />
          </div>
          {isFeatureEnabled("weekly_recap_detail_v1") && detailRows.length > 0 ? (
            <WeeklyRecapDetailRows rows={detailRows} />
          ) : null}
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSave}
              disabled={busy !== null}
              data-testid="recap-save"
            >
              <Download className="h-4 w-4" aria-hidden />
              {busy === "save" ? "Saving…" : "Save image"}
            </Button>
            <Button
              className="flex-1"
              onClick={handleShare}
              disabled={busy !== null}
              data-testid="recap-share"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {busy === "share" ? "Sharing…" : "Share"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WeeklyRecapDialog;
