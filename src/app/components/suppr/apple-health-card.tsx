"use client";

/**
 * AppleHealthCard (web) — D4 implementation of the Apple Health card
 * per `docs/design/apple-health-card.md`.
 *
 * Web has no HealthKit. The card reads whatever the iOS app last wrote
 * to `health_snapshots` via `getLatestHealthSnapshot(userId)` and shows
 * the same four rows as mobile (Steps / Active energy / Resting burn /
 * Weight). All 7 states from §5 of the brief are covered here:
 * loading, empty-never-synced, partial, error, stale, offline (treated
 * as stale), success.
 *
 * This component is deliberately "dumb" about its data source —
 * the caller passes a `fetchSnapshot` function so server-rendered
 * Progress and tests can both exercise it without touching a Supabase
 * client directly.
 */

import * as React from "react";
import { Footprints, Flame, HeartPulse, Scale } from "lucide-react";
import {
  formatHealthSnapshotSyncedAgo,
  isHealthSnapshotStale,
  type HealthSnapshot,
} from "@/lib/health/healthSnapshots";

export interface AppleHealthCardProps {
  /** Caller-supplied fetcher. Returning `null` means the iOS app has
   *  never synced for this account (empty state). Throwing triggers
   *  the error state. */
  fetchSnapshot: () => Promise<HealthSnapshot | null>;
  /** User preferred unit for weight. */
  useImperial?: boolean;
  /** Link target for the "Get the app" link in the empty state. */
  getTheAppHref?: string;
  /** Clock override for deterministic tests. */
  nowProvider?: () => Date;
  className?: string;
}

type CardState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; snapshot: HealthSnapshot };

function formatWeight(kg: number | null, imperial: boolean): string {
  if (kg == null) return "—";
  if (imperial) return `${(kg * 2.20462).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

function formatKcal(v: number | null): string {
  return v == null ? "—" : `${v.toLocaleString()} kcal`;
}

function formatSteps(v: number | null): string {
  return v == null ? "—" : v.toLocaleString();
}

const METHODOLOGY_LINE =
  "Based on your resting rate so far today. Activity bonus may be added if your total burn exceeds the TDEE estimate.";

export function AppleHealthCard({
  fetchSnapshot,
  useImperial = false,
  getTheAppHref = "/landing",
  nowProvider,
  className,
}: AppleHealthCardProps) {
  const [state, setState] = React.useState<CardState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setState(snapshot ? { kind: "ready", snapshot } : { kind: "empty" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshot, reloadKey]);

  const shell = (children: React.ReactNode, extra?: React.ReactNode) => (
    <section
      aria-label="Apple Health"
      className={`rounded-card bg-card border border-border p-4 max-w-[480px] card-elevated ${className ?? ""}`}
      data-testid="apple-health-card"
    >
      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        Apple Health
      </h3>
      {children}
      {extra}
    </section>
  );

  if (state.kind === "loading") {
    return shell(
      <ul className="divide-y divide-border/60" data-testid="apple-health-card-loading">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 py-[10px] first:pt-0 last:pb-0"
          >
            <span className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
            <span className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
          </li>
        ))}
      </ul>,
    );
  }

  if (state.kind === "empty") {
    return shell(
      <div
        data-testid="apple-health-card-empty"
        className="py-2 text-[13px] text-muted-foreground leading-relaxed"
      >
        Sync from the Sloe app to see your health data here.{" "}
        <a href={getTheAppHref} className="underline text-foreground/80 hover:text-foreground">
          Get the app
        </a>
        .
      </div>,
    );
  }

  if (state.kind === "error") {
    return shell(
      <div
        data-testid="apple-health-card-error"
        className="py-2 text-[13px] text-muted-foreground"
      >
        Couldn&apos;t load Apple Health data.{" "}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="underline text-foreground/80 hover:text-foreground"
          data-testid="apple-health-card-retry"
        >
          Retry
        </button>
      </div>,
    );
  }

  const { snapshot } = state;
  const now = nowProvider ? nowProvider() : new Date();
  const stale = isHealthSnapshotStale(snapshot.capturedAt, now);
  const syncedAgo = formatHealthSnapshotSyncedAgo(snapshot.capturedAt, now);

  // Partial hint: for the weight row only, when a user hasn't weighed in
  // we show "No weigh-in today" rather than leaving the dash unexplained.
  const rows: Array<{
    key: string;
    icon: React.ReactNode;
    iconClass: string;
    label: string;
    value: string;
    hint?: string;
  }> = [
    {
      key: "steps",
      icon: <Footprints size={16} aria-hidden />,
      iconClass: "bg-muted text-muted-foreground",
      label: "Steps",
      value: formatSteps(snapshot.steps),
    },
    {
      key: "active",
      icon: <Flame size={16} aria-hidden />,
      iconClass: "bg-warning-soft text-warning",
      label: "Active energy",
      value: formatKcal(snapshot.activeEnergyKcal),
    },
    {
      key: "resting",
      icon: <HeartPulse size={16} aria-hidden />,
      iconClass: "bg-macro-fat-soft text-macro-fat",
      label: "Resting burn",
      value: formatKcal(snapshot.restingBurnKcal),
    },
    {
      key: "weight",
      icon: <Scale size={16} aria-hidden />,
      iconClass: "bg-macro-protein-soft text-macro-protein",
      label: "Weight",
      value: formatWeight(snapshot.weightKg, useImperial),
      hint: snapshot.weightKg == null ? "No weigh-in today" : undefined,
    },
  ];

  const footer = (
    <p
      className="text-[11px] text-muted-foreground mt-[10px] leading-relaxed"
      data-testid="apple-health-card-footer"
    >
      {stale ? <span data-testid="apple-health-card-stale">Last synced {syncedAgo} ago · </span> : null}
      {METHODOLOGY_LINE}
    </p>
  );

  return shell(
    <ul className="divide-y divide-border/60" data-testid="apple-health-card-rows">
      {rows.map((row) => {
        const missing = row.value === "—";
        return (
          <li
            key={row.key}
            className="flex items-center justify-between gap-3 py-[10px] first:pt-0 last:pb-0"
            data-testid={`apple-health-row-${row.key}`}
          >
            <div className="flex items-center gap-[10px] min-w-0">
              <span
                className={`inline-flex items-center justify-center size-7 rounded-lg ${row.iconClass}`}
                aria-hidden
              >
                {row.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] text-muted-foreground">{row.label}</div>
                {row.hint ? (
                  <div className="text-[11px] text-muted-foreground/80">{row.hint}</div>
                ) : null}
              </div>
            </div>
            <span
              className={`text-[13px] font-bold tabular-nums ${
                missing ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {row.value}
            </span>
          </li>
        );
      })}
    </ul>,
    footer,
  );
}
