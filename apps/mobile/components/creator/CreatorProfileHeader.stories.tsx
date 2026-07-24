import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CreatorProfileHeader } from "./CreatorProfileHeader";
import type { CreatorProfileModel } from "./useCreatorProfile";

const BASE: CreatorProfileModel = {
  id: "creator-1",
  display_name: "Priya Patel",
  handle: "priyaeats",
  avatar_url: null,
  bio: "Whole-food recipes with honest macros — mostly plants, always flavour.",
  is_verified: true,
};

const meta = {
  title: "Mobile/Creator/CreatorProfileHeader",
  component: CreatorProfileHeader,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Identity block at the top of a mobile creator profile. Under `creator_profile_v3` (default ON, and always on in Storybook) it is a left-aligned 64pt avatar / name / handle / bio row so the name reads first and the stats card and Follow CTA can sit beneath it; the flag-off fallback is the old centred 96pt column. Storybook's analytics stub resolves every flag true, so these stories show the v3 row.",
      },
    },
  },
  args: { creator: BASE },
} satisfies Meta<typeof CreatorProfileHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Verified creator with a bio — the full row. */
export const Default: Story = {};

/** No bio yet: name, handle, and nothing else claiming vertical space. */
export const WithoutBio: Story = {
  args: { creator: { ...BASE, display_name: "Alex Chen", handle: "alexchefs", bio: null, is_verified: false } },
};

/** Long name plus a two-line bio — checks the name row does not crowd the tick. */
export const LongNameAndBio: Story = {
  args: {
    creator: {
      ...BASE,
      display_name: "Marguerite Devereux-Ashworth",
      handle: "margueritecooks",
      bio: "Slow weeknight cooking for people who work late. Batch-friendly, freezer-friendly, and every recipe costed per portion.",
    },
  },
};

/** Photo avatar rather than the accent monogram fallback. */
export const WithAvatarPhoto: Story = {
  args: {
    creator: {
      ...BASE,
      avatar_url:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&q=60",
    },
  },
};
