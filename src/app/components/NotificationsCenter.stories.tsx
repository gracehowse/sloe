import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NotificationsCenter } from "./NotificationsCenter";
import { HostDesktopShell, HostStoryProviders, noop } from "./_hostStoryFixtures";

/**
 * NotificationsCenter — inbox host. Empty state is stable without seeded inbox
 * data; populated rows need AppData notification seeding (integration territory).
 */
const meta = {
  title: "Hosts/NotificationsCenter",
  component: NotificationsCenter,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "In-app notification inbox — today / earlier groups + bulk actions.",
      },
    },
  },
  decorators: [
    (Story) => (
      <HostStoryProviders>
        <HostDesktopShell>
          <Story />
        </HostDesktopShell>
      </HostStoryProviders>
    ),
  ],
  args: {
    onOpenRecipe: noop,
  },
} satisfies Meta<typeof NotificationsCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyInbox: Story = {
  name: "Empty inbox",
};
