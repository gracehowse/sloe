import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverCreatorRail } from "./discover-creator-rail";

/** Launch-partner chips (ENG-1239) — same shape as `top_creators_by_saves` rows. */
const LAUNCH_PARTNER_CHIPS = [
  {
    id: "a1000001-0001-4000-8000-000000000001",
    handle: "priyaeats",
    displayName: "Priya Patel",
    avatarUrl: null,
    bio: "Batch-cooking & big-flavour veg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000002",
    handle: "marcuscooks",
    displayName: "Marcus Chen",
    avatarUrl: null,
    bio: "30-minute weeknight dinners",
  },
  {
    id: "a1000001-0001-4000-8000-000000000003",
    handle: "sofiaromano",
    displayName: "Sofia Romano",
    avatarUrl: null,
    bio: "Slow mornings & comfort food",
  },
];

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

export const LaunchPartners: Story = {
  name: "Launch partners (real DB rows)",
  args: { creators: [...LAUNCH_PARTNER_CHIPS] },
};

export const Empty: Story = {
  name: "Empty (rail hidden)",
  args: { creators: [] },
};
