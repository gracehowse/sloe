import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";

function HealthyChild() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Section content renders normally when no error is thrown.
    </div>
  );
}

function CrashChild(): ReactNode {
  throw new Error("Storybook demo crash");
}

const meta = {
  title: "Host/FeatureErrorBoundary",
  component: FeatureErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Feature-scoped error boundary — branded fallback card with retry + refresh actions.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    feature: "Today insights",
    children: <HealthyChild />,
  },
} satisfies Meta<typeof FeatureErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const Crashed: Story = {
  args: {
    children: <CrashChild />,
  },
};
