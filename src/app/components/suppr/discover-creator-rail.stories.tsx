import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverCreatorRail } from "./discover-creator-rail";
import { SEED_CREATOR_CHIPS } from "../../../lib/discover/seedCreators";

/**
 * DiscoverCreatorRail — the "explore from" creator rail (ENG-1225 #14).
 * Mock creators show the layout (initial-on-plum-tint fallback + avatar photos);
 * the live rail is sourced from `top_creators_by_saves` and hides when empty.
 * The `Seeded` story renders the SHARED seed fixture (`SEED_CREATOR_CHIPS`) —
 * what `discover_creator_rail_v1` shows while the `creators` table is empty.
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

export const Seeded: Story = {
  name: "Seeded (discover_creator_rail_v1 fallback)",
  args: { creators: [...SEED_CREATOR_CHIPS] },
};

export const Empty: Story = {
  name: "Empty (rail hidden)",
  args: { creators: [] },
};
