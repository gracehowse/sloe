import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverCreatorRail } from "./discover-creator-rail";

/**
 * DiscoverCreatorRail — the "explore from" creator rail (ENG-1225 #14).
 * Mock creators show the layout (initial-on-plum-tint fallback + avatar photos);
 * the live rail is sourced from `top_creators_by_saves` and hides when empty.
 */
const meta = {
  title: "Suppr/DiscoverCreatorRail",
  component: DiscoverCreatorRail,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscoverCreatorRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fallbacks: Story = {
  name: "Initial-on-tint fallbacks",
  args: {
    creators: [
      { id: "a1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null },
      { id: "b2", handle: "anna", displayName: "Anna Jones", avatarUrl: null },
      { id: "c3", handle: "ottolenghi", displayName: "Yotam Ottolenghi", avatarUrl: null },
      { id: "d4", handle: "meera", displayName: "Meera Sodha", avatarUrl: null },
      { id: "e5", handle: "rukmini", displayName: "Rukmini Iyer", avatarUrl: null },
      { id: "f6", handle: "joe", displayName: "Joe Wicks", avatarUrl: null },
    ],
  },
};

export const Empty: Story = {
  name: "Empty (rail hidden)",
  args: { creators: [] },
};
