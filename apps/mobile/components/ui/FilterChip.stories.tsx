import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { FilterChip } from "./FilterChip";

const meta = {
  title: "Mobile/UI/FilterChip",
  component: FilterChip,
  tags: ["autodocs"],
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
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **Chip** — §7 filter/option chip. Quiet card fill at rest; selected = primary-soft + primary-solid label. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  args: {
    label: "High protein",
    selected: false,
    onPress: () => undefined,
  },
};

export const Selected: Story = {
  args: {
    label: "High protein",
    selected: true,
    onPress: () => undefined,
  },
};

export const Disabled: Story = {
  args: {
    label: "High protein",
    selected: false,
    disabled: true,
    onPress: () => undefined,
  },
};

export const MediumOnSecondary: Story = {
  args: {
    label: "Metric",
    selected: true,
    size: "md",
    restFill: "secondary",
    onPress: () => undefined,
  },
};
