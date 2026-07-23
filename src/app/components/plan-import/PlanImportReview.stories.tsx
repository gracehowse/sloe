import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type {
  PlanImportCompiledSlot,
  PlanImportParseResult,
} from "@/lib/planning/planImport/types";
import { HostProductShell, noop } from "../_hostStoryFixtures";
import { PlanImportReview } from "./PlanImportReview";

const displaySlots: PlanImportCompiledSlot[] = [
  {
    dayIndex: 0,
    dayLabel: "Monday",
    slot: "Breakfast",
    title: "Protein oats",
    recipeKeys: ["oats"],
    linkStatus: "linked",
    portionMultiplier: 1,
    supprNutrition: { calories: 420, protein: 28, carbs: 48, fat: 12 },
    authorNutrition: { calories: 400, protein: 26, carbs: 45, fat: 11 },
    claimedKcal: 400,
    confidence: "high",
  },
  {
    dayIndex: 0,
    dayLabel: "Monday",
    slot: "Lunch",
    title: "Chicken salad",
    recipeKeys: ["salad"],
    linkStatus: "linked",
    portionMultiplier: 1,
    supprNutrition: { calories: 510, protein: 42, carbs: 22, fat: 18 },
    authorNutrition: null,
    claimedKcal: null,
    confidence: "medium",
  },
  {
    dayIndex: 1,
    dayLabel: "Tuesday",
    slot: "Dinner",
    title: "Mystery bowl",
    recipeKeys: ["bowl"],
    linkStatus: "blocked",
    portionMultiplier: 1,
    supprNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    authorNutrition: null,
    claimedKcal: null,
    confidence: "low",
  },
];

const parseResult: PlanImportParseResult = {
  planName: "Bulk week",
  recipes: [],
  slots: displaySlots,
  stats: {
    recipeCount: 3,
    slotCount: 12,
    linkedCount: 10,
    blockedCount: 1,
    avgKcalPerDay: 1780,
    excludedLineCount: 2,
  },
};

function PlanImportReviewDemo({
  activateOpen: initialActivateOpen = false,
  showExcludedLines = true,
  initialNutritionMode = "author" as const,
}: {
  activateOpen?: boolean;
  showExcludedLines?: boolean;
  initialNutritionMode?: "author" | "match";
}) {
  const [planName, setPlanName] = useState(parseResult.planName);
  const [nutritionMode, setNutritionMode] =
    useState<"author" | "match">(initialNutritionMode);
  const [importToLibrary, setImportToLibrary] = useState(true);
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [activateOpen, setActivateOpen] = useState(initialActivateOpen);

  return (
    <PlanImportReview
      parseResult={parseResult}
      displaySlots={displaySlots}
      avgKcal={1780}
      targetKcal={1830}
      showExcludedLines={showExcludedLines}
      planName={planName}
      setPlanName={setPlanName}
      nutritionMode={nutritionMode}
      setNutritionMode={setNutritionMode}
      importToLibrary={importToLibrary}
      setImportToLibrary={setImportToLibrary}
      autoRebalance={autoRebalance}
      setAutoRebalance={setAutoRebalance}
      committing={false}
      activateOpen={activateOpen}
      setActivateOpen={setActivateOpen}
      onBack={noop}
      onCommit={noop}
    />
  );
}

const meta = {
  title: "PlanImport/PlanImportReview",
  component: PlanImportReviewDemo,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <HostProductShell>
        <Story />
      </HostProductShell>
    ),
  ],
} satisfies Meta<typeof PlanImportReviewDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewScreen: Story = {};

export const ActivateDialogOpen: Story = {
  args: { activateOpen: true },
};

export const MatchMode: Story = {
  args: { initialNutritionMode: "match" },
};
