import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CookbookImport } from "./CookbookImport";
import { HostProductShell, HostStoryProviders, noop } from "./_hostStoryFixtures";

/**
 * CookbookImport — pick-step composition. Review/success need parse API +
 * AppData commit wiring (covered by unit tests + child review stories).
 */
const meta = {
  title: "Hosts/CookbookImport",
  component: CookbookImport,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Web cookbook PDF import surface — pick → parse → review → save to Library.",
      },
    },
  },
  decorators: [
    (Story) => (
      <HostStoryProviders>
        <HostProductShell>
          <Story />
        </HostProductShell>
      </HostStoryProviders>
    ),
  ],
  args: {
    onClose: noop,
    onUpgrade: noop,
    onViewLibrary: noop,
    onBuildPlan: noop,
  },
} satisfies Meta<typeof CookbookImport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickStep: Story = {
  name: "Pick PDF",
};
