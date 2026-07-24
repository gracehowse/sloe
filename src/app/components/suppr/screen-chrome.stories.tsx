import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
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
          "The one page header on web: eyebrow, page title, optional subtitle, plus leading and trailing controls. Under `design_consistency_v1` the eyebrow renders the canonical treatment promoted from the Today hero — 11/600/0.12em FULL-INK caps followed by a hairline rule running to the margin (border token, never mid-grey tertiary). `scope=\"all\"` serves every breakpoint (static at md+) and is the migration target that retires hand-rolled desktop headers; `scope=\"mobile\"` is the legacy md:hidden sticky bar.",
      },
    },
  },
} satisfies Meta<typeof ScreenChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mobile-scope header with the canonical eyebrow + rule. */
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

/**
 * `scope="all"` — the same primitive serving desktop, where it goes static
 * rather than sticky so a 1440px viewport is not permanently topped by a bar.
 * This is what replaces the hand-rolled Library / Progress / Plan / Settings /
 * Shopping desktop headers that had each drifted into their own treatment.
 */
export const DesktopScope: Story = {
  args: {
    overline: "Cookbook",
    title: "Your library",
    subtitle: "128 recipes",
    scope: "all",
    trailing: (
      <button
        type="button"
        aria-label="Add recipe"
        className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground"
        onClick={() => undefined}
      >
        <Plus className="size-[18px]" aria-hidden />
      </button>
    ),
  },
  parameters: { viewport: { defaultViewport: "responsive" } },
};

/**
 * `leading` — the back affordance on a pushed utility surface, matching mobile
 * `ScreenSectionChrome`. The eyebrow rule still runs to the margin beside it.
 */
export const WithLeadingBack: Story = {
  args: {
    overline: "Account",
    title: "Settings",
    scope: "all",
    leading: (
      <button
        type="button"
        aria-label="Back"
        className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground"
        onClick={() => undefined}
      >
        <ArrowLeft className="size-[18px]" aria-hidden />
      </button>
    ),
  },
};

/**
 * `overlineRule={false}` — the deliberate opt-out, for the rare header where a
 * trailing control sits on the eyebrow's optical line and the rule would
 * collide. Falls back to the pre-consistency tertiary eyebrow.
 */
export const WithoutEyebrowRule: Story = {
  args: {
    overline: "Progress",
    title: "Your trends",
    overlineRule: false,
  },
};

/** Sub-tabs rendered inside the sticky header via `children`. */
export const WithSubTabs: Story = {
  args: {
    overline: "Shopping",
    title: "Shopping list",
    children: (
      <div className="flex gap-2 px-6 pb-3">
        {["To buy", "In basket"].map((label, i) => (
          <button
            key={label}
            type="button"
            className={
              i === 0
                ? "rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
                : "rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>
    ),
  },
};
