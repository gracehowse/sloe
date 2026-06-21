import { describe, expect, it } from "vitest";
import {
  cancelRunningTimer,
  createRunningTimer,
  resetRunningTimer,
  tickRunningTimers,
  type CookRunningTimer,
} from "@/lib/nutrition/cookRunningTimers";

const parsed = {
  label: "10 minutes",
  totalSeconds: 600,
  isRange: false,
  startIndex: 12,
  endIndex: 23,
};

describe("cookRunningTimers (ENG-948)", () => {
  it("creates a running timer with wall-clock end", () => {
    const timer = createRunningTimer(parsed, 2, 1_000);
    expect(timer.stepIndex).toBe(2);
    expect(timer.remainingSeconds).toBe(600);
    expect(timer.endsAtMs).toBe(601_000);
    expect(timer.done).toBe(false);
  });

  it("ticks remaining seconds down and marks completion once", () => {
    const timer = createRunningTimer(parsed, 0, 0);
    const fired = new Set<string>();
    const mid = tickRunningTimers([timer], 300_000, fired);
    expect(mid.changed).toBe(true);
    expect(mid.timers[0]?.remainingSeconds).toBe(300);
    expect(mid.newlyCompleted).toHaveLength(0);

    const done = tickRunningTimers(mid.timers, 600_000, fired);
    expect(done.timers[0]?.done).toBe(true);
    expect(done.newlyCompleted).toHaveLength(1);
    expect(fired.has(timer.id)).toBe(false);

    const again = tickRunningTimers(done.timers, 700_000, new Set([timer.id]));
    expect(again.newlyCompleted).toHaveLength(0);
  });

  it("resets and cancels without touching siblings", () => {
    const first = createRunningTimer(parsed, 0, 0);
    const second = createRunningTimer(
      { ...parsed, label: "5 minutes", totalSeconds: 300, startIndex: 30, endIndex: 40 },
      0,
      0,
    );
    const stack: CookRunningTimer[] = [first, second];
    const reset = resetRunningTimer(stack, first.id, 1_000);
    expect(reset[0]?.remainingSeconds).toBe(600);
    expect(reset[0]?.done).toBe(false);
    expect(reset[1]?.id).toBe(second.id);

    const cancelled = cancelRunningTimer(reset, first.id);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]?.id).toBe(second.id);
  });
});
