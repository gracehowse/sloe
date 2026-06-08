"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase/browserClient";
import { useAuthSession } from "../../context/AuthSessionContext";
import { Icons } from "./ui/icons";
import {
  FASTING_WINDOW_PRESETS,
  fastingWindowLabel,
  formatProjectedEndTime,
} from "../../lib/fasting/milestones";
import {
  FASTING_STAGES,
  fastingStageAtHours,
  fastingStageBarFraction,
} from "../../lib/fasting/stages";
import { fastingStageNarrative } from "../../lib/nutrition/fastingStageNarrative";

type FastingSession = { start: string; end: string | null };

/**
 * Suppr web Fasting — SLOE DS migration (2026-06-07, Figma 305:2).
 *
 * Reskins the legacy indigo fasting timer onto the Sloe design system to
 * match Figma frame `305:2` (D5 fasting timer) and the Stitch-Sloe
 * prototype (`docs/prototypes/stitch-sloe/fasting.html`):
 *
 *   1. Plum serif heading + preset pills (frost-mist track / plum-filled
 *      selected). Presets are all five windows incl. OMAD (ENG-922).
 *   2. 248px clay progress ring on a frost-mist (`--ring-bg`) track, with
 *      a flame "Fat burning" stage chip + serif elapsed numeral +
 *      "elapsed · X left" sub-line inside.
 *   3. "Fasting stages" cream slab — a horizontal Fed → Fat burning →
 *      Ketosis → Deep stage bar (shared `src/lib/fasting/stages.ts`).
 *   4. Started / Goal cream slab.
 *   5. Clay "End fast" pill.
 *   6. Italic serif stage-narrative quote below the button.
 *   7. Not-fasting landing — moon glyph + "Fast when you're ready" +
 *      one-tap quick-start chips.
 *   8. History of recent completed fasts (kept; reskinned to the Sloe
 *      slab geometry).
 *
 * Colour: every value sources a Sloe token (`--accent-primary` = clay,
 * `--foreground-brand` = plum, `--ring-bg` = frost-mist, `--card` =
 * surface-card, `--success` = sage). No hardcoded indigo. The data
 * contract is unchanged — `profiles.fasting_window` + `fasting_sessions`,
 * read + written by mobile (`apps/mobile/app/fasting.tsx`) too, so a fast
 * started on either platform shows live on the other.
 *
 * Trust posture (`_project-context.md`): stages + narrative are
 * descriptive, never prescriptive. Past = past tense; live timer =
 * present tense.
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

/** Window presets — shared with mobile via `FASTING_WINDOW_PRESETS`. */
const MAX_SESSIONS = 90;

// Ring geometry — Sloe 305:2 (248px outer / 14px stroke). Matches the
// mobile SVG ring so the two surfaces feel like the same product.
const RING_SIZE = 248;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function FastingTimer() {
  const FlameIcon = Icons.calories;
  const MoonIcon = Icons.darkMode;
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
  const elapsedHours = elapsed / 3600_000;
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
   * fasting window AND starts a fast immediately — mirrors the mobile
   * `quickStartFast` helper. Used by the landing card chips so the most
   * common journey is a single click.
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

  // Current fasting stage + bar fraction (Sloe stages bar, 305:2).
  const { index: stageIndex } = useMemo(
    () => fastingStageAtHours(elapsedHours),
    [elapsedHours],
  );
  const stageBarFraction = useMemo(
    () => fastingStageBarFraction(elapsedHours, fastHours),
    [elapsedHours, fastHours],
  );

  const projectedEnd = useMemo(
    () => (activeFast ? formatProjectedEndTime(activeFast.start, fastHours) : ""),
    [activeFast, fastHours],
  );

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-5 animate-pulse"
        aria-busy="true"
      >
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-56 w-full bg-muted rounded" />
      </div>
    );
  }

  const ringColor = isComplete ? "var(--success)" : "var(--accent-primary)";
  const trackColor = "var(--ring-bg)";
  const strokeDashoffset = CIRC * (1 - pct);

  return (
    <div className="space-y-7" data-testid="fasting-timer">
      {/* Preset pills — frost-mist track, plum-filled selected. Disabled
          while a fast is active (changing the window mid-fast would
          silently rebase the goal). All five windows incl. OMAD. */}
      <div className="flex justify-center gap-2 flex-wrap" data-testid="fasting-window-picker">
        {FASTING_WINDOW_PRESETS.map((w) => {
          const selected = fastingWindow === w;
          return (
            <button
              key={w}
              type="button"
              onClick={() => changeWindow(w)}
              disabled={isFasting}
              aria-pressed={selected}
              aria-label={`Set fasting window to ${fastingWindowLabel(w)}`}
              className={`font-[family-name:var(--font-label)] text-[13px] font-semibold px-4 py-2 rounded-full transition-colors tabular-nums ${
                selected
                  ? "bg-[var(--foreground-brand)] text-white"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted/40"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {fastingWindowLabel(w)}
            </button>
          );
        })}
      </div>

      {isFasting ? (
        <>
          {/* SVG progress ring — clay arc on frost-mist track, 0→2π sweep
              from 12 o'clock. */}
          <section className="flex flex-col items-center">
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
                {/* Current-stage chip — clay flame for the active body
                    state (descriptive, not prescriptive). */}
                <span
                  className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-[family-name:var(--font-label)] text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full mb-2"
                  data-testid="fasting-stage-chip"
                >
                  <FlameIcon className="w-3.5 h-3.5" aria-hidden />
                  {FASTING_STAGES[stageIndex].label}
                </span>
                <span
                  className="font-[family-name:var(--font-headline)] text-5xl leading-none tabular-nums text-foreground"
                  data-testid="fasting-elapsed"
                >
                  {dur.hours}:{String(dur.minutes).padStart(2, "0")}
                </span>
                <span className="font-[family-name:var(--font-body)] text-[13px] text-muted-foreground mt-1 tabular-nums">
                  {isComplete
                    ? "elapsed · goal reached"
                    : `elapsed · ${remainingDur.hours}:${String(remainingDur.minutes).padStart(2, "0")} left`}
                </span>
              </div>
            </div>
          </section>

          {/* Fasting stages bar — Fed → Fat burning → Ketosis → Deep. */}
          <section
            className="bg-card border border-border rounded-2xl p-5"
            data-testid="fasting-stages"
          >
            <p className="font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-4">
              Fasting stages
            </p>
            <div className="relative h-1.5 rounded-full bg-border mb-1">
              <div
                className="absolute left-0 top-0 h-1.5 rounded-full bg-primary"
                style={{ width: `${stageBarFraction * 100}%` }}
              />
              {FASTING_STAGES.map((stage, i) => {
                const pos = (i / (FASTING_STAGES.length - 1)) * 100;
                const reached = i <= stageIndex;
                return (
                  <span
                    key={stage.id}
                    className={`absolute -top-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                      reached ? "bg-primary" : "bg-border"
                    }`}
                    style={{ left: `calc(${pos}% - 5px)` }}
                  />
                );
              })}
              {/* Current-position marker. */}
              <span
                className="absolute -top-1 w-4 h-4 rounded-full bg-primary border-2 border-card shadow-sm"
                style={{ left: `calc(${stageBarFraction * 100}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between font-[family-name:var(--font-label)] text-[10px] text-muted-foreground mt-2">
              {FASTING_STAGES.map((stage, i) => (
                <span
                  key={stage.id}
                  className={i === stageIndex ? "text-primary font-semibold" : ""}
                >
                  {stage.label}
                </span>
              ))}
            </div>
          </section>

          {/* Started / Goal slab. */}
          <section className="bg-card border border-border rounded-2xl p-5 flex">
            <div className="flex-1 text-center">
              <p className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                Started
              </p>
              <p className="font-[family-name:var(--font-headline)] text-lg text-foreground mt-1 tabular-nums">
                {new Date(activeFast.start).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center" data-testid="fasting-projected-end">
              <p className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                Goal
              </p>
              <p className="font-[family-name:var(--font-headline)] text-lg text-foreground mt-1 tabular-nums">
                {projectedEnd || "—"}
              </p>
            </div>
          </section>

          {/* End fast — clay pill (Complete keeps sage when goal met). */}
          <button
            type="button"
            onClick={endFast}
            aria-label={isComplete ? "Complete fast" : "End fast early"}
            data-testid="fasting-end-button"
            className={`w-full font-[family-name:var(--font-body)] font-semibold text-base rounded-full py-4 transition-opacity hover:opacity-90 ${
              isComplete
                ? "bg-[var(--success)] text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {isComplete ? "Complete fast" : "End fast"}
          </button>

          {/* Stage narrative — italic serif quote. Descriptive, hedged. */}
          {!isComplete && (
            <p
              className="font-[family-name:var(--font-headline)] italic text-base text-foreground text-center px-6"
              data-testid="fasting-stage-narrative"
            >
              {fastingStageNarrative(elapsed)}
            </p>
          )}
        </>
      ) : (
        // Not-fasting landing — moon glyph + headline + quick-start chips.
        // Mirrors `apps/mobile/app/fasting.tsx` fasting-landing.
        <section
          className="flex flex-col items-center text-center"
          data-testid="fasting-landing"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4 bg-[var(--ring-bg)]"
            aria-hidden="true"
          >
            <MoonIcon className="w-12 h-12 text-[var(--foreground-brand)]" strokeWidth={1.5} />
          </div>
          <h4 className="font-[family-name:var(--font-headline)] text-2xl text-foreground-brand mb-2">
            Fast when you&apos;re ready
          </h4>
          <p className="font-[family-name:var(--font-body)] text-sm text-muted-foreground leading-relaxed mb-4 max-w-sm">
            A fasting window is just a way to structure when you eat. Start one
            whenever you like.
          </p>
          <p className="font-[family-name:var(--font-body)] text-xs text-muted-foreground mb-5 tabular-nums">
            {fastingWindowLabel(fastingWindow)} — {fastHours}h fast, {eatHours}h eat
          </p>

          <button
            type="button"
            onClick={startFast}
            data-testid="fasting-landing-start"
            className="w-full max-w-xs font-[family-name:var(--font-body)] font-semibold text-base rounded-full py-4 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Start {fastingWindowLabel(fastingWindow)} fast
          </button>

          {/* Quick-start chips — one tap = set window + start fast. */}
          <div
            className="flex gap-2 mt-4 justify-center flex-wrap"
            data-testid="fasting-landing-chips"
          >
            {(["16:8", "18:6", "23:1"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => quickStartFast(w)}
                aria-label={`Start a ${fastingWindowLabel(w)} fast`}
                data-testid={`fasting-landing-chip-${fastingWindowLabel(w)}`}
                className="font-[family-name:var(--font-label)] px-4 py-2 rounded-full text-[13px] font-semibold border border-border bg-card text-muted-foreground hover:bg-muted/40 transition-colors tabular-nums"
              >
                {fastingWindowLabel(w)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent fasts — last 5 completed. Empty state collapses the
          section entirely. */}
      {recentCompleted.length > 0 && (
        <section
          className="bg-card border border-border rounded-2xl p-5 space-y-2"
          data-testid="fasting-history"
        >
          <p className="font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
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
                  <span className="font-[family-name:var(--font-body)] text-muted-foreground">
                    {start.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-[family-name:var(--font-body)] font-semibold text-foreground tabular-nums">
                    {fd.hours}h {String(fd.minutes).padStart(2, "0")}m
                    <span className="font-normal text-muted-foreground ml-2">
                      / {rowGoalHours}h
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
