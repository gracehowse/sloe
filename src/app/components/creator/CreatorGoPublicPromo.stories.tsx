import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorGoPublicPromo } from "./CreatorGoPublicPromo";

const meta = {
  title: "Suppr/Creator/CreatorGoPublicPromo",
  component: CreatorGoPublicPromo,
  tags: ["autodocs"],
  parameters: { layout: "padded", nextjs: { appDirectory: true } },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof CreatorGoPublicPromo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
