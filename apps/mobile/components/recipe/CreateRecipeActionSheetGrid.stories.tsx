import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Accent } from "@/constants/theme";
import { CreateRecipeActionSheetGrid } from "./CreateRecipeActionSheetGrid";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/CreateRecipeActionSheetGrid",
  component: CreateRecipeActionSheetGrid,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={ { width: 360, padding: 16, background: "#F7F6FA" } }>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { accentPrimary: Accent.primary, isFreeTier: false, cookbookImportEnabled: true, onPhotoPress: () => undefined, go: () => undefined },
} satisfies Meta<typeof CreateRecipeActionSheetGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pro = {} as Story;
export const FreeTier: Story = { args: { isFreeTier: true, cookbookImportEnabled: false } };
