import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, DIGEST_SUCCESS_ARGS, DIGEST_BLENDED_EXTRAS } from "./_mobileStoryDecorators";
import { DigestBlended } from "./DigestBlended";

const meta = {
  title: "Mobile/Components/DigestBlended",
  component: DigestBlended,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DigestBlended>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    ...DIGEST_SUCCESS_ARGS,
    state: "success",
    blendedExtras: DIGEST_BLENDED_EXTRAS,
    onAdjustPace: () => undefined,
  },
};

export const Empty: Story = {
  args: {
    ...DIGEST_SUCCESS_ARGS,
    state: "empty",
    daysLogged: 0,
    mealsLogged: 0,
    blendedExtras: {
      closestDayTargetCalories: null,
      patternWindowLabel: null,
      dayOfWeekPattern: null,
    },
  },
};
