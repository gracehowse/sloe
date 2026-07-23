import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrustPageLayout } from "./TrustPageLayout";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "data-we-collect", title: "Data we collect" },
  { id: "your-rights", title: "Your rights" },
];

const meta = {
  title: "Suppr/Trust/TrustPageLayout",
  component: TrustPageLayout,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Privacy Policy",
    lastUpdated: "April 2026",
    version: "v1.0",
    subtitle: "How Sloe handles your data.",
    revisionPath: "app/privacy/page.tsx",
    sections,
    children: (
      <>
        <h2 id="overview" className="text-xl font-semibold mb-2">
          Overview
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Sloe is built around logging food you choose to track — not selling your health data.
        </p>
        <h2 id="data-we-collect" className="text-xl font-semibold mb-2">
          Data we collect
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Account email, meal logs, and optional health sync data you explicitly connect.
        </p>
        <h2 id="your-rights" className="text-xl font-semibold mb-2">
          Your rights
        </h2>
        <p className="text-sm text-muted-foreground">
          Export or delete your account from Settings at any time.
        </p>
      </>
    ),
  },
} satisfies Meta<typeof TrustPageLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTableOfContents: Story = {};

export const SingleColumn: Story = {
  args: { sections: undefined },
};
