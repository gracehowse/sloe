import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  SettingsTwoPaneShell,
  type SettingsPaneSection,
} from "./SettingsTwoPaneShell";
import { SupprCard } from "../ui/suppr-card";
import { Icons } from "../ui/icons";

/**
 * SettingsTwoPaneShell — the Sloe v3 web Settings two-pane layout (gap #24).
 * Sticky left sub-nav + a right panel that swaps to the selected section's
 * EXISTING card content. Stories render representative `<SupprCard>` bodies
 * so the desktop two-pane composition + the mobile-web single-column
 * fallback can be SEEn at the relevant viewports.
 */

/** A representative card body (rows / labels) standing in for a real section. */
function DemoCard({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Icons;
  title: string;
  children: React.ReactNode;
}) {
  const Icon = Icons[icon];
  return (
    <SupprCard padding="lg" radius="xl" className="mb-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">
          {title}
        </h3>
      </div>
      <div className="space-y-4 text-sm text-foreground">{children}</div>
    </SupprCard>
  );
}

const sections: SettingsPaneSection[] = [
  {
    id: "account",
    label: "Account & billing",
    lead: "Your plan, personal details, and account actions.",
    icon: "user",
    content: (
      <DemoCard icon="user" title="Personal">
        <p>Your name, email, display name, password, and sign out.</p>
        <p className="text-foreground-tertiary">Sloe Pro · renews 14 Jul</p>
      </DemoCard>
    ),
  },
  {
    id: "preferences",
    label: "Preferences",
    lead: "How Sloe tracks, measures, and shows your day.",
    icon: "settings",
    content: (
      <DemoCard icon="settings" title="Preferences">
        <p>Measurement system, meal slots, theme, macro display, week start.</p>
        <p className="text-foreground-tertiary">Tracking extras off by default.</p>
      </DemoCard>
    ),
  },
  {
    id: "connections",
    label: "Connections",
    lead: "Your devices, apps, and household.",
    icon: "link",
    content: (
      <DemoCard icon="link" title="Connections">
        <p>Apple Health · syncs from the Sloe iOS app.</p>
        <p className="text-foreground-tertiary">Household · 2 people</p>
      </DemoCard>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    lead: "Gentle nudges, never noise.",
    icon: "notifications",
    content: (
      <DemoCard icon="notifications" title="Notifications">
        <p>Meal plan ready, weekly summary, recipe publish updates.</p>
      </DemoCard>
    ),
  },
  {
    id: "privacy",
    label: "Privacy & data",
    lead: "Your log is yours. Take it or delete it, anytime.",
    icon: "shield",
    content: (
      <DemoCard icon="shield" title="Privacy & Security">
        <p>Export your nutrition log, reset targets, erase or delete.</p>
        <p className="text-destructive">Delete my account permanently</p>
      </DemoCard>
    ),
  },
];

const proBanner = (
  <a
    href="#"
    className="mb-6 flex items-center justify-between rounded-[var(--radius-card-lg)] px-4 py-4"
    style={{
      backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)",
    }}
  >
    <span className="flex items-center gap-2.5">
      <Icons.sparkles
        className="w-[18px] h-[18px]"
        style={{ color: "var(--accent-primary-solid)" }}
        aria-hidden
      />
      <span
        className="text-[15px] font-semibold"
        style={{ color: "var(--accent-primary-solid)" }}
      >
        Sloe Pro
      </span>
    </span>
    <span
      className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
      style={{ color: "var(--accent-primary-solid)" }}
    >
      Manage
    </span>
  </a>
);

const meta = {
  component: SettingsTwoPaneShell,
  tags: ["ai-generated"],
  parameters: { layout: "fullscreen" },
  args: { sections },
} satisfies Meta<typeof SettingsTwoPaneShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop two-pane: sticky left sub-nav + the active section on the right. */
export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: "responsive" } },
  args: { header: proBanner },
  play: async ({ canvas }) => {
    // First section selected on open.
    const accountNav = canvas.getByTestId("settings-pane-nav-account");
    await expect(accountNav.getAttribute("aria-current")).toBe("page");

    // Clicking Privacy swaps the active panel + the aria-current marker.
    await userEvent.click(canvas.getByTestId("settings-pane-nav-privacy"));
    await expect(
      canvas.getByTestId("settings-pane-nav-privacy").getAttribute("aria-current"),
    ).toBe("page");
    const privacyPanel = canvas.getByTestId("settings-pane-panel-privacy");
    await expect(
      within(privacyPanel).getByText("Privacy & Security"),
    ).toBeTruthy();
  },
};

/** Mobile-web fallback — the single-column stacked layout (no half-pane). */
export const MobileWeb: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  args: { header: proBanner },
};
