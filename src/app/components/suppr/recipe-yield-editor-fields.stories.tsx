import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { RecipeYieldEditorFields } from "./recipe-yield-editor-fields";
import {
  recipeYieldEditorDraftFromDb,
  type RecipeYieldEditorDraft,
} from "../../../lib/recipes/recipeYieldEditor";

function YieldEditorHarness({ initialDraft }: { initialDraft: RecipeYieldEditorDraft }) {
  const [draft, setDraft] = React.useState(initialDraft);
  return <RecipeYieldEditorFields draft={draft} onChange={setDraft} />;
}

const meta = {
  title: "Suppr/RecipeYieldEditorFields",
  component: YieldEditorHarness,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Batch yield editor fields inside RecipeEditDialog — servings / weight / pieces modes.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof YieldEditorHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServingsOnly: Story = {
  name: "Servings only",
  args: {
    initialDraft: recipeYieldEditorDraftFromDb(null, 4),
  },
};

export const WeightAndPieces: Story = {
  name: "Weight + pieces",
  args: {
    initialDraft: recipeYieldEditorDraftFromDb(
      { kind: "weight_and_units", totalGrams: 680, unitCount: 12, singular: "slice" },
      12,
    ),
  },
};
