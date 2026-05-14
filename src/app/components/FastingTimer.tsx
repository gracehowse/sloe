"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase/browserClient";
import { useAuthSession } from "../../context/AuthSessionContext";
import { Icons } from "./ui/icons";
import {
  FASTING_MILESTONES,
  formatProjectedEndTime,
  selectUpcomingMilestones,
} from "../../lib/fasting/milestones";

type FastingSession = { start: string; end: string | null };

/**
 * Suppr web Fasting — Zero / Apple-Health-bar expansion (2026-05-14).
 *
 * Premium-bar audit (`docs/planning/premium-bar-systematic-followups-2026-05-12.md`
 * line 456) flagged the web fasting surface as a thin MVP next to the
 * mobile screen. This rewrite brings web up to the same trust posture:
 *
 *   1. SVG progress ring (0→2π sweep, same geometry as mobile).
 *   2. Body-state milestone chips (8h Glycogen, 12h Ketosis,
 *      16h Deep fast), only showing milestones the user hasn't hit yet,
 *      capped by their chosen fast window. Logic lives in
 *      `src/lib/fasting/milestones.ts` so it's unit-testable without
 *      RTL, and re-usable from mobile if/when we port the chips there.
 *   3. Projected end time below the ring (start + fast window).
 *   4. History of the last 5 completed fasts (was already present;
 *      kept and visually polished to the new card geometry).
 *   5. Not-fasting landing — Timer glyph, "Fast when you're ready"
 *      headline, quick-start chips (16:8 / 18:6 / Custom) matching the
 *      mobile landing card.
 *
 * Trust posture (per `_project-context.md`):
 *   - Milestones are descriptive ("Glycogen", "Ketosis"), never
 *     prescriptive. No "you must fast longer to lose weight" copy.
 *   - Past days = past tense; the live timer renders in present tense.
 *
 * Data contract is unchanged: `profiles.fasting_window` (e.g. "16:8")
 * + `profiles.fasting_sessions` (array of `{start, end}`). Mobile
 * (`apps/mobile/app/fasting.tsx`) reads and writes the same fields,
 * so a fast started on either platform shows up live on the other.
 */

function parseFastingWindow(window: string): { fastHours: number; eatHours: number } {
  const parts = window.split(":");
  if (parts.length === 2) {
    const fast = parseInt(parts[0], 10);
    const eat = parseInt(parts[1], 10);
    if (!isNaN(fast) && !isNaN(eat)) return { fastHours: fast, eatHours: eat };
  }
  return { fastHours: 16, eatHours: 8 };
}

function formatDuration(ms: number): { hours: number; minutes: number; display: string } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hours: h, minutes: m, display: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

/** Window presets — kept in sync with mobile (`apps/mobile/app/fasting.tsx`). */
const WINDOW_PRESETS = ["16:8", "18:6", "20:4", "14:10"] as const;
const MAX_SESSIONS = 90;

// Ring geometry — same proportions as the mobile SVG ring so the two
// surfaces feel like the same product. 220px outer / 14px stroke
// matches mobile's RING_SIZE + STROKE constants.
const RING_SIZE = 220;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function FastingTimer() {
  const TimerIcon = Icons.timer;
  const { authedUserId } = useAuthSession();
  const [fastingWindow, setFastingWindow] = useState("16:8");
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFast = useMemo(
    () => sessions.find((s) => s.end === null) ?? null,
    [sessions],
  );
  const { fastHours, eatHours } = parseFastingWindow(fastingWindow);
  const fastMs = fastHours * 3600_000;

  const elapsed = activeFast ? now - new Date(activeFast.start).getTime() : 0;
  const pct = activeFast && fastMs > 0 ? Math.min(1, elapsed / fastMs) : 0;
  const remaining = Math.max(0, fastMs - elapsed);
  const isFasting = !!activeFast;
  const isComplete = isFasting && elapsed >= fastMs;

  // Load fasting state from Supabase. try/finally guarantees we drop
  // the spinner even if the select throws (parity with the mobile
  // load path — see `apps/mobile/app/fasting.tsx` cancellation note).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authedUserId) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("profiles")
          .select("fasting_sessions, fasting_window, fasting_enabled")
          .eq("id", authedUserId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          if (Array.isArray(data.fasting_sessions)) {
            setSessions(data.fasting_sessions as FastingSession[]);
          }
          if (typeof data.fasting_window === "string") {
            setFastingWindow(data.fasting_window);
          }
        }
      } catch {
        // Network / RLS failure — leave defaults in place.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  // Live timer — only ticks while a fast is active so we don't churn
  // re-renders on the not-fasting landing card.
  useEffect(() => {
    if (activeFast) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [activeFast]);

  const persist = useCallback(
    async (updated: FastingSession[], windowOverride?: string) => {
      if (!authedUserId) return;
      const trimmed = updated.slice(-MAX_SESSIONS);
      setSessions(trimmed);
      await supabase
        .from("profiles")
        .update({
          fasting_sessions: trimmed,
          ...(windowOverride != null ? { fasting_window: windowOverride } : {}),
        })
        .eq("id", authedUserId);
    },
    [authedUserId],
  );

  const startFast = useCallback(() => {
    const next = [...sessions, { start: new Date().toISOString(), end: null }];
    void persist(next);
    setNow(Date.now());
  }, [sessions, persist]);

  const endFast = useCallback(() => {
    const updated = sessions.map((s) =>
      s.end === null ? { ...s, end: new Date().toISOString() } : s,
    );
    void persist(updated);
  }, [sessions, persist]);

  const changeWindow = useCallback(
    (w: string) => {
      if (w === fastingWindow) return;
      setFastingWindow(w);
      void persist(sessions, w);
    },
    [fastingWindow, sessions, persist],
  );

  /**
   * Quick-start a fast with a specific preset in one tap. Sets the
   * fasting window AND starts a fast immediately — mirrors the
   * mobile `quickStartFast` helper. Used by the landing card chips
   * so the most common journey (16:8 / 18:6) is a single click
   * rather than the two-step "pick window then tap Start Fast".
   */
  const quickStartFast = useCallback(
    (w: string) => {
      const next = [...sessions, { start: new Date().toISOString(), end: null }];
      setFastingWindow(w);
      void persist(next, w);
      setNow(Date.now());
    },
    [sessions, persist],
  );

  /** Pick a custom preset via a window.prompt fallback — keeps the
   *  landing chip simple while still letting users reach 20:4 / 14:10
   *  without scrolling to the preset row below. */
  const openCustomWindowPicker = useCallback(() => {
    if (typeof window === "undefined") return;
    const choice = window.prompt(
      "Pick a fasting window — enter one of: 20:4, 14:10",
      "20:4",
    );
    if (!choice) return;
    const normalised = choice.trim();
    if (
      normalised === "20:4" ||
      normalised === "14:10" ||
      normalised === "16:8" ||
      normalised === "18:6"
    ) {
      quickStartFast(normalised);
    }
  }, [quickStartFast]);

  const recentCompleted = useMemo(
    () =>
      sessions
        .filter((s) => s.end !== null)
        .slice(-5)
        .reverse(),
    [sessions],
  );

  const dur = formatDuration(elapsed);
  const remainingDur = formatDuration(remaining);

  // Upcoming milestones chip list — empty list collapses the row.
  const milestones = useMemo(
    () => (isFasting ? selectUpcomingMilestones(elapsed, fastHours) : FASTING_MILESTONES.filter((m) => m.hours <= fastHours)),
    [isFasting, elapsed, fastHours],
  );

  const projectedEnd = useMemo(
    () => (activeFast ? formatProjectedEndTime(activeFast.start, fastHours) : ""),
    [activeFast, fastHours],
  );

  if (loading) {
    return (
      <div
        className="rounded-xl border border-border bg-card p-5 animate-pulse"
        aria-busy="true"
      >
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-56 w-full bg-muted rounded" />
      </div>
    );
  }

  const ringColor = isComplete ? "var(--success)" : "var(--primary)";
  const trackColor = "var(--ring-bg)";
  const strokeDashoffset = CIRC * (1 - pct);

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 space-y-5"
      data-testid="fasting-timer"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Intermittent Fasting</h3>
        <div className="flex gap-1" data-testid="fasting-window-picker">
          {WINDOW_PRESETS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => changeWindow(w)}
              disabled={isFasting}
              aria-pressed={fastingWindow === w}
              aria-label={`Set fasting window to ${w}`}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors tabular-nums ${
                fastingWindow === w
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {isFasting ? (
        <div className="flex flex-col items-center gap-4">
          {/* SVG progress ring — same 0→2π sweep as the mobile ring,
              starting at 12 o'clock (rotated -90°). Track behind the
              progress arc uses the shared `--ring-bg` token so dark
              mode picks up the correct contrast. */}
          <div
            className="relative"
            style={{ width: RING_SIZE, height: RING_SIZE }}
            role="img"
            aria-label={
              isComplete
                ? `Fast complete after ${dur.hours} hours ${dur.minutes} minutes`
                : `Fasting for ${dur.hours} hours ${dur.minutes} minutes, ${remainingDur.hours} hours ${remainingDur.minutes} minutes remaining`
            }
            data-testid="fasting-ring"
          >
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              aria-hidden="true"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={trackColor}
                strokeWidth={STROKE}
                fill="none"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={ringColor}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={CIRC}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={pct < 0.02 ? "butt" : "round"}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p
                className="text-4xl font-extrabold tabular-nums text-foreground"
                data-testid="fasting-elapsed"
              >
                {dur.hours}:{String(dur.minutes).padStart(2, "0")}
              </p>
              <p
                className="text-xs font-semibold uppercase tracking-wider mt-1"
                style={{ color: isComplete ? "var(--success)" : "var(--primary)" }}
              >
                {isComplete ? "Fast complete" : "Fasting"}
              </p>
            </div>
          </div>

          {/* Start / Goal — Goal is the projected end time. Mirrors the
              mobile screen's Started/Goal pair. */}
          <div className="flex items-center justify-around w-full max-w-xs">
            <div className="text-center">
              <p className="text-base font-bold tabular-nums text-foreground">
                {new Date(activeFast.start).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Started
              </p>
            </div>
            <div className="text-center" data-testid="fasting-projected-end">
              <p
                className="text-base font-bold tabular-nums"
                style={{ color: "var(--success)" }}
              >
                {projectedEnd || "—"}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Ends at
              </p>
            </div>
          </div>

          {/* Upcoming milestones — chips render only milestones still
              ahead of the current elapsed time, capped by the user's
              fast window. Empty list collapses the row entirely. */}
          {milestones.length > 0 && (
            <div
              className="flex flex-wrap gap-2 justify-center"
              data-testid="fasting-milestones"
              aria-label="Upcoming fasting milestones"
            >
              {milestones.map((m) => (
                <span
                  key={m.hours}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground tabular-nums"
                  data-testid={`fasting-milestone-${m.hours}h`}
                >
                  <span className="text-foreground">{m.hours}h</span>
                  <span className="opacity-70">·</span>
                  <span>{m.label}</span>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={endFast}
            aria-label={isComplete ? "Complete fast" : "End fast early"}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isComplete
                ? "bg-[var(--success)] text-white hover:opacity-90"
                : "border border-border bg-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            {isComplete ? "Complete Fast" : "End Fast Early"}
          </button>
        </div>
      ) : (
        // Not-fasting landing — Timer glyph + headline + quick-start
        // chips. Mirrors `apps/mobile/app/fasting.tsx` fasting-landing.
        <div
          className="flex flex-col items-center text-center py-2"
          data-testid="fasting-landing"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            aria-hidden="true"
          >
            <TimerIcon
              className="w-14 h-14"
              style={{ color: "var(--primary)" }}
              strokeWidth={1.5}
            />
          </div>
          <h4 className="text-xl font-extrabold text-foreground mb-2">
            Fast when you&apos;re ready
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-sm">
            Intermittent fasting can help with weight management and metabolic
            health. Start a fast whenever you like.
          </p>
          <p className="text-xs text-muted-foreground mb-4 tabular-nums">
            {fastHours}:{eatHours} — {fastHours}h fast, {eatHours}h eat
          </p>

          <button
            type="button"
            onClick={startFast}
            className="w-full max-w-xs py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start {fastingWindow} Fast
          </button>

          {/* Quick-start chips — one tap = set window + start fast.
              16:8 + 18:6 cover the two most-common presets; Custom
              prompts for the remaining 20:4 / 14:10 options so users
              don't have to dig into the preset row. */}
          <div
            className="flex gap-2 mt-4 justify-center"
            data-testid="fasting-landing-chips"
          >
            {[
              { label: "16:8", onClick: () => quickStartFast("16:8") },
              { label: "18:6", onClick: () => quickStartFast("18:6") },
              { label: "Custom", onClick: openCustomWindowPicker },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.onClick}
                aria-label={
                  chip.label === "Custom"
                    ? "Pick a custom fasting window"
                    : `Start a ${chip.label} fast`
                }
                data-testid={`fasting-landing-chip-${chip.label}`}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card text-muted-foreground hover:bg-muted transition-colors tabular-nums"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent fasts — last 5 completed. Empty state collapses the
          section entirely (a brand-new fasting user shouldn't see a
          empty history block). */}
      {recentCompleted.length > 0 && (
        <div
          className="space-y-2 pt-4 border-t border-border"
          data-testid="fasting-history"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent fasts
          </p>
          <ul className="space-y-1">
            {recentCompleted.map((s) => {
              const start = new Date(s.start);
              const end = new Date(s.end!);
              const durMs = end.getTime() - start.getTime();
              const fd = formatDuration(durMs);
              const { fastHours: rowGoalHours } = parseFastingWindow(fastingWindow);
              return (
                <li
                  key={s.start}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <span className="text-muted-foreground">
                    {start.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fd.hours}h {String(fd.minutes).padStart(2, "0")}m
                    <span className="font-normal text-muted-foreground ml-2">
                      / {rowGoalHours}h
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
