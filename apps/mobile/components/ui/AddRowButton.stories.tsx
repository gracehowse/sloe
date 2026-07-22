import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { AddRowButton } from "./AddRowButton";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  title: "Mobile/UI/AddRowButton",
  component: AddRowButton,
  tags: ["autodocs", ...chromaticVisualContract.tags],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div
          style={{
            width: 360,
            padding: 16,
            background: "#F7F6FA",
            borderRadius: 24,
            border: "1px solid #E5E4EA",
          }}
        >
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
          "Anatomy role **AddRow** (mobile) — inset action row (radius 12) inside a Card. Left-aligned panel form under `ui_anatomy_owners_v1` so it doesn't read as a squashed pill.",
      },
    },
  },
} satisfies Meta<typeof AddRowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddFood: Story = {
  args: { label: "Add food", onPress: () => undefined },
};

export const Loading: Story = {
  args: { label: "Add ingredient", loading: true },
};

export const Disabled: Story = {
  args: { label: "Add food", disabled: true },
};
