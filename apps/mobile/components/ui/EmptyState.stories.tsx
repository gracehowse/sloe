import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Inbox } from "lucide-react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { EmptyState } from "./EmptyState";
import { SupprButton } from "./SupprButton";

const meta = {
  title: "Mobile/UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **EmptyState** — universal empty placeholder (icon, title, body, CTAs). Distinct from legacy `apps/mobile/components/EmptyState.tsx`. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithActions: Story = {
  args: {
    icon: <Inbox size={24} />,
    title: "Nothing planned yet",
    body: "Add a few recipes to fill this week.",
    primaryCta: (
      <SupprButton variant="primary" label="Add recipes" onPress={() => undefined} />
    ),
    secondaryCta: (
      <SupprButton variant="ghost" label="Browse templates" onPress={() => undefined} />
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Nothing here",
  },
};

export const WithBody: Story = {
  args: {
    title: "No results",
    body: "Try a different search term.",
  },
};
