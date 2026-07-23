import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DesktopSidebar } from "./desktop-sidebar";

const meta = {
  title: "Suppr/DesktopSidebar",
  component: DesktopSidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Desktop left-hand navigation — Today, Recipes, Plan, Progress with sub-tabs and profile entry.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", minHeight: "720px", background: "var(--background)" }}>
        <Story />
        <div style={{ flex: 1, padding: 24, color: "var(--muted-foreground)" }}>
          Main content area
        </div>
      </div>
    ),
  ],
  args: {
    currentView: "today",
    onNavigate: () => undefined,
    shoppingUncheckedCount: 3,
    libraryRecipeCount: 18,
    userTier: "free",
    displayName: "Grace",
    authEmail: "grace@example.com",
  },
} satisfies Meta<typeof DesktopSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {};

export const RecipesLibrary: Story = {
  args: {
    currentView: "library",
  },
};

export const ProPlanChip: Story = {
  args: {
    currentView: "progress",
    userTier: "pro",
    libraryRecipeCount: 42,
    shoppingUncheckedCount: 0,
  },
};
