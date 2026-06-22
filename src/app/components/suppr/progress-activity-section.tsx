"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { AppleHealthCard } from "./apple-health-card";
import { SupprButton } from "./suppr-button";
import { SupprCard } from "../ui/suppr-card";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { todayKey } from "@/lib/nutrition/trackerDate";
import type { HealthSnapshot } from "@/lib/health/healthSnapshots";

/**
 * ProgressActivitySection — the "activity feeding maintenance" block on web
 * Progress. Extracted from `ProgressDashboard` (ENG-1225, gap #21) so the swap
 * doesn't grow that pinned host.
 *
 * Behind `web_apple_health_card` (transient): the v3 read-only `AppleHealthCard`
 * (Steps / Active energy / Resting burn / Weight, synced from the iOS app) —
 * matching mobile, which already ships the card. Flag OFF keeps the legacy
 * manual Steps + Body-Fat input cards alive so nothing is lost until the flag
 * ramps and the manual-entry collapse is decided. Mobile mirror:
 * `apps/mobile/components/AppleHealthCard.tsx` (already wired into Progress).
 */
export interface ProgressActivitySectionProps {
  // v3 Apple Health card
  fetchSnapshot: () => Promise<HealthSnapshot | null>;
  useImperial: boolean;
  // Legacy manual inputs (flag-off fallback)
  stepsByDay: Record<string, number>;
  dailyStepsGoal: number;
  stepsChartData: { date: string; value: number }[];
  stepsInput: string;
  setStepsInput: (v: string) => void;
  saveTodaySteps: () => void | Promise<void>;
  bodyFatPct: number | null;
  bodyFatInput: string;
  setBodyFatInput: (v: string) => void;
  saveBodyFat: () => void | Promise<void>;
}

export function ProgressActivitySection({
  fetchSnapshot,
  useImperial,
  stepsByDay,
  dailyStepsGoal,
  stepsChartData,
  stepsInput,
  setStepsInput,
  saveTodaySteps,
  bodyFatPct,
  bodyFatInput,
  setBodyFatInput,
  saveBodyFat,
}: ProgressActivitySectionProps) {
  if (isFeatureEnabled("web_apple_health_card")) {
    return (
      <AppleHealthCard
        fetchSnapshot={fetchSnapshot}
        useImperial={useImperial}
        className="mb-6"
      />
    );
  }

  return (
    <>
      {/* STEPS */}
      <SupprCard elevation="card" padding="lg" radius="lg" className="mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Steps</p>
        <div className="flex gap-6 mb-3">
          {/* SLOE Phase 0: the Steps today/goal big stat numerals read in the
              Newsreader serif display face; the labels below stay sans. */}
          <div className="text-center">
            <p className="font-[family-name:var(--font-headline)] text-[22px] font-medium text-foreground tabular-nums">{(stepsByDay[todayKey()] ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Today</p>
          </div>
          <div className="text-center">
            <p className="font-[family-name:var(--font-headline)] text-[22px] font-medium text-success tabular-nums">{dailyStepsGoal.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Goal</p>
          </div>
        </div>
        {stepsChartData.length >= 2 && (
          <div className="mb-3">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stepsChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <ReferenceLine y={dailyStepsGoal} stroke="var(--success)" strokeDasharray="4 4" />
                <Bar dataKey="value" fill="var(--success)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Steps today"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            type="number"
          />
          <SupprButton variant="ghost" onClick={() => void saveTodaySteps()}>Save</SupprButton>
        </div>
      </SupprCard>

      {/* BODY FAT */}
      <SupprCard elevation="card" padding="lg" radius="lg">
        <p className="text-sm font-semibold text-foreground mb-3">Body Fat</p>
        {/* ENG-534 (2026-05-16): body-fat % is HIGH-class. `ph-mask`
            makes PostHog session-replay render this as a grey block. */}
        {/* SLOE Phase 0: the body-fat hero stat reads in the Newsreader serif
            display face (big numerals are a serif moment). `ph-mask` preserved. */}
        <p className="font-[family-name:var(--font-headline)] text-[28px] font-medium leading-none text-foreground tabular-nums mb-3 ph-mask">{bodyFatPct != null ? `${Math.round(bodyFatPct * 10) / 10}%` : "—"}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Body fat %"
            value={bodyFatInput}
            onChange={(e) => setBodyFatInput(e.target.value)}
            type="number"
            step="0.1"
          />
          <SupprButton variant="ghost" onClick={() => void saveBodyFat()}>Save</SupprButton>
        </div>
      </SupprCard>
    </>
  );
}

export default ProgressActivitySection;
