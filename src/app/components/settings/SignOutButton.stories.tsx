import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { SignOutButton } from "./SignOutButton";

const meta = {
  title: "Settings/SignOutButton",
  component: SignOutButton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SignOutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trigger: Story = {};

export const ConfirmOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sign Out" }));
  },
};
