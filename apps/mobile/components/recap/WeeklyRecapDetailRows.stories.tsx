import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeeklyRecapDetailRows } from "./WeeklyRecapDetailRows";
import { DIGEST_SUCCESS_ARGS } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/WeeklyRecapDetailRows",
  component: WeeklyRecapDetailRows,
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
  args: { stats: DIGEST_SUCCESS_ARGS.stats, narrative: DIGEST_SUCCESS_ARGS.narrative },
} satisfies Meta<typeof WeeklyRecapDetailRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const NoWeight: Story = { args: { stats: { ...DIGEST_SUCCESS_ARGS.stats, weightDeltaKg: null } } };
