import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { HostStoryProviders, noop } from "../_hostStoryFixtures";
import { LibraryCollectionsBar } from "./LibraryCollectionsBar";

function LibraryCollectionsBarDemo({
  selectedCollectionId: initialId,
}: {
  selectedCollectionId: string | null;
}) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialId);
  return (
    <LibraryCollectionsBar
      selectedCollectionId={selectedCollectionId}
      onSelectCollection={setSelectedCollectionId}
    />
  );
}

const meta = {
  title: "Library/LibraryCollectionsBar",
  component: LibraryCollectionsBarDemo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <HostStoryProviders>
        <div style={{ width: 420, padding: 20 }}>
          <Story />
        </div>
      </HostStoryProviders>
    ),
  ],
  args: {
    selectedCollectionId: null,
  },
} satisfies Meta<typeof LibraryCollectionsBarDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyLibrary: Story = {};

export const AllSelected: Story = {
  args: { selectedCollectionId: null },
};
