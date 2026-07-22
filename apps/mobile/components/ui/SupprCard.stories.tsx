import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SupprCard } from "./SupprCard";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  title: "Mobile/UI/SupprCard",
  component: SupprCard,
  tags: ["autodocs", "chromatic"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    ...chromaticVisualContract.parameters,
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **Card** (mobile) — *the user's content*. White fill, radius 24, flat + hairline. Change this shell → every meals/data card changes. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof SupprCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  args: {
    children: <Text>Meals for today</Text>,
  },
};

export const Inset: Story = {
  args: {
    size: "inset",
    children: <Text>Nested inset panel (radius 12)</Text>,
  },
};

export const Tile: Story = {
  args: {
    size: "tile",
    children: <Text>Macro tile</Text>,
  },
};
