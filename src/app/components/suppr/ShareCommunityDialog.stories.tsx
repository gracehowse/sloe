import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FoodCorrectionInput } from "../../../lib/foodCorrection/submitFoodCorrection";
import { ShareCommunityDialog } from "./ShareCommunityDialog";

const SAMPLE_INPUT: FoodCorrectionInput = {
  barcode: "5056444701234",
  name: "Crunchy oat clusters",
  calories: 412,
  protein: 11,
  carbs: 58,
  fat: 14,
  fiberG: 8,
  servingSizeG: 100,
};

const meta = {
  title: "Suppr/ShareCommunityDialog",
  component: ShareCommunityDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dialog host for the barcode community-contribution opt-in after saving a custom food.",
      },
    },
  },
  args: {
    input: SAMPLE_INPUT,
    onShare: async () => ({ ok: true }),
    onClose: () => undefined,
  },
} satisfies Meta<typeof ShareCommunityDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    input: null,
  },
};
