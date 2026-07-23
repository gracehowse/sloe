import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverImportCard } from "./DiscoverImportCard";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/DiscoverImportCard",
  component: DiscoverImportCard,
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
  parameters: { layout: "fullscreen" },
  args: { onOpenUnified: () => undefined, onOpenLegacyImport: () => undefined },
} satisfies Meta<typeof DiscoverImportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const LegacyPath = {} as Story;
