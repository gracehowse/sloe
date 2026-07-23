import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CookMode } from "./CookMode";
import {
  HostProductShell,
  HostStoryProviders,
  cookModeIngredients,
  cookModeSteps,
  noop,
  recipeCard,
} from "./_hostStoryFixtures";

/**
 * CookMode — step-by-step cook surface. Props carry recipe + steps; AppData is
 * only needed for meal logging / cook-history (noop without auth in Storybook).
 */
const meta = {
  title: "Hosts/CookMode",
  component: CookMode,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Immersive cook-mode overlay — scaled steps, timers, mise en place, log meal.",
      },
    },
  },
  decorators: [
    (Story) => (
      <HostStoryProviders>
        <HostProductShell>
          <Story />
        </HostProductShell>
      </HostStoryProviders>
    ),
  ],
  args: {
    recipe: recipeCard("story-miso-salmon", "Miso salmon traybake"),
    instructionSteps: cookModeSteps,
    ingredients: cookModeIngredients,
    servings: 2,
    baseServings: 4,
    onExit: noop,
    onViewTracker: noop,
  },
} satisfies Meta<typeof CookMode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {
  name: "First step",
};
