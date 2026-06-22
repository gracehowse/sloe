import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { ProgressEnergyTriad } from "./progress-energy-triad";

/**
 * ProgressEnergyTriad — AVG INTAKE / EST. TDEE / DEFICIT row. Pins the v3
 * token roles (ENG-1225): EST. TDEE reads SAGE (`--accent-success-solid`); a
 * real DEFICIT reads PLUM (`--primary`, the brand headline accent, per the v3
 * Progress energy-balance prototype L5010); a SURPLUS reads AMBER
 * (`--warning`). Guards the recolour regression (the `sage` alias was plum) and
 * the over-correction (deficit briefly went sage; it's the plum result number).
 */
const meta = {
  title: "Suppr/ProgressEnergyTriad",
  component: ProgressEnergyTriad,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressEnergyTriad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit: Story = {
  name: "Deficit (sage)",
  args: { avgIntakeKcal: 1800, maintenanceKcal: 2200, isAdaptive: true },
};

export const Surplus: Story = {
  name: "Surplus (amber)",
  args: { avgIntakeKcal: 2400, maintenanceKcal: 2200, isAdaptive: false },
};

export const Maintenance: Story = {
  name: "At maintenance",
  args: { avgIntakeKcal: 2200, maintenanceKcal: 2200, isAdaptive: true },
};

/**
 * v3 equation layout (ENG-1225 #23): `intake − maintenance = deficit/day` +
 * a "How maintenance works" explainer, behind `sloe_v3_energy_equation`.
 * Forced on via `__SUPPR_FORCE_FLAGS__` (dev resolver in track.ts).
 */
function ForceEquation({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { ...(w.__SUPPR_FORCE_FLAGS__ ?? {}), sloe_v3_energy_equation: true };
  }
  return <>{children}</>;
}

export const EquationDeficit: Story = {
  name: "Equation — deficit",
  decorators: [(Story) => <ForceEquation><Story /></ForceEquation>],
  args: { avgIntakeKcal: 1800, maintenanceKcal: 2200, isAdaptive: true },
};

export const EquationSurplus: Story = {
  name: "Equation — surplus",
  decorators: [(Story) => <ForceEquation><Story /></ForceEquation>],
  args: { avgIntakeKcal: 2400, maintenanceKcal: 2200, isAdaptive: false },
};
