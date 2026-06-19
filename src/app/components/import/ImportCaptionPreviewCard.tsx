"use client";

import * as React from "react";
import { Camera, Link2, ShieldCheck } from "lucide-react";

import { SupprButton } from "@/app/components/suppr/suppr-button";
import type { CaptionTextPlatform } from "@/lib/recipes/resolveImportUrl";

export type ImportCaptionPreviewCardProps = {
  platform: CaptionTextPlatform;
  captionDraft: string;
  captionEditing: boolean;
  busy?: boolean;
  onCaptionChange: (value: string) => void;
  onToggleEdit: () => void;
  onConfirm: () => void;
  onPhotoInstead: () => void;
  onLinkInstead: () => void;
};

function platformLabel(platform: CaptionTextPlatform): string {
  switch (platform) {
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
  }
}

/**
 * ENG-898 — web caption preview + trust banner (import.md §3.4).
 * Flag: `import_caption_preview_v1` on RecipeUpload import mode.
 */
export function ImportCaptionPreviewCard({
  platform,
  captionDraft,
  captionEditing,
  busy = false,
  onCaptionChange,
  onToggleEdit,
  onConfirm,
  onPhotoInstead,
  onLinkInstead,
}: ImportCaptionPreviewCardProps) {
  const label = platformLabel(platform);

  return (
    <div
      className="space-y-4 rounded-[var(--radius-card-lg)] border border-border bg-card p-6"
      data-testid="import-caption-preview"
    >
      <h3 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand">
        Import from {label}
      </h3>

      <div className="flex gap-3 rounded-xl bg-muted/40 p-4 text-left">
        <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
        <p className="text-sm text-foreground">
          We never fetch the post itself — this is the caption text you shared.
          Paste the caption from {label}, check it looks right, then import.
        </p>
      </div>

      {captionEditing ? (
        <textarea
          value={captionDraft}
          onChange={(e) => onCaptionChange(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Paste the post caption here…"
          aria-label="Edit caption text"
          data-testid="caption-preview-editor"
        />
      ) : (
        <div
          className="max-h-60 overflow-y-auto rounded-xl border border-border bg-muted/30 px-4 py-3 text-left text-sm text-foreground"
          data-testid="caption-preview-scroll"
        >
          {captionDraft.trim() ? captionDraft : (
            <span className="text-muted-foreground">
              Paste the caption from the {label} share sheet above.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SupprButton
          variant="primary"
          type="button"
          loading={busy}
          disabled={!captionDraft.trim()}
          onClick={onConfirm}
          data-testid="caption-preview-confirm"
          label="Looks right — import it"
        />
        <SupprButton
          variant="ghost"
          type="button"
          onClick={onToggleEdit}
          data-testid="caption-preview-edit-toggle"
          label={captionEditing ? "Done editing" : "Edit caption"}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          data-testid="caption-preview-photo-escape"
          onClick={onPhotoInstead}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Import from a photo instead
        </button>
        <button
          type="button"
          data-testid="caption-preview-link-escape"
          onClick={onLinkInstead}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Import from link only
        </button>
      </div>
    </div>
  );
}
