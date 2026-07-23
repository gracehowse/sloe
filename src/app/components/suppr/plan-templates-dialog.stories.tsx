import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanTemplatesDialog } from "./plan-templates-dialog";
import type { PlanTemplate } from "../../../lib/nutrition/planTemplates";

const SAMPLE_TEMPLATES: PlanTemplate[] = [
  {
    id: "tpl_1",
    userId: "user_demo",
    name: "Bulk week",
    dayCount: 7,
    slots: [
      {
        dayIndex: 0,
        slot: "Breakfast",
        recipeTitle: "Protein oats",
        calories: 420,
        protein: 28,
        carbs: 48,
        fat: 12,
        servings: 1,
        portionMultiplier: 1,
      },
    ],
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "tpl_2",
    userId: "user_demo",
    name: "Light weekdays",
    dayCount: 5,
    slots: [],
    createdAt: "2026-06-15T10:00:00.000Z",
    updatedAt: "2026-06-15T10:00:00.000Z",
  },
];

const meta = {
  title: "Suppr/PlanTemplatesDialog",
  component: PlanTemplatesDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Save a plan slice as a template or apply/delete saved templates.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    sourceMealCount: 12,
    maxDayCount: 7,
    templates: SAMPLE_TEMPLATES,
    loading: false,
    onSave: async () => ({ ok: true }),
    onApply: () => undefined,
    onDelete: async () => ({ ok: true }),
  },
} satisfies Meta<typeof PlanTemplatesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SaveMode: Story = {};

export const TemplatesList: Story = {
  args: {
    sourceMealCount: 0,
    templates: SAMPLE_TEMPLATES,
  },
};
