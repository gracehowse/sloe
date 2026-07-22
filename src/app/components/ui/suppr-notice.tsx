"use client";

import * as React from "react";
import { cn } from "./utils";

export type SupprNoticeTone = "primary" | "warning" | "neutral" | "offline" | "destructive";
export type SupprNoticeVariant = "block" | "inline" | "pill";

export interface SupprNoticeProps extends React.ComponentProps<"div"> {
  tone?: SupprNoticeTone;
  variant?: SupprNoticeVariant;
  leading?: React.ReactNode;
}

// Soft / SoftStrong named tokens — not accent slash-opacity (ENG-1591).
// Mirrors mobile `SupprNotice` toneColors (primarySoft + primarySoftStrong, etc.).
const toneClass: Record<SupprNoticeTone, string> = {
  primary: "border-primary-soft bg-primary-soft",
  warning: "border-warning bg-warning-soft",
  destructive: "border-destructive-soft bg-destructive-soft",
  offline: "border-primary-soft bg-card",
  neutral: "border-border bg-card",
};

const variantClass: Record<SupprNoticeVariant, string> = {
  block: "rounded-[var(--radius-card-lg)] p-4",
  inline: "rounded-xl p-4",
  pill: "self-start rounded-full px-4 py-1",
};

export function SupprNotice({
  tone = "neutral",
  variant = "inline",
  leading,
  children,
  className,
  ...props
}: SupprNoticeProps) {
  return (
    <div
      data-slot="suppr-notice"
      data-tone={tone}
      data-variant={variant}
      className={cn(
        "flex items-start gap-2 border",
        toneClass[tone],
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default SupprNotice;
