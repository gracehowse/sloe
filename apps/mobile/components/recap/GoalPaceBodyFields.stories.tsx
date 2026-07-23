import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoalPaceBodyFields } from "./GoalPaceBodyFields";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/GoalPaceBodyFields",
  component: GoalPaceBodyFields,
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
  parameters: { layout: "fullscreen" },
  args: { sex: "female", age: 32, heightCm: 168, weightKg: 68, onChange: () => undefined },
} satisfies Meta<typeof GoalPaceBodyFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Imperial: Story = { args: { isImperial: true } };
