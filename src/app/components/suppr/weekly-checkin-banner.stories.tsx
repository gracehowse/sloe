import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeeklyCheckinBanner } from "./weekly-checkin-banner";

/**
 * WeeklyCheckinBanner — ENG-805 non-blocking weekly check-in entry on Today
 * (web parity with mobile `WeeklyCheckinBanner`). Opens the modal only on an
 * explicit "Open" tap; the X dismisses without opening. Single state — pinned
 * so Chromatic guards the layout + the Open / dismiss affordances.
 */
const meta = {
  title: "Suppr/WeeklyCheckinBanner",
  component: WeeklyCheckinBanner,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Today weekly check-in entry — anatomy **Notice** (`SupprNotice` block) under `ui_anatomy_owners_v1`; legacy `SupprCard` when flag off.",
      },
    },
  },
  args: {
    onOpen: () => {},
    onDismiss: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeeklyCheckinBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Ready",
};
