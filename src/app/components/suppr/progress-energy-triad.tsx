"use client";

/**
 * ProgressEnergyTriad — Sloe Figma `492:2` AVG INTAKE / EST. TDEE / DEFICIT
 * three-cell row.
 *
 * Three separate cream cells (not one divided card, per the frame):
 *   - AVG INTAKE — range avg calories/day.
 *   - EST. TDEE — resolved maintenance; SAGE value + "ADAPTIVE" sub-label
 *     when the engine value won (else "FORMULA").
 *   - DEFICIT — maintenance − avg intake; SAGE when a real deficit, AMBER
 *     "surplus" when intake exceeds maintenance.
 *
 * All numbers are real (range stats + resolved maintenance). Cells render
 * "—" when the underlying value isn't available yet — never fabricated.
 *
 * Mirror: `apps/mobile/components/progress/ProgressEnergyTriad.tsx`.
 */

import { SupprCard } from "../ui/suppr-card";

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
          style={{ color: "var(--macro-protein-solid)" }}
        >
          {maintenanceKcal != null && maintenanceKcal > 0
            ? maintenanceKcal.toLocaleString()
            : "—"}
        </p>
        {maintenanceKcal != null && maintenanceKcal > 0 ? (
          <p
            className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--macro-protein-solid)" }}
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
                ? "var(--macro-protein-solid)"
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

export default ProgressEnergyTriad;
