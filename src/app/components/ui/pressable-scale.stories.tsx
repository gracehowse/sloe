import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { PressableScale } from "./pressable-scale";

const meta = {
  component: PressableScale,
  tags: ["ai-generated"],
  args: { children: "Press me" },
} satisfies Meta<typeof PressableScale>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default 0.97 press scale — the mapped class path. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /press me/i })).toBeEnabled();
  },
};

/** A mapped custom scale (0.94 is in the lookup table). */
export const CustomScale: Story = { args: { scaleTo: 0.94 } };

/** A scale outside the lookup table falls back to the 0.97 class. */
export const UnmappedScale: Story = { args: { scaleTo: 0.9 } };

/** `type="submit"` overrides the default `type="button"`. */
export const Submit: Story = { args: { type: "submit", children: "Save" } };

/** Disabled state — `disabled:opacity-50 disabled:cursor-not-allowed`. */
export const Disabled: Story = {
  args: { disabled: true, children: "Saving…" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /saving/i })).toBeDisabled();
  },
};

/** `haptic` is accepted for mobile API parity; web ignores it. */
export const WithHaptic: Story = { args: { haptic: "success", children: "Confirm" } };
