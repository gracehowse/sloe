import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressHierarchyV1 } from "./progress-hierarchy-v1";
import { hierarchyBaseProps } from "./_storyFixtures";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressHierarchyV1",
  component: ProgressHierarchyV1,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "ENG-1525 composer — five sections in fixed order when `progress_hierarchy_v1` is on.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressHierarchyV1>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: hierarchyBaseProps(),
};

export const WeightHidden: Story = {
  name: "Weight hidden (This Week leads)",
  args: hierarchyBaseProps({ weightSurfaceMode: "hide" }),
};

export const PromoteWeek: Story = {
  name: "Promote week over sparse hero",
  args: hierarchyBaseProps({
    promoteAvailableProgress: true,
    hero: {
      ...hierarchyBaseProps().hero,
      sparse: true,
      chartData: [{ date: "15 Jul", value: 72.4 }],
    },
  }),
};
