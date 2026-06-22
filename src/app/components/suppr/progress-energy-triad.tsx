"use client";

/**
 * ProgressEnergyTriad — Sloe Figma `492:2` AVG INTAKE / EST. TDEE / DEFICIT
 * three-cell row.
 *
 * Three separate cream cells (not one divided card, per the frame):
 *   - AVG INTAKE — range avg calories/day.
 *   - EST. TDEE — resolved maintenance; SAGE value + "ADAPTIVE" sub-label
 *     when the engine value won (else "FORMULA").
 *   - DEFICIT — maintenance − avg intake; the result reads in PLUM (the brand
 *     headline accent, matching the v3 prototype's Progress energy-balance
 *     `deficit → var(--primary-active)`, Sloe-App.html L5010), AMBER "surplus"
 *     when intake exceeds maintenance. NB: differs from the Today NetEnergy card
 *     where a *deficit is the good state* and reads sage.
 *
 * All numbers are real (range stats + resolved maintenance). Cells render
 * "—" when the underlying value isn't available yet — never fabricated.
 *
 * Mirror: `apps/mobile/components/progress/ProgressEnergyTriad.tsx`.
 */

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SupprCard } from "../ui/suppr-card";
import { isFeatureEnabled } from "../../../lib/analytics/track";

export interface ProgressEnergyTriadProps {
  /** Range average calories/day. Null → "—". */
  avgIntakeKcal: number | null;
  /** Resolved maintenance (TDEE) kcal. Null → "—". */
  maintenanceKcal: number | null;
  /** True when the resolved maintenance is the adaptive (engine) value. */
  isAdaptive: boolean;
  className?: string;
}

function Cell({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <SupprCard
      data-testid={testId}
      // One-card-treatment soft lift (2026-06-09): each triad cell is its own
      // page-ground card (not nested), so all three take the soft lift. Mirrors
      // mobile `lift="soft"`.
      elevation="card"
      padding="none"
      radius="lg"
      className="flex-1 flex flex-col items-center justify-center text-center px-2 py-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </SupprCard>
  );
}

export function ProgressEnergyTriad({
  avgIntakeKcal,
  maintenanceKcal,
  isAdaptive,
  className,
}: ProgressEnergyTriadProps) {
  const deficitKcal =
    avgIntakeKcal != null && maintenanceKcal != null && maintenanceKcal > 0
      ? Math.round(maintenanceKcal - avgIntakeKcal)
      : null;
  const isSurplus = deficitKcal != null && deficitKcal < 0;

  // Sloe v3 (ENG-1225 #23): the prototype's Progress energy balance is an
  // EQUATION (intake − maintenance = deficit/day) with a "How maintenance works"
  // explainer, not a 3-cell triad (Sloe-App.html L5001-5018). Transient flag;
  // the triad stays in the else until collapsed.
  if (isFeatureEnabled("sloe_v3_energy_equation")) {
    return (
      <ProgressEnergyEquation
        avgIntakeKcal={avgIntakeKcal}
        maintenanceKcal={maintenanceKcal}
        deficitKcal={deficitKcal}
        isSurplus={isSurplus}
        isAdaptive={isAdaptive}
        className={className}
      />
    );
  }

  return (
    <div
      data-testid="progress-energy-triad"
      className={["flex gap-2", className].filter(Boolean).join(" ")}
    >
      <Cell label="Avg intake" testId="progress-energy-avg-intake">
        <p className="mt-1.5 text-[18px] font-bold tabular-nums text-foreground">
          {avgIntakeKcal != null ? avgIntakeKcal.toLocaleString() : "—"}
        </p>
      </Cell>
      <Cell label="Est. TDEE" testId="progress-energy-tdee">
        <p
          className="mt-1.5 text-[18px] font-bold tabular-nums"
          style={{ color: "var(--accent-success-solid)" }}
        >
          {maintenanceKcal != null && maintenanceKcal > 0
            ? maintenanceKcal.toLocaleString()
            : "—"}
        </p>
        {maintenanceKcal != null && maintenanceKcal > 0 ? (
          <p
            className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--accent-success-solid)" }}
          >
            {isAdaptive ? "Adaptive" : "Formula"}
          </p>
        ) : null}
      </Cell>
      <Cell label="Deficit" testId="progress-energy-deficit">
        <p
          className="mt-1.5 text-[18px] font-bold tabular-nums"
          style={{
            color: isSurplus
              ? "var(--warning)"
              : deficitKcal != null && deficitKcal > 0
                ? "var(--primary)"
                : "var(--foreground)",
          }}
        >
          {deficitKcal != null
            ? deficitKcal > 0
              ? `−${deficitKcal.toLocaleString()}`
              : deficitKcal === 0
                ? "0"
                : `+${Math.abs(deficitKcal).toLocaleString()}`
            : "—"}
        </p>
        {isSurplus ? (
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-warning">
            Surplus
          </p>
        ) : null}
      </Cell>
    </div>
  );
}

/**
 * ProgressEnergyEquation — the v3 energy-balance equation
 * (`intake − maintenance = deficit/day`) + a "How maintenance works"
 * explainer, per `Sloe-App.html` L5001-5018. Maintenance reads sage, the
 * deficit result reads plum (surplus → amber) — same token roles as the triad.
 * The prototype's `2,260 → maintenance` adapt-row is intentionally omitted:
 * the formula-baseline value isn't passed to this component, and inventing one
 * would be a fabricated number (the explainer states the adapt behaviour in
 * words instead).
 */
function ProgressEnergyEquation({
  avgIntakeKcal,
  maintenanceKcal,
  deficitKcal,
  isSurplus,
  isAdaptive,
  className,
}: {
  avgIntakeKcal: number | null;
  maintenanceKcal: number | null;
  deficitKcal: number | null;
  isSurplus: boolean;
  isAdaptive: boolean;
  className?: string;
}) {
  const [showHow, setShowHow] = React.useState(false);
  const hasMaintenance = maintenanceKcal != null && maintenanceKcal > 0;
  const resultValue =
    deficitKcal == null
      ? "—"
      : deficitKcal > 0
        ? `−${deficitKcal.toLocaleString()}`
        : deficitKcal === 0
          ? "0"
          : `+${Math.abs(deficitKcal).toLocaleString()}`;
  const resultColor = isSurplus
    ? "var(--warning)"
    : deficitKcal != null && deficitKcal > 0
      ? "var(--primary)"
      : "var(--foreground)";

  return (
    <SupprCard
      data-testid="progress-energy-equation"
      elevation="card"
      radius="lg"
      padding="lg"
      className={className}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Energy balance · 7-day average
      </p>
      <div className="mt-3 flex items-end justify-between gap-1">
        <EqTerm label="Avg intake" value={avgIntakeKcal != null ? avgIntakeKcal.toLocaleString() : "—"} />
        <EqOp>−</EqOp>
        <EqTerm label="Maintenance" value={hasMaintenance ? maintenanceKcal!.toLocaleString() : "—"} color="var(--accent-success-solid)" />
        <EqOp>=</EqOp>
        <EqTerm label={isSurplus ? "Surplus/day" : "Deficit/day"} value={resultValue} color={resultColor} />
      </div>
      <button
        type="button"
        onClick={() => setShowHow((v) => !v)}
        aria-expanded={showHow}
        data-testid="progress-energy-how"
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary-solid hover:opacity-80"
      >
        How maintenance works
        {showHow ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      {showHow ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Maintenance (your TDEE) is what you&apos;d burn on a normal day. Sloe
          starts from a formula, then{" "}
          <span className="font-semibold text-foreground">adapts</span> to your
          real weight trend and logging — so it gets truer the more you use it.
          {hasMaintenance ? (
            <>
              {" "}
              You&apos;re currently on the{" "}
              <span className="font-semibold text-foreground">
                {isAdaptive ? "adaptive estimate" : "formula estimate"}
              </span>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </SupprCard>
  );
}

function EqTerm({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-[18px] font-bold tabular-nums leading-none" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function EqOp({ children }: { children: React.ReactNode }) {
  return (
    <span className="pb-3 text-[18px] font-light text-muted-foreground" aria-hidden>
      {children}
    </span>
  );
}

export default ProgressEnergyTriad;
