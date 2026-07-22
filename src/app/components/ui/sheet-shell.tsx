"use client";

import * as React from "react";
import { cn } from "./utils";
import { MODAL_OVERLAY_SCRIM } from "../../../lib/theme/modalOverlay";

export function SheetGrabberBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-grabber"
      className={cn(
        "mx-auto mb-4 rounded-full bg-border",
        "h-[var(--sheet-grabber-height)] w-[var(--sheet-grabber-width)]",
        className,
      )}
      {...props}
    />
  );
}

export interface SheetShellProps extends React.ComponentProps<"div"> {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom-sheet chassis — scrim + 24px top corners + grabber (ENG-1662). */
export function SheetShell({ open, onClose, children, className, ...props }: SheetShellProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" data-slot="sheet-shell">
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0"
        style={{ backgroundColor: MODAL_OVERLAY_SCRIM }}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative rounded-t-[var(--radius-card-lg)] bg-card px-5 pb-6 pt-4",
          className,
        )}
        {...props}
      >
        <SheetGrabberBar />
        {children}
      </div>
    </div>
  );
}

export default SheetShell;
