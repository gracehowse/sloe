"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Icons } from "./icons";

const REVEAL_PX = 88;
const OPEN_THRESHOLD = 44;

export type SwipeDeleteRowProps = {
  onDelete: () => void;
  children: React.ReactNode;
  className?: string;
  /** When false, renders children only. Default true. */
  enabled?: boolean;
};

/**
 * Horizontal swipe-to-reveal delete — mirrors mobile `TodayMealsSection`
 * `Swipeable` rows (shopping list + legacy meal list parity).
 */
export function SwipeDeleteRow({
  onDelete,
  children,
  className = "",
  enabled = true,
}: SwipeDeleteRowProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const tracking = useRef(false);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const clamp = (x: number) => Math.max(-REVEAL_PX, Math.min(0, x));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startOffset.current = offset;
    tracking.current = true;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tracking.current) return;
    const dx = e.clientX - startX.current;
    if (dx > 8 && startOffset.current === 0) return;
    setOffset(clamp(startOffset.current + dx));
  };

  const finish = () => {
    if (!tracking.current) return;
    tracking.current = false;
    setIsDragging(false);
    setOffset((o) => (o <= -OPEN_THRESHOLD ? -REVEAL_PX : 0));
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: REVEAL_PX }}
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setOffset(0);
          }}
          className="flex h-full w-full flex-col items-center justify-center bg-destructive text-destructive-foreground"
          aria-label="Remove meal"
        >
          <Icons.delete className="h-5 w-5" aria-hidden />
          <span className="mt-1 text-[11px] font-medium">Remove</span>
        </button>
      </div>
      <div
        className="relative touch-pan-y bg-card"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 200ms ease-out",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {children}
      </div>
    </div>
  );
}
