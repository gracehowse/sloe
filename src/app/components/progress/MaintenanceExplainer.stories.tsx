import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { resolveMaintenance } from "@/lib/nutrition/resolveMaintenance";
import { MaintenanceExplainer } from "./MaintenanceExplainer";

const profile = {
  sex: "female" as const,
  weight_kg: 62,
  height_cm: 165,
  age: 34,
  activity_level: "sedentary" as const,
  adaptive_tdee: 1777,
  adaptive_tdee_confidence: "medium" as const,
  adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
};

const resolved = resolveMaintenance(profile, { now: new Date("2026-04-19T12:00:00Z") })!;

function MaintenanceExplainerDemo(
  props: Omit<ComponentProps<typeof MaintenanceExplainer>, "open" | "onToggle">,
) {
  const [open, setOpen] = useState(false);
  return <MaintenanceExplainer {...props} open={open} onToggle={() => setOpen((v) => !v)} />;
}

const meta = {
  title: "Suppr/Progress/MaintenanceExplainer",
  component: MaintenanceExplainerDemo,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    sex: profile.sex,
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    activityLevel: profile.activity_level,
    resolved,
    planPace: "relaxed",
    userGoal: "cut",
    goalCalories: 1650,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MaintenanceExplainerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

function MaintenanceExplainerExpandedDemo(
  props: Omit<ComponentProps<typeof MaintenanceExplainer>, "open" | "onToggle">,
) {
  const [open, setOpen] = useState(true);
  return <MaintenanceExplainer {...props} open={open} onToggle={() => setOpen((v) => !v)} />;
}

export const Collapsed: Story = {};

export const Expanded: Story = {
  render: (args) => <MaintenanceExplainerExpandedDemo {...args} />,
};
