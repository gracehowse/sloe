import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalendarDays } from "lucide-react";
import { ScreenChrome } from "./screen-chrome";

const meta = {
  title: "Suppr/ScreenChrome",
  component: ScreenChrome,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Sticky mobile-web tab header — overline, serif title, optional subtitle + trailing.",
      },
    },
  },
} satisfies Meta<typeof ScreenChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    overline: "Today",
    title: "Wednesday",
    subtitle: "22 Jul",
  },
};

export const WithTrailing: Story = {
  args: {
    overline: "Plan",
    title: "Meal plan",
    subtitle: "14–20 Jul",
    trailing: (
      <button
        type="button"
        aria-label="Open calendar"
        className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground"
        onClick={() => undefined}
      >
        <CalendarDays className="size-[18px]" aria-hidden />
      </button>
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Settings",
  },
};
