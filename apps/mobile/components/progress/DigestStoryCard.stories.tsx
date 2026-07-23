import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DigestStoryCard } from "./DigestStoryCard";
import { DIGEST_SUCCESS_ARGS, DIGEST_BLENDED_EXTRAS } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/DigestStoryCard",
  component: DigestStoryCard,
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
  args: { ...DIGEST_SUCCESS_ARGS, ...DIGEST_BLENDED_EXTRAS },
} satisfies Meta<typeof DigestStoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveWeek = {} as Story;
export const EmptyWeek: Story = { args: { daysLogged: 0 } };
