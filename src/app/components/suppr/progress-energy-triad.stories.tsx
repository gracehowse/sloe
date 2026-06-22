import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressEnergyTriad } from "./progress-energy-triad";

/**
 * ProgressEnergyTriad — AVG INTAKE / EST. TDEE / DEFICIT row. Pins the v3
 * token roles (ENG-1225): EST. TDEE + a real deficit read in SAGE
 * (`--accent-success-solid`), a surplus in AMBER (`--warning`). Guards the
 * regression where the recolour turned the `sage` alias plum.
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
