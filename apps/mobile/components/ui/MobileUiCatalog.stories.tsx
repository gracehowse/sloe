import type { Meta } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { CountBadge } from "./CountBadge";
import { SupprButton } from "./SupprButton";
import { FilterChip } from "./FilterChip";
import { SegmentedTrack } from "./SegmentedTrack";
import { SubTabPill } from "./SubTabPill";
import { EmptyState } from "./EmptyState";
import { SkeletonRow } from "./SkeletonRow";
import { ConfidenceChip } from "./ConfidenceChip";
import { TrustChip } from "./TrustChip";
import { SourceDot } from "./SourceDot";
import { Toast } from "./Toast";

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <MobileStoryThemeProvider>
      <div style={{ width: 360, padding: 16, background: "#F7F6FA", position: "relative", minHeight: 120 }}>
        {children}
      </div>
    </MobileStoryThemeProvider>
  );
}

const meta = {
  title: "Mobile/UI/Catalog",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Mobile UI owner catalog (ENG-1664) — quick index of primitives. Prefer dedicated `Mobile/UI/*` story files for each owner; this catalog stays as a thin rollup.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const CountBadgeIdle = {
  render: () => (
    <Wrap>
      <CountBadge count={3} />
    </Wrap>
  ),
};

export const CountBadgeActive = {
  render: () => (
    <Wrap>
      <CountBadge count={12} active />
    </Wrap>
  ),
};

export const CommitPill = {
  render: () => (
    <Wrap>
      <SupprButton variant="primary" label="Save" onPress={() => undefined} />
    </Wrap>
  ),
};

export const GhostPill = {
  render: () => (
    <Wrap>
      <SupprButton variant="ghost" label="Not now" onPress={() => undefined} />
    </Wrap>
  ),
};

export const Chip = {
  render: () => (
    <Wrap>
      <FilterChip label="High protein" selected={false} onPress={() => undefined} />
      <div style={{ height: 8 }} />
      <FilterChip label="High protein" selected onPress={() => undefined} />
    </Wrap>
  ),
};

export const Segmented = {
  render: () => {
    const [value, setValue] = React.useState("week");
    return (
      <Wrap>
        <SegmentedTrack
          value={value}
          onChange={setValue}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week", badge: 2 },
            { value: "month", label: "Month" },
          ]}
        />
      </Wrap>
    );
  },
};

export const SubTabs = {
  render: () => {
    const [id, setId] = React.useState<"cookbook" | "discover">("cookbook");
    return (
      <Wrap>
        <SubTabPill
          accessibilityLabel="Recipes sub-tabs"
          activeId={id}
          onSelect={setId}
          items={[
            { id: "cookbook", label: "Cookbook", badge: 4 },
            { id: "discover", label: "Discover" },
          ]}
        />
      </Wrap>
    );
  },
};

export const Empty = {
  render: () => (
    <Wrap>
      <EmptyState title="Nothing planned yet" body="Add a few recipes to fill this week." />
    </Wrap>
  ),
};

export const Skeleton = {
  render: () => (
    <Wrap>
      <SkeletonRow />
    </Wrap>
  ),
};

export const Confidence = {
  render: () => (
    <Wrap>
      <ConfidenceChip level="high" />
      <div style={{ height: 8 }} />
      <ConfidenceChip level="low" />
    </Wrap>
  ),
};

export const Trust = {
  render: () => (
    <Wrap>
      <TrustChip variant="usda" />
    </Wrap>
  ),
};

export const Dot = {
  render: () => (
    <Wrap>
      <SourceDot source="usda" />
    </Wrap>
  ),
};

export const ToastInfo = {
  render: () => (
    <Wrap>
      <Toast visible message="Meal logged" variant="info" />
    </Wrap>
  ),
};
