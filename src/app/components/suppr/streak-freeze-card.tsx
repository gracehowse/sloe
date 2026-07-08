"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import { SupprCard } from "../ui/suppr-card";
import type { FreezeLedger } from "../../../lib/nutrition/streakFreeze";

/**
 * StreakFreezeCard — the web-only "Streak freezes" card (Batch 4.11),
 * extracted out of `ProgressDashboard.tsx` (ENG-1372 slice 2) so the
 * zero-collapse addition didn't push that pinned 2550-line host over its
 * `scripts/screen-line-budget.json` ceiling.
 *
 * ENG-1372 slice 2 (law 3) — a card whose every figure is 0 is a
 * zero-triad: derived numbers with nothing behind them yet. When the user
 * hasn't earned their first freeze (Available/Earned/Used all 0), the grid
 * collapses to one explanatory row instead of "0 / 0 / 0". Folded onto the
 * SAME `empty_state_grammar_v1` flag slice 1 shipped — no new flag.
 *
 * Mobile has no equivalent standalone card — its own comment near the
 * freeze-ledger wiring in `apps/mobile/app/(tabs)/progress.tsx` notes the
 * streak + freeze figures surface only inside the Week Digest there. This
 * is a web-only fix; there is nothing to collapse on mobile because there
 * is no mobile zero-triad card to begin with.
 */

/** "Tue" / "Mar 12" compact date label for freeze-used rows. Uses the local
 *  Date constructor so it lines up with the device timezone shown on Today. */
function formatFreezeDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => Number.parseInt(n, 10));
  if (![y, m, d].every(Number.isFinite)) return dateKey;
  const dt = new Date(y, m - 1, d);
  const now = new Date();
  const daysAgo = Math.round((now.getTime() - dt.getTime()) / 86_400_000);
  if (daysAgo >= 0 && daysAgo < 7) {
    return dt.toLocaleDateString(undefined, { weekday: "short" });
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function FreezeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-[18px] font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export interface StreakFreezeCardProps {
  freezeBudgetMax: number;
  freezesAvailable: number;
  freezeLedger: FreezeLedger;
  protectedDateKeys: string[];
  rawStreakDays: number;
  streakDays: number;
  /** `empty_state_grammar_v1` — passed in rather than read internally so
   *  this component carries no gating logic of its own (slice-1 pattern:
   *  hosts gate, leaf components render). */
  emptyStateGrammarOn: boolean;
}

export function StreakFreezeCard({
  freezeBudgetMax,
  freezesAvailable,
  freezeLedger,
  protectedDateKeys,
  rawStreakDays,
  streakDays,
  emptyStateGrammarOn,
}: StreakFreezeCardProps) {
  if (freezeBudgetMax <= 0) return null;

  const noFreezesEarnedYet =
    freezesAvailable === 0 &&
    freezeLedger.earnedAt.length === 0 &&
    freezeLedger.usedHistory.length === 0;
  const showZeroCollapse = noFreezesEarnedYet && emptyStateGrammarOn;

  return (
    <SupprCard elevation="card" padding="lg" radius="lg" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <IconBox size="sm" tone="primary"><Icons.streakFreeze /></IconBox>
        <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand">Streak freezes</p>
      </div>
      {showZeroCollapse ? (
        <p data-testid="streak-freeze-zero-collapse" className="text-xs text-muted-foreground">
          Log 7 days in a row to earn your first streak freeze.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {`Freezes cover one empty day each so a sick or travel day doesn’t break your streak. You earn one every 7-day streak, up to a cap of ${freezeBudgetMax}.`}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <FreezeStat label="Available" value={String(freezesAvailable)} />
            <FreezeStat label="Earned" value={String(freezeLedger.earnedAt.length)} />
            <FreezeStat label="Used" value={String(freezeLedger.usedHistory.length)} />
          </div>
          {protectedDateKeys.length > 0 ? (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Recent freezes used
              </p>
              <ul className="space-y-1">
                {protectedDateKeys.slice(0, 3).map((k) => (
                  <li key={k} className="text-xs text-muted-foreground tabular-nums">
                    Freeze used ({formatFreezeDate(k)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rawStreakDays !== streakDays ? (
            <p className="text-[11px] text-muted-foreground mt-2">
              {`Raw streak (without freezes): ${rawStreakDays} day${rawStreakDays === 1 ? "" : "s"}.`}
            </p>
          ) : null}
        </>
      )}
    </SupprCard>
  );
}

export default StreakFreezeCard;
