import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RedesignTodayScreen } from "./RedesignTodayScreen";

const meta = {
  title: "Suppr/Redesign/RedesignTodayScreen",
  component: RedesignTodayScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The whole `/redesign/today` prototype screen — editorial serif greeting, one hero ring with a compact macro legend beside it, then the macro grid, activity row and meal list. It runs entirely on module-level mock data (no auth, no Supabase, no props), so it is safe to snapshot as a full-screen composition and is the reference for the refreshed Today rhythm.",
      },
    },
  },
} satisfies Meta<typeof RedesignTodayScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop width — the max-w-2xl column centred on the page ground. */
export const Default: Story = {};

/** Phone width, where the hero stacks above the macro legend. */
export const NarrowViewport: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 390, margin: "0 auto", overflowX: "hidden" }}>
        <Story />
      </div>
    ),
  ],
};
