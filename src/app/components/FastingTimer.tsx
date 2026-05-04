"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase/browserClient";
import { useAuthSession } from "../../context/AuthSessionContext";

type FastingSession = { start: string; end: string | null };

function parseFastingWindow(window: string): { fastHours: number; eatHours: number } {
  const parts = window.split(":");
  if (parts.length === 2) {
    const fast = parseInt(parts[0], 10);
    const eat = parseInt(parts[1], 10);
    if (!isNaN(fast) && !isNaN(eat)) return { fastHours: fast, eatHours: eat };
  }
  return { fastHours: 16, eatHours: 8 };
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const WINDOW_PRESETS = ["16:8", "18:6", "20:4", "14:10"];
const MAX_SESSIONS = 90;

export function FastingTimer() {
  const { authedUserId } = useAuthSession();
  const [fastingWindow, setFastingWindow] = useState("16:8");
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFast = sessions.find((s) => s.end === null);
  const { fastHours } = parseFastingWindow(fastingWindow);
  const fastMs = fastHours * 3600_000;

  const elapsed = activeFast ? now - new Date(activeFast.start).getTime() : 0;
  const progressPct = fastMs > 0 ? Math.min(100, (elapsed / fastMs) * 100) : 0;
  const remaining = Math.max(0, fastMs - elapsed);
  const isComplete = activeFast && elapsed >= fastMs;

  // Load from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authedUserId) {
        setLoading(false);
        return;
      }
      // try/finally so loading flips false even if supabase throws —
      // without this the panel sits on a perpetual spinner. Using
      // async/await rather than the promise-chain `.catch/.finally`
      // because supabase's PostgrestBuilder returns a PromiseLike,
      // which has `.then` only.
      try {
        const { data } = await supabase
          .from("profiles")
          .select("fasting_sessions, fasting_window, fasting_enabled")
          .eq("id", authedUserId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          if (Array.isArray(data.fasting_sessions)) setSessions(data.fasting_sessions as FastingSession[]);
          if (typeof data.fasting_window === "string") setFastingWindow(data.fasting_window);
        }
      } catch {
        // Network / RLS failure — leave defaults in place.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authedUserId]);

  // Live timer
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
    async (updated: FastingSession[], window?: string) => {
      if (!authedUserId) return;
      const trimmed = updated.slice(-MAX_SESSIONS);
      setSessions(trimmed);
      await supabase
        .from("profiles")
        .update({
          fasting_sessions: trimmed,
          ...(window != null ? { fasting_window: window } : {}),
        })
        .eq("id", authedUserId);
    },
    [authedUserId],
  );

  const startFast = () => {
    const next = [...sessions, { start: new Date().toISOString(), end: null }];
    void persist(next);
    setNow(Date.now());
  };

  const endFast = () => {
    const updated = sessions.map((s) =>
      s.end === null ? { ...s, end: new Date().toISOString() } : s,
    );
    void persist(updated);
  };

  const changeWindow = (w: string) => {
    setFastingWindow(w);
    void persist(sessions, w);
  };

  const recentCompleted = sessions
    .filter((s) => s.end !== null)
    .slice(-5)
    .reverse();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Intermittent Fasting</h3>
        <div className="flex gap-1">
          {WINDOW_PRESETS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => changeWindow(w)}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                fastingWindow === w
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      {activeFast ? (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-foreground">{formatDuration(elapsed)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isComplete ? "Fast complete!" : `${formatDuration(remaining)} remaining`}
            </p>
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressPct}%`,
                backgroundColor: isComplete ? "var(--success)" : "var(--primary)",
              }}
            />
          </div>
          <button
            type="button"
            onClick={endFast}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {isComplete ? "Complete Fast" : "End Fast Early"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startFast}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Start {fastingWindow} Fast
        </button>
      )}

      {/* Recent history */}
      {recentCompleted.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">Recent fasts</p>
          {recentCompleted.map((s, i) => {
            const start = new Date(s.start);
            const end = new Date(s.end!);
            const dur = end.getTime() - start.getTime();
            const hours = Math.round(dur / 3600_000 * 10) / 10;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="font-medium text-foreground tabular-nums">{hours}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
