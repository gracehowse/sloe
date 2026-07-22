import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TargetsMaintenanceRow } from "./targets-maintenance-row";
import type { ResolvedMaintenance } from "../../../lib/nutrition/resolveMaintenance";

const formulaResolved: ResolvedMaintenance = {
  kcal: 2200,
  source: "formula",
  confidence: null,
  formulaKcal: 2200,
  adaptiveRejectedAsStale: false,
  adaptiveRejectedBelowFormula: false,
  rejectedAdaptiveKcal: null,
  measuredRejectedBelowFormula: false,
  rejectedMeasuredKcal: null,
};

const adaptiveResolved: ResolvedMaintenance = {
  kcal: 2350,
  source: "adaptive",
  confidence: "medium",
  formulaKcal: 2200,
  adaptiveRejectedAsStale: false,
  adaptiveRejectedBelowFormula: false,
  rejectedAdaptiveKcal: null,
  measuredRejectedBelowFormula: false,
  rejectedMeasuredKcal: null,
};

const meta = {
  title: "Suppr/TargetsMaintenanceRow",
  component: TargetsMaintenanceRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TargetsMaintenanceRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FormulaEstimate: Story = {
  args: { resolved: formulaResolved },
};

export const AdaptiveLearned: Story = {
  args: { resolved: adaptiveResolved },
};
