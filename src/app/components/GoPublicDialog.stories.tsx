import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoPublicDialog } from "./GoPublicDialog";

const meta = {
  title: "Host/GoPublicDialog",
  component: GoPublicDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recipe publish attestation dialog — three checkboxes must be ticked before Publish enables.",
      },
    },
  },
  args: {
    recipeTitle: "Roast chicken with lemon potatoes",
    onConfirmPublish: () => undefined,
    onAutoOpenClose: () => undefined,
  },
} satisfies Meta<typeof GoPublicDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Force-open path used by RecipeDetail meatball menu hosts. */
export const Open: Story = {
  args: {
    autoOpen: true,
  },
};

export const WithTrigger: Story = {
  name: "With trigger button",
  args: {
    autoOpen: false,
    triggerLabel: "Go public",
  },
};

export const DisabledTrigger: Story = {
  name: "Disabled trigger",
  args: {
    autoOpen: false,
    disabled: true,
  },
};
