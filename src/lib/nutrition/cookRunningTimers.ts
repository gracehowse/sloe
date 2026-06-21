import type { ParsedTimer } from "./recipeTimers";

/** A single concurrent cook-mode countdown (web + mobile parity, ENG-948). */
export type CookRunningTimer = {
  id: string;
  stepIndex: number;
  label: string;
  totalSeconds: number;
  /** Wall-clock end — survives background/visibility changes. */
  endsAtMs: number;
  remainingSeconds: number;
  done: boolean;
};

export function createRunningTimerId(
  stepIndex: number,
  parsed: ParsedTimer,
  nowMs = Date.now(),
): string {
  return `${stepIndex}:${parsed.startIndex}:${nowMs}`;
}

export function createRunningTimer(
  parsed: ParsedTimer,
  stepIndex: number,
  nowMs = Date.now(),
): CookRunningTimer {
  return {
    id: createRunningTimerId(stepIndex, parsed, nowMs),
    stepIndex,
    label: parsed.label,
    totalSeconds: parsed.totalSeconds,
    endsAtMs: nowMs + parsed.totalSeconds * 1000,
    remainingSeconds: parsed.totalSeconds,
    done: false,
  };
}

export type TickRunningTimersResult = {
  timers: CookRunningTimer[];
  changed: boolean;
  newlyCompleted: CookRunningTimer[];
};

/** Advance every running timer against wall clock; non-overlapping completion ids. */
export function tickRunningTimers(
  timers: CookRunningTimer[],
  nowMs: number,
  alreadyFiredIds: ReadonlySet<string>,
): TickRunningTimersResult {
  let changed = false;
  const newlyCompleted: CookRunningTimer[] = [];
  const next = timers.map((timer) => {
    if (timer.done) return timer;
    const remainingSeconds = Math.max(
      0,
      Math.ceil((timer.endsAtMs - nowMs) / 1000),
    );
    const done = remainingSeconds <= 0;
    if (remainingSeconds === timer.remainingSeconds && !done) {
      return timer;
    }
    changed = true;
    const updated: CookRunningTimer = {
      ...timer,
      remainingSeconds,
      done,
    };
    if (done && !alreadyFiredIds.has(timer.id)) {
      newlyCompleted.push(updated);
    }
    return updated;
  });
  return { timers: changed ? next : timers, changed, newlyCompleted };
}

export function resetRunningTimer(
  timers: CookRunningTimer[],
  id: string,
  nowMs = Date.now(),
): CookRunningTimer[] {
  return timers.map((timer) => {
    if (timer.id !== id) return timer;
    return {
      ...timer,
      endsAtMs: nowMs + timer.totalSeconds * 1000,
      remainingSeconds: timer.totalSeconds,
      done: false,
    };
  });
}

export function cancelRunningTimer(
  timers: CookRunningTimer[],
  id: string,
): CookRunningTimer[] {
  return timers.filter((timer) => timer.id !== id);
}
