import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanImport } from "./PlanImport";
import { HostProductShell, HostStoryProviders, noop } from "./_hostStoryFixtures";

/**
 * PlanImport — paste-step composition. Review/assessment need `/api/plan-import/parse`
 * + shared commit pipeline (unit-tested; see PlanImportReview when split).
 */
const meta = {
  title: "Hosts/PlanImport",
  component: PlanImport,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Web meal-plan paste import — paste → parse → review → template/activate.",
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
  },
} satisfies Meta<typeof PlanImport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PasteStep: Story = {
  name: "Paste plan",
};
