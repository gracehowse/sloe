"use client";

/**
 * Build-40 (2026-05-01) — onboarding terminal step (web mirror).
 *
 * Mobile counterpart at
 * `apps/mobile/components/onboarding/steps/data-bridges.tsx`. The web
 * version is intentionally narrower than mobile: it omits the Apple
 * Health card (iOS-only, no equivalent web HealthKit surface), per
 * `project_ios_only_no_android.md` +
 * `feedback_mobile_decisions_apply_to_web.md`.
 *
 * Cards on web (4):
 *   1. Manual targets — paste-in 4-input form (MFP / MacroFactor refugee)
 *   2. Notifications — browser push (kept simple — `permissions.tsx`
 *      step's existing logic is the right level)
 *   3. Recipe URL — preserves the legacy `import.tsx` parser flow
 *   4. MFP CSV — bulk-import history (added 2026-05-02; closes the
 *      MFP-refugee history-bridge gap surfaced in customer-lens P1)
 *
 * Plus the same "Maybe later" affordance as mobile so the user can
 * advance the empty path. `dataBridgeChosen` is captured for analytics.
 */

import * as React from "react";
import { Bell, Calculator, Check, Link2, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { MfpCsvImportCard } from "@/app/components/imports/MfpCsvImportCard";

export function DataBridgesStep() {
  const overline = useStepOverline();

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Bring your data with you"
        subtitle="Skip any of these — or all of them. You can always set this up later in Settings."
      />

      <div className="flex flex-col gap-3">
        <ManualTargetsCard />
        <NotificationsCard />
        <RecipeUrlCard />
        <MfpCsvImportCard surface="onboarding" />
      </div>

      {/*
        P1 (customer-lens 2026-05-11): the in-body "Maybe later" button
        was removed. It competed with the footer "Build my plan" CTA —
        two terminal actions on the same screen confused testers
        ("which one finishes setup?"). `canAdvance("data-bridges")`
        always returns true (see `src/lib/onboarding/state.ts`), so the
        footer "Build my plan" advances cleanly with zero cards touched.
        `dataBridgeChosen` stays null when nothing's picked, which the
        `onboarding_completed` event already reports as a first-class
        "skip" via its `data_bridge_chosen: null` value.
      */}
    </StepBody>
  );
}

/* ---------------------------------------------------------------- */
/* Manual targets card                                              */
/* ---------------------------------------------------------------- */

function ManualTargetsCard() {
  const { state, set } = useOnboarding();
  const [kcal, setKcal] = React.useState(
    state.manualTargetsKcal != null ? String(state.manualTargetsKcal) : "",
  );
  const [protein, setProtein] = React.useState(
    state.manualTargetsProteinG != null ? String(state.manualTargetsProteinG) : "",
  );
  const [carbs, setCarbs] = React.useState(
    state.manualTargetsCarbsG != null ? String(state.manualTargetsCarbsG) : "",
  );
  const [fat, setFat] = React.useState(
    state.manualTargetsFatG != null ? String(state.manualTargetsFatG) : "",
  );

  const commit = React.useCallback(() => {
    const k = Number(kcal);
    const p = Number(protein);
    const c = Number(carbs);
    const f = Number(fat);
    set({
      manualTargetsKcal: kcal && Number.isFinite(k) ? k : null,
      manualTargetsProteinG: protein && Number.isFinite(p) ? p : null,
      manualTargetsCarbsG: carbs && Number.isFinite(c) ? c : null,
      manualTargetsFatG: fat && Number.isFinite(f) ? f : null,
      dataBridgeChosen: "manual",
    });
    track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "manual" });
  }, [kcal, protein, carbs, fat, set]);

  return (
    <BridgeCard
      icon={<Calculator className="size-4" />}
      iconClassName="text-primary bg-primary/15"
      title="I already know my targets"
      body="Paste them in — we'll use these instead of the BMR estimate. You can re-calibrate any time in Settings."
    >
      <div className="grid grid-cols-4 gap-2 mt-3">
        <TargetInput label="kcal" value={kcal} onChange={setKcal} onBlur={commit} colorClass="text-primary" />
        <TargetInput label="P g" value={protein} onChange={setProtein} onBlur={commit} colorClass="text-[var(--macro-protein,oklch(0.6_0.18_180))]" />
        <TargetInput label="C g" value={carbs} onChange={setCarbs} onBlur={commit} colorClass="text-[var(--macro-carbs,oklch(0.7_0.15_50))]" />
        <TargetInput label="F g" value={fat} onChange={setFat} onBlur={commit} colorClass="text-[var(--macro-fat,oklch(0.65_0.16_25))]" />
      </div>
      <p className="mt-2 text-[11px] italic text-muted-foreground/70">
        Set all four to override; partial values are ignored.
      </p>
    </BridgeCard>
  );
}

function TargetInput({
  label,
  value,
  onChange,
  onBlur,
  colorClass,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  onBlur: () => void;
  colorClass: string;
}) {
  return (
    <div className="rounded-md border border-border bg-input-background px-3 py-2">
      <div className={`text-[10px] font-semibold uppercase tracking-[0.05em] ${colorClass}`}>
        {label}
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={`Manual ${label} target`}
        className="mt-1 w-full bg-transparent text-base font-bold tabular-nums text-foreground outline-none"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Notifications card (browser push)                                */
/* ---------------------------------------------------------------- */

function NotificationsCard() {
  const { state, set } = useOnboarding();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const granted = state.notifGranted === true;

  const onAllow = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setError("Notifications aren't supported in this browser.");
        set({ notifGranted: false });
        return;
      }
      const result = await window.Notification.requestPermission();
      if (result === "granted") {
        set({ notifGranted: true, dataBridgeChosen: "notifications" });
        track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "notifications" });
      } else {
        set({ notifGranted: false });
        setError("Notifications are off. You can enable them in your browser settings.");
      }
    } catch (e) {
      set({ notifGranted: false });
      setError(e instanceof Error ? e.message : "Couldn't request notifications.");
    } finally {
      setBusy(false);
    }
  }, [busy, set]);

  return (
    <BridgeCard
      icon={<Bell className="size-4" />}
      iconClassName="text-amber-500 bg-amber-500/15"
      title="Gentle reminders"
      body="Off-target evening nudge + a Sunday recap. Two notifications max per week."
      grantedBadge={granted ? "On" : null}
    >
      {error ? (
        <p className="mt-2 text-[11px] text-amber-500">{error}</p>
      ) : null}
      {!granted ? (
        <Button
          type="button"
          size="sm"
          onClick={() => void onAllow()}
          disabled={busy}
          className="mt-3 h-9"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : "Turn on"}
        </Button>
      ) : null}
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Recipe URL card                                                  */
/* ---------------------------------------------------------------- */

function RecipeUrlCard() {
  return (
    <BridgeCard
      icon={<Link2 className="size-4" />}
      iconClassName="text-emerald-500 bg-emerald-500/15"
      title="Recipe import"
      body="Suppr parses Instagram, TikTok, blog, and YouTube links — ingredients matched against USDA / OFF."
      grantedBadge={null}
    >
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Try it after setup — open the Library tab and tap the Import button to
        paste a link, or share any recipe to Suppr from inside Instagram /
        TikTok / your browser.
      </p>
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Shared bridge-card chrome                                        */
/* ---------------------------------------------------------------- */

function BridgeCard({
  icon,
  iconClassName,
  title,
  body,
  grantedBadge,
  children,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  body: string;
  grantedBadge?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 ${
        grantedBadge ? "border-emerald-500/40" : "border-border"
      }`}
    >
      <div className="flex gap-3 items-start">
        <div
          className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-bold text-foreground tracking-tight">
              {title}
            </h3>
            {grantedBadge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                <Check className="size-2.5" />
                {grantedBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

