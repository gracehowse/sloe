import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SubTabPill, type SubTabItem } from "./SubTabPill";

const SubTabs = SubTabPill<string>;

const items: SubTabItem<string>[] = [
  { id: "cookbook", label: "Cookbook", badge: 4 },
  { id: "discover", label: "Discover" },
  { id: "saved", label: "Saved", badge: 0 },
];

const meta = {
  title: "Mobile/UI/SubTabPill",
  component: SubTabs,
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
          "Anatomy role **SubTabPill** — underline sub-tab bar inside a primary tab. Text labels + 2px active indicator; shares CountBadge with SegmentedTrack. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof SubTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [activeId, setActiveId] = React.useState("cookbook");
    return (
      <SubTabs
        items={items}
        activeId={activeId}
        onSelect={setActiveId}
        accessibilityLabel="Recipes sub-tabs"
      />
    );
  },
};

export const Embedded: Story = {
  render: function Render() {
    const [activeId, setActiveId] = React.useState("discover");
    return (
      <SubTabs
        embedded
        items={items}
        activeId={activeId}
        onSelect={setActiveId}
        accessibilityLabel="Recipes sub-tabs"
      />
    );
  },
};

export const Scrollable: Story = {
  render: function Render() {
    const [activeId, setActiveId] = React.useState("cookbook");
    return (
      <SubTabs
        scrollable
        items={[
          ...items,
          { id: "imports", label: "Imports" },
          { id: "shared", label: "Shared with me" },
        ]}
        activeId={activeId}
        onSelect={setActiveId}
        accessibilityLabel="Recipes sub-tabs"
      />
    );
  },
};
