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

const toneClass: Record<SupprNoticeTone, string> = {
  primary: "border-primary/20 bg-primary/10",
  warning: "border-warning bg-warning/10",
  destructive: "border-destructive/20 bg-destructive/10",
  offline: "border-primary/20 bg-card",
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
