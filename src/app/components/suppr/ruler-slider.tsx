"use client";

import * as React from "react";
import { cn } from "../ui/utils";

/**
 * RulerSlider — iOS-style horizontal ruler picker.
 *
 * Used by onboarding for height + weight (steps 06 + 07), and any
 * surface that wants a tactile "scrub to change a value" affordance
 * without a stepper or numeric input modal.
 *
 * Inputs:
 *  - drag the ruler (pointer / touch) — snapped to `step`
 *  - mouse wheel / trackpad
 *  - keyboard: arrows (±step), page up/down (±major), home/end (clamp)
 *  - tap the big number → number editor (Enter to commit, Esc to cancel)
 *
 * Custom formatting:
 *  - `format(value)` — render the big number (e.g. `5′ 10″`)
 *  - `parseInput(string)` — parse the editor's text back to a number
 */

interface RulerSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  /** Suffix shown next to the number readout (ignored when `format` is set). */
  unit?: string;
  /** Render override for the big number (e.g. imperial height). */
  format?: (value: number) => string;
  /** Parse override for typed-input mode (when `format` is custom). */
  parseInput?: (text: string) => number;
  /** Pixel width of the ruler track. Defaults to filling parent (320). */
  width?: number;
  /** Accent colour CSS string. Defaults to `var(--primary)`. */
  accent?: string;
  className?: string;
  ariaLabel?: string;
}

const PX_PER_STEP = 8;

function RulerSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit,
  format,
  parseInput,
  width = 320,
  accent = "var(--primary)",
  className,
  ariaLabel = "Value",
}: RulerSliderProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const range = max - min;
  const steps = Math.round(range / step);
  const majorEvery = decimals > 0 ? Math.round(1 / step) : 10;
  const midEvery = Math.max(1, Math.round(majorEvery / 2));

  const roundTo = React.useCallback(
    (v: number) => {
      const p = Math.pow(10, Math.max(decimals, 2));
      return Math.round(v * p) / p;
    },
    [decimals],
  );
  const clamp = React.useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max],
  );
  const snap = React.useCallback(
    (v: number) => roundTo(Math.round((v - min) / step) * step + min),
    [min, step, roundTo],
  );

  const valueToOffset = React.useCallback(
    (v: number) => ((v - min) / step) * PX_PER_STEP,
    [min, step],
  );

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;
    const dpr = window.devicePixelRatio || 1;
    const w = track.clientWidth;
    const h = 64;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    // jsdom throws on getContext; ignore in tests so the slider still
    // renders the readout and remains keyboard-driveable.
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cs = getComputedStyle(track);
    const majorCol =
      cs.getPropertyValue("--foreground").trim() || "currentColor";
    const minorCol = cs.getPropertyValue("--muted-foreground").trim() || "#888";
    const labelCol = cs.getPropertyValue("--muted-foreground").trim() || "#aaa";

    const centerX = w / 2;
    const offset = valueToOffset(value);

    ctx.font = '500 10px ui-sans-serif, system-ui, -apple-system';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const leftEdge = -centerX + offset;
    const rightEdge = w - centerX + offset;
    const firstIdx = Math.max(0, Math.floor(leftEdge / PX_PER_STEP));
    const lastIdx = Math.min(steps, Math.ceil(rightEdge / PX_PER_STEP));

    for (let i = firstIdx; i <= lastIdx; i++) {
      const x = centerX + (i * PX_PER_STEP - offset);
      const isMajor = i % majorEvery === 0;
      const isMid = !isMajor && i % midEvery === 0;
      const tickH = isMajor ? 30 : isMid ? 18 : 10;
      const color = isMajor ? majorCol : minorCol;
      const alpha = isMajor ? 0.9 : isMid ? 0.55 : 0.3;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x) - 0.5, 8, 1, tickH);

      if (isMajor) {
        const v = roundTo(min + i * step);
        const label = decimals > 0 ? v.toFixed(0) : String(v);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = labelCol;
        ctx.fillText(label, x, 44);
      }
    }
    ctx.globalAlpha = 1;
  }, [value, min, step, decimals, majorEvery, midEvery, steps, valueToOffset, roundTo]);

  React.useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let startX = 0;
    let startVal = 0;
    let pointerId: number | null = null;

    const onDown = (e: PointerEvent) => {
      if (editing) return;
      pointerId = e.pointerId;
      track.setPointerCapture(pointerId);
      startX = e.clientX;
      startVal = value;
      setDragging(true);
    };
    const onMove = (e: PointerEvent) => {
      if (pointerId == null) return;
      const dx = e.clientX - startX;
      const dv = -dx * (step / PX_PER_STEP);
      onChange(snap(clamp(startVal + dv)));
    };
    const onUp = () => {
      if (pointerId == null) return;
      try {
        track.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      pointerId = null;
      setDragging(false);
    };

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
    };
  }, [value, step, editing, onChange, snap, clamp]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (editing) return;
    e.preventDefault();
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const delta = raw * (step / PX_PER_STEP) * 0.8;
    onChange(snap(clamp(value + delta)));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    let handled = true;
    if (e.key === "ArrowLeft") onChange(snap(clamp(value - step)));
    else if (e.key === "ArrowRight") onChange(snap(clamp(value + step)));
    else if (e.key === "PageDown")
      onChange(snap(clamp(value - step * majorEvery)));
    else if (e.key === "PageUp")
      onChange(snap(clamp(value + step * majorEvery)));
    else if (e.key === "Home") onChange(min);
    else if (e.key === "End") onChange(max);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const commitDraft = () => {
    const n = parseInput ? parseInput(draft) : parseFloat(draft);
    if (!Number.isNaN(n)) onChange(snap(clamp(n)));
    setEditing(false);
  };

  const displayVal = format
    ? format(value)
    : decimals > 0
      ? value.toFixed(decimals)
      : String(Math.round(value));

  return (
    <div
      data-slot="ruler-slider"
      className={cn("relative", className)}
      style={{ width }}
    >
      <div className="text-center mb-3">
        {editing ? (
          <span className="inline-flex items-baseline gap-1.5">
            <input
              autoFocus
              type={parseInput ? "text" : "number"}
              inputMode="decimal"
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraft();
                if (e.key === "Escape") setEditing(false);
              }}
              className={cn(
                "ruler-num-input bg-transparent border-0 outline-none text-foreground",
                "font-extrabold tracking-tight tabular-nums text-center p-0",
              )}
              style={{
                fontSize: 60,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                width: format ? 180 : decimals > 0 ? 160 : 130,
                borderBottom: `3px solid ${accent}`,
              }}
              aria-label={ariaLabel}
            />
            {unit && !format && (
              <span className="text-lg text-muted-foreground font-semibold">
                {unit}
              </span>
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(displayVal));
              setEditing(true);
            }}
            aria-label={`Edit ${ariaLabel.toLowerCase()}`}
            className="bg-transparent border-0 p-0 cursor-text inline-flex items-baseline gap-1.5"
          >
            <span
              className="text-foreground font-extrabold tracking-tight tabular-nums leading-none"
              style={{ fontSize: 60, letterSpacing: "-0.035em" }}
            >
              {displayVal}
            </span>
            {unit && !format && (
              <span className="text-lg text-muted-foreground font-semibold ml-0.5">
                {unit}
              </span>
            )}
          </button>
        )}
        <div className="section-label mt-1.5">
          {editing ? "Type · Enter to save" : "Drag the ruler · or tap number"}
        </div>
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className={cn(
          "relative h-16 w-full rounded-card bg-card border border-border outline-none",
          "transition-pm focus-visible:border-primary",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ touchAction: "none", overflow: "hidden" }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", pointerEvents: "none" }}
        />
        <div
          aria-hidden
          className="absolute top-1 bottom-1 w-[3px] -ml-[1.5px] left-1/2 rounded-sm"
          style={{
            background: accent,
            boxShadow: `0 0 14px ${accent}aa`,
          }}
        />
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, var(--card) 20%, transparent)",
          }}
        />
        <div
          aria-hidden
          className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
          style={{
            background:
              "linear-gradient(270deg, var(--card) 20%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

/** Helper: format total inches to "5′ 10″" for imperial height. */
function formatImperialHeightInches(totalIn: number): string {
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

/**
 * Helper: parse common imperial height-entry shapes → total inches.
 *
 *  - `"70"`           → 70 (single number is treated as total inches)
 *  - `"5'10\""`       → 70
 *  - `"5 10"`         → 70
 *  - `"5ft 10in"`     → 70 (any non-digit run separates feet from inches)
 *  - `"5ft"`          → 60 (lone feet with explicit ft/' literal)
 */
function parseImperialHeightInches(text: string): number {
  const trimmed = String(text).trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const both = trimmed.match(/^(\d+)\D+(\d+)/);
  if (both) {
    const ft = parseInt(both[1], 10);
    const inch = parseInt(both[2], 10);
    return ft * 12 + inch;
  }
  // Lone feet with an explicit "ft", "'", or "′" suffix → ft × 12.
  const ftOnly = trimmed.match(/^(\d+)\s*(?:ft|'|′)\b/i);
  if (ftOnly) return parseInt(ftOnly[1], 10) * 12;
  return parseFloat(trimmed);
}

export { RulerSlider, formatImperialHeightInches, parseImperialHeightInches };
export type { RulerSliderProps };
