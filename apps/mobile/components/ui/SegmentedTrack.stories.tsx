import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SegmentedTrack, type SegmentedTrackOption } from "./SegmentedTrack";

const Track = SegmentedTrack<string>;

const options: SegmentedTrackOption<string>[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const meta = {
  title: "Mobile/UI/SegmentedTrack",
  component: Track,
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
          "Anatomy role **SegmentedTrack** — §8 track-and-thumb segmented control. One treatment for every single-select track; shares CountBadge with SubTabPill. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof Track>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("week");
    return (
      <Track
        value={value}
        onChange={setValue}
        options={options}
        accessibilityLabel="Progress period"
      />
    );
  },
};

export const WithBadge: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("plan");
    return (
      <Track
        value={value}
        onChange={setValue}
        accessibilityLabel="Plan sections"
        options={[
          { value: "plan", label: "This week" },
          { value: "shopping", label: "Shopping", badge: 5 },
        ]}
      />
    );
  },
};

export const Hug: Story = {
  render: function Render() {
    const [value, setValue] = React.useState("metric");
    return (
      <Track
        fit="hug"
        value={value}
        onChange={setValue}
        role="radiogroup"
        options={[
          { value: "metric", label: "Metric" },
          { value: "imperial", label: "Imperial" },
        ]}
      />
    );
  },
};
