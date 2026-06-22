import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
