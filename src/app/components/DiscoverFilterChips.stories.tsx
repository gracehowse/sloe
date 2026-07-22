import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DiscoverFilterChips,
  type DiscoverCategory,
  type DiscoverFeedScope,
  type DiscoverFilters,
} from "./DiscoverFilterChips";

function DiscoverFilterChipsStateful({
  initialFeedScope = "forYou",
  initialCategory = "all",
  initialFilters = { verified: false, maxCalories: "", minProtein: "" },
}: {
  initialFeedScope?: DiscoverFeedScope;
  initialCategory?: DiscoverCategory;
  initialFilters?: DiscoverFilters;
}) {
  const [feedScope, setFeedScope] = useState(initialFeedScope);
  const [category, setCategory] = useState(initialCategory);
  const [filters, setFilters] = useState(initialFilters);

  return (
    <DiscoverFilterChips
      feedScope={feedScope}
      setFeedScope={setFeedScope}
      category={category}
      setCategory={setCategory}
      filters={filters}
      setFilters={setFilters}
    />
  );
}

const meta = {
  title: "Host/DiscoverFilterChips",
  component: DiscoverFilterChipsStateful,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Discover feed scope + category pills and optional verified/source-backed filter chip.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscoverFilterChipsStateful>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ForYouAll: Story = {
  name: "For you · All",
  args: {
    initialFeedScope: "forYou",
    initialCategory: "all",
  },
};

export const FollowingSelected: Story = {
  name: "Following selected",
  args: {
    initialFeedScope: "following",
    initialCategory: "all",
  },
};

export const VerifiedFilterOn: Story = {
  name: "Verified filter on",
  args: {
    initialFeedScope: "forYou",
    initialCategory: "high-protein",
    initialFilters: { verified: true, maxCalories: "", minProtein: "" },
  },
};
