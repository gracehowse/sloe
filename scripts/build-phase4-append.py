#!/usr/bin/env python3
# Appends domain story generator definitions to tmp-generate-mobile-phase4-domain-stories.mjs
print(r'''
const settingsDir = "apps/mobile/components/settings";
const chartsDir = "apps/mobile/components/charts";
const discoverDir = "apps/mobile/components/discover";
const cookDir = "apps/mobile/components/cook";
const paywallDir = "apps/mobile/components/paywall";
const recapDir = "apps/mobile/components/recap";
const progressDir = "apps/mobile/components/progress";
const hierarchyDir = "apps/mobile/components/progress/hierarchy";
const onboardingDir = "apps/mobile/components/onboarding";

add(settingsDir, "Mobile/Settings/CancelExportPromptSheet", "CancelExportPromptSheet", {
  metaExtra: `args: { visible: true, onStay: ${noop}, onLeave: ${noop} },`,
  stories: `export const Open: Story = {};\nexport const Hidden: Story = { args: { visible: false } };`,
});

add(settingsDir, "Mobile/Settings/DeleteAccountSheet", "DeleteAccountSheet", {
  metaExtra: `args: { visible: true, onClose: ${noop}, onConfirmDelete: ${noop}, loading: false },`,
  stories: `export const Open: Story = {};\nexport const Deleting: Story = { args: { loading: true } };`,
});

add(settingsDir, "Mobile/Settings/SettingsProfileStatsTiles", "SettingsProfileStatsTiles", {
  metaExtra: `args: {
    stats: [
      { label: "Recipes saved", value: "24" },
      { label: "Days logged", value: "128" },
      { label: "Current streak", value: "12" },
    ],
  },`,
  stories: `export const Default: Story = {};\nexport const Sparse: Story = { args: { stats: [{ label: "Days logged", value: "3" }] } };`,
});

add(settingsDir, "Mobile/Settings/SettingsRow", "SettingsRow", {
  imports: `import { Bell } from "lucide-react-native";\n`,
  metaExtra: `args: {
    label: "Notifications",
    subtitle: "Reminders and weekly recap",
    Icon: Bell,
    onPress: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const Destructive: Story = { args: { label: "Delete account", destructive: true } };`,
});

add(settingsDir, "Mobile/Settings/SettingsSloeProBanner", "SettingsSloeProBanner", {
  metaExtra: `args: { onPress: ${noop} },`,
  stories: `export const Default: Story = {};\nexport const Compact: Story = { args: { compact: true } };`,
});

add(settingsDir, "Mobile/Settings/WeighInReminderPicker", "WeighInReminderPicker", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function PickerHarness() {
  const [day, setDay] = React.useState<number | null>(1);
  const [time, setTime] = React.useState("08:00");
  return (
    <WeighInReminderPicker
      enabled={day != null}
      weekday={day}
      time={time}
      onToggle={(on) => setDay(on ? 1 : null)}
      onChangeDay={setDay}
      onChangeTime={setTime}
    />
  );
}

export const Interactive: Story = { render: () => <PickerHarness /> };
export const Disabled: Story = {
  render: () => (
    <WeighInReminderPicker enabled={false} weekday={null} time="08:00" onToggle={${noop}} onChangeDay={${noop}} onChangeTime={${noop}} />
  ),
};`,
  componentMeta: "WeighInReminderPicker",
});

const chartColors = `const chartColors = { color: "#3B2A4D", trackColor: "#E8E6EF", labelColor: "#6B6574", secondaryColor: "#9B95A6" };\n`;

add(chartsDir, "Mobile/Charts/CalorieRingDial", "CalorieRingDial", {
  metaExtra: `args: { consumed: 820, target: 1500, onPress: ${noop} },`,
  stories: `export const UnderTarget: Story = {};\nexport const OverTarget: Story = { args: { consumed: 1680, target: 1500 } };`,
});

add(chartsDir, "Mobile/Charts/DayStrip", "DayStrip", {
  defaultImport: true,
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function DayStripHarness() {
  const [selected, setSelected] = React.useState(new Date("2026-07-12T12:00:00"));
  return (
    <DayStrip
      selectedDate={selected}
      weekStartDay="monday"
      loggedDays={new Set(["2026-07-10", "2026-07-11", "2026-07-12"])}
      onSelectDate={setSelected}
      onOpenCalendar={${noop}}
      textColor="#3B2A4D"
      secondaryColor="#9B95A6"
    />
  );
}

export const Default: Story = { render: () => <DayStripHarness /> };
export const WithFreezes: Story = {
  render: () => (
    <DayStrip
      selectedDate={new Date("2026-07-12T12:00:00")}
      weekStartDay="monday"
      loggedDays={new Set(["2026-07-11"])}
      protectedDateKeys={new Set(["2026-07-10"])}
      onSelectDate={${noop}}
      onOpenCalendar={${noop}}
      textColor="#3B2A4D"
      secondaryColor="#9B95A6"
    />
  ),
};`,
});

add(chartsDir, "Mobile/Charts/MacroRingSmall", "MacroRingSmall", {
  defaultImport: true,
  imports: chartColors,
  metaExtra: `args: { value: 96, goal: 120, label: "Protein", ...chartColors },`,
  stories: `export const OnTrack: Story = {};\nexport const OverGoal: Story = { args: { value: 132, goal: 120 } };`,
});

add(chartsDir, "Mobile/Charts/MiniBarChart", "MiniBarChart", {
  defaultImport: true,
  imports: chartColors,
  metaExtra: `args: {
    data: [
      { label: "M", value: 1400 },
      { label: "T", value: 1520 },
      { label: "W", value: 1480 },
      { label: "T", value: 1900 },
    ],
    goalLine: 1500,
    ...chartColors,
  },`,
  stories: `export const Default: Story = {};\nexport const NoGoal: Story = { args: { goalLine: undefined } };`,
});

add(chartsDir, "Mobile/Charts/TimeRangeSelector", "TimeRangeSelector", {
  defaultImport: true,
  imports: `import * as React from "react";\nimport { Colors } from "@/constants/theme";\nconst c = Colors.light;\n`,
  metaExtra: "",
  stories: `function RangeHarness() {
  const [selected, setSelected] = React.useState("1M");
  return (
    <TimeRangeSelector
      selected={selected}
      onSelect={setSelected}
      cardColor={c.card}
      textColor={c.text}
      secondaryColor={c.textSecondary}
    />
  );
}

export const Default: Story = { render: () => <RangeHarness /> };
export const DisabledRanges: Story = {
  render: () => (
    <TimeRangeSelector
      selected="1W"
      onSelect={${noop}}
      cardColor={c.card}
      textColor={c.text}
      secondaryColor={c.textSecondary}
      disabledRanges={new Set(["12M", "All"])}
    />
  ),
};`,
});

add(chartsDir, "Mobile/Charts/TrendLine", "TrendLine", {
  defaultImport: true,
  imports: chartColors,
  metaExtra: `args: {
    data: [
      { label: "1 Jul", value: 73.1 },
      { label: "8 Jul", value: 72.7 },
      { label: "15 Jul", value: 72.4 },
    ],
    goalValue: 68,
    ...chartColors,
    formatValue: (v) => \`\${v.toFixed(1)} kg\`,
  },`,
  stories: `export const Default: Story = {};\nexport const WithProjection: Story = {
  args: {
    projectedData: [
      { label: "22 Jul", value: 72.1 },
      { label: "29 Jul", value: 71.8 },
    ],
  },
};`,
});

add(discoverDir, "Mobile/Discover/CreatorRail", "CreatorRail", {
  metaExtra: `args: {
    creators: [
      { id: "c1", name: "Mob Kitchen", avatarUrl: null, recipeCount: 42 },
      { id: "c2", name: "Sloe Kitchen", avatarUrl: null, recipeCount: 18 },
    ],
    onSelect: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const SingleCreator: Story = { args: { creators: [{ id: "c1", name: "Mob Kitchen", avatarUrl: null, recipeCount: 42 }] } };`,
});

add(discoverDir, "Mobile/Discover/DiscoverCollections", "DiscoverCollections", {
  metaExtra: `args: {
    collections: [
      { id: "col1", title: "High protein", subtitle: "32 recipes" },
      { id: "col2", title: "Under 30 min", subtitle: "18 recipes" },
    ],
    onOpen: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const SingleCollection: Story = { args: { collections: [{ id: "col1", title: "High protein", subtitle: "32 recipes" }] } };`,
});

add(discoverDir, "Mobile/Discover/DiscoverImportCard", "DiscoverImportCard", {
  metaExtra: `args: { onImportLink: ${noop}, onScanPhoto: ${noop} },`,
  stories: `export const Default: Story = {};\nexport const PhotoLocked: Story = { args: { photoLocked: true } };`,
});

add(discoverDir, "Mobile/Discover/DiscoverLoadingSkeleton", "DiscoverLoadingSkeleton", {
  stories: `export const Default: Story = {};\nexport const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider scheme="dark">
        <div style={{ width: 360, padding: 16, background: "#1A1A1E" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};`,
});

add(discoverDir, "Mobile/Discover/DiscoverMoreIdeaRow", "DiscoverMoreIdeaRow", {
  imports: `import { MOCK_RECIPE } from "../_mobileStoryDecorators";\n`,
  metaExtra: `args: { item: MOCK_RECIPE, idx: 0, onPress: ${noop} },`,
  stories: `export const Default: Story = {};\nexport const SecondRow: Story = { args: { idx: 1 } };`,
});

add(discoverDir, "Mobile/Discover/DiscoverQuickWeeknight", "DiscoverQuickWeeknight", {
  imports: `import { MOCK_RECIPE } from "../_mobileStoryDecorators";\n`,
  metaExtra: `args: { recipes: [MOCK_RECIPE, { ...MOCK_RECIPE, id: "r2", title: "Salmon tray bake" }], onOpen: ${noop} },`,
  stories: `export const Default: Story = {};\nexport const SingleRecipe: Story = { args: { recipes: [MOCK_RECIPE] } };`,
});

add(discoverDir, "Mobile/Discover/IconBox", "IconBox", {
  defaultImport: true,
  imports: `import { Sparkles } from "lucide-react-native";\n`,
  metaExtra: "",
  stories: `export const Default: Story = { render: () => <IconBox color="#3B2A4D"><Sparkles size={18} color="#3B2A4D" /></IconBox> };
export const Large: Story = { render: () => <IconBox color="#6B9080" size={40}><Sparkles size={22} color="#6B9080" /></IconBox> };`,
});

const cookItems = [
  { name: "CookHandsfreeBanner", args: "visible: true", s2: "visible: false" },
];
add(cookDir, "Mobile/Cook/CookHandsfreeBanner", "CookHandsfreeBanner", {
  metaExtra: `args: { visible: true },`,
  stories: `export const Visible: Story = {};\nexport const Hidden: Story = { args: { visible: false } };`,
});

add(cookDir, "Mobile/Cook/CookIngredientChecklist", "CookIngredientChecklist", {
  metaExtra: `args: {
    items: [
      { name: "Spaghetti", amountLabel: "400 g", checked: true },
      { name: "Eggs", amountLabel: "4 large", checked: false },
    ],
    onToggle: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const AllChecked: Story = { args: { items: [{ name: "Pecorino", amountLabel: "100 g", checked: true }] } };`,
});

add(cookDir, "Mobile/Cook/CookIngredientPanelHeaderToggle", "CookIngredientPanelHeaderToggle", {
  metaExtra: `args: { expanded: false, onToggle: ${noop} },`,
  stories: `export const Collapsed: Story = {};\nexport const Expanded: Story = { args: { expanded: true } };`,
});

add(cookDir, "Mobile/Cook/CookIngredientPanelSheet", "CookIngredientPanelSheet", {
  metaExtra: `args: {
    visible: true,
    onClose: ${noop},
    items: [{ name: "Garlic", amountLabel: "2 cloves" }],
    checkedKeys: new Set(["garlic"]),
    onToggle: ${noop},
  },`,
  stories: `export const Open: Story = {};\nexport const Empty: Story = { args: { items: [], checkedKeys: new Set() } };`,
});

add(cookDir, "Mobile/Cook/CookLogServingsSheet", "CookLogServingsSheet", {
  metaExtra: `args: {
    visible: true,
    onClose: ${noop},
    recipeTitle: "Carbonara",
    servings: 2,
    onChangeServings: ${noop},
    onConfirm: ${noop},
  },`,
  stories: `export const Open: Story = {};\nexport const SingleServing: Story = { args: { servings: 1 } };`,
});

add(cookDir, "Mobile/Cook/CookMiseEnPlace", "CookMiseEnPlace", {
  metaExtra: `args: {
    recipeId: "story-carbonara",
    recipeTitle: "Weeknight carbonara",
    items: [
      { name: "Spaghetti", amountLabel: "400 g" },
      { name: "Eggs", amountLabel: "4 large" },
    ],
    onContinueToSteps: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const Untitled: Story = { args: { recipeTitle: undefined } };`,
});

add(cookDir, "Mobile/Cook/CookRunningTimerStrip", "CookRunningTimerStrip", {
  metaExtra: `args: { label: "Simmer sauce", remainingSec: 245, onPress: ${noop} },`,
  stories: `export const Running: Story = {};\nexport const AlmostDone: Story = { args: { remainingSec: 12 } };`,
});

add(cookDir, "Mobile/Cook/CookStepPageIndicator", "CookStepPageIndicator", {
  metaExtra: `args: { current: 1, total: 5 },`,
  stories: `export const MiddleStep: Story = {};\nexport const LastStep: Story = { args: { current: 4, total: 5 } };`,
});

add(cookDir, "Mobile/Cook/CookStepTimerPills", "CookStepTimerPills", {
  metaExtra: `args: {
    timers: [
      { id: "t1", label: "10 min", running: false },
      { id: "t2", label: "5 min", running: true },
    ],
    onStart: ${noop},
    onStop: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const NoTimers: Story = { args: { timers: [] } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallComparison", "PaywallComparison", {
  stories: `export const Default: Story = {};\nexport const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider scheme="dark">
        <div style={{ width: 360, padding: 16, background: "#1A1A1E" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};`,
});

add(paywallDir, "Mobile/Paywall/PaywallCta", "PaywallCta", {
  metaExtra: `args: { loading: false, onPress: ${noop}, label: "Start free trial" },`,
  stories: `export const Default: Story = {};\nexport const Loading: Story = { args: { loading: true } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallHero", "PaywallHero", {
  metaExtra: `args: { headline: "Eat well. Stay on track.", subhead: "Recipes, logging, and progress in one calm app." },`,
  stories: `export const Default: Story = {};\nexport const ShortCopy: Story = { args: { subhead: undefined } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallNoPaymentChip", "PaywallNoPaymentChip", {
  stories: `export const Default: Story = {};\nexport const Compact: Story = { args: { compact: true } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallPersonalisedPlanCard", "PaywallPersonalisedPlanCard", {
  metaExtra: `args: { targetCalories: 1500, proteinG: 120, goalLabel: "Lose steadily" },`,
  stories: `export const Default: Story = {};\nexport const Maintain: Story = { args: { goalLabel: "Maintain weight", targetCalories: 2100 } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallPlanSelector", "PaywallPlanSelector", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function SelectorHarness() {
  const [plan, setPlan] = React.useState<"yearly" | "monthly">("yearly");
  return <PaywallPlanSelector selected={plan} onSelect={setPlan} />;
}

export const YearlySelected: Story = { render: () => <SelectorHarness /> };
export const MonthlySelected: Story = {
  render: () => <PaywallPlanSelector selected="monthly" onSelect={${noop}} />,
};`,
});

add(paywallDir, "Mobile/Paywall/PaywallTrustStrip", "PaywallTrustStrip", {
  stories: `export const Default: Story = {};\nexport const Minimal: Story = { args: { showRating: false } };`,
});

add(paywallDir, "Mobile/Paywall/PaywallValueGrid", "PaywallValueGrid", {
  stories: `export const Default: Story = {};\nexport const TwoColumn: Story = { args: { columns: 2 } };`,
});

add(paywallDir, "Mobile/Paywall/TrialEndReminderDayPicker", "TrialEndReminderDayPicker", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function DayPickerHarness() {
  const [day, setDay] = React.useState(2);
  return <TrialEndReminderDayPicker value={day} onChange={setDay} />;
}

export const Default: Story = { render: () => <DayPickerHarness /> };
export const Sunday: Story = { render: () => <TrialEndReminderDayPicker value={0} onChange={${noop}} /> };`,
});

add(paywallDir, "Mobile/Paywall/PaywallTrajectoryChartView", "PaywallTrajectoryChartView", {
  importFrom: "./PaywallTrajectoryChart",
  metaExtra: `args: {
    latestWeightKg: 72.4,
    targetCalories: 1500,
    maintenanceTdeeKcal: 2200,
    goal: "lose",
    byDay: {
      "2026-07-01": [{ calories: 1500 }],
      "2026-07-02": [{ calories: 1480 }],
      "2026-07-03": [{ calories: 1520 }],
      "2026-07-04": [{ calories: 1490 }],
      "2026-07-05": [{ calories: 1510 }],
      "2026-07-06": [{ calories: 1505 }],
    },
  },`,
  stories: `export const Projection: Story = {};\nexport const CalmModeHidden: Story = { args: { calmMode: true } };`,
});

add(recapDir, "Mobile/Recap/GoalPaceBodyFields", "GoalPaceBodyFields", {
  metaExtra: `args: {
    sex: "female",
    age: 32,
    heightCm: 168,
    weightKg: 68,
    onChange: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const ImperialHints: Story = { args: { isImperial: true } };`,
});

add(recapDir, "Mobile/Recap/GoalPaceControls", "GoalPaceControls", {
  exportName: "GoalOptionList",
  importFrom: "./GoalPaceControls",
  metaExtra: `args: { value: "cut", onChange: ${noop} },`,
  stories: `export const Cut: Story = {};\nexport const Bulk: Story = { args: { value: "bulk" } };`,
});

add(recapDir, "Mobile/Recap/GoalPaceSecondaryTargets", "GoalPaceSecondaryTargets", {
  metaExtra: `args: { proteinG: 120, carbsG: 150, fatG: 55 },`,
  stories: `export const Default: Story = {};\nexport const HighProtein: Story = { args: { proteinG: 150 } };`,
});

add(recapDir, "Mobile/Recap/GoalPaceSlider", "GoalPaceSlider", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function SliderHarness() {
  const [pace, setPace] = React.useState(0.5);
  return <GoalPaceSlider value={pace} onChange={setPace} min={0.25} max={1} />;
}

export const Default: Story = { render: () => <SliderHarness /> };
export const SlowPace: Story = { render: () => <GoalPaceSlider value={0.25} onChange={${noop}} min={0.25} max={1} /> };`,
});

add(recapDir, "Mobile/Recap/WeeklyRecapCard", "WeeklyRecapCard", {
  defaultImport: true,
  imports: `import { DIGEST_SUCCESS_ARGS } from "../_mobileStoryDecorators";\n`,
  metaExtra: `args: { ...DIGEST_SUCCESS_ARGS },`,
  stories: `export const Default: Story = {};\nexport const LowActivity: Story = { args: { daysLogged: 2, headline: "A lighter week — still worth noting." } };`,
});

add(recapDir, "Mobile/Recap/WeeklyRecapDetailRows", "WeeklyRecapDetailRows", {
  imports: `import { DIGEST_SUCCESS_ARGS } from "../_mobileStoryDecorators";\n`,
  metaExtra: `args: { stats: DIGEST_SUCCESS_ARGS.stats, narrative: DIGEST_SUCCESS_ARGS.narrative },`,
  stories: `export const Default: Story = {};\nexport const NoWeightDelta: Story = { args: { stats: { ...DIGEST_SUCCESS_ARGS.stats, weightDeltaKg: null } } };`,
});

function buildByDay(count, kcal = 1850) {
  const byDay = {};
  for (let i = 0; i < count; i++) {
    byDay[`2026-07-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return byDay;
}

add(progressDir, "Mobile/Progress/WeightRangeToggle", "WeightRangeToggle", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function ToggleHarness() {
  const [value, setValue] = React.useState("1m");
  return <WeightRangeToggle value={value} onChange={setValue} />;
}

export const Default: Story = { render: () => <ToggleHarness /> };
export const YearSelected: Story = { render: () => <WeightRangeToggle value="1y" onChange={${noop}} /> };`,
});

add(progressDir, "Mobile/Progress/ProgressPeriodControl", "ProgressPeriodControl", {
  imports: `import * as React from "react";\nconst NOW = new Date("2026-06-21T12:00:00Z");\n`,
  metaExtra: "",
  stories: `function PeriodHarness() {
  const [period, setPeriod] = React.useState({ type: "W", offset: 0 });
  return (
    <ProgressPeriodControl period={period} weekStart="monday" onChange={setPeriod} now={NOW} />
  );
}

export const CurrentWeek: Story = { render: () => <PeriodHarness /> };
export const MonthView: Story = {
  render: () => (
    <ProgressPeriodControl period={{ type: "M", offset: 0 }} weekStart="monday" onChange={${noop}} now={NOW} />
  ),
};`,
});

add(progressDir, "Mobile/Progress/TrajectoryCard", "TrajectoryCard", {
  metaExtra: `args: {
    latestWeightKg: 72.4,
    targetCalories: 2000,
    maintenanceTdeeKcal: 2350,
    goal: "lose",
    goalWeightKg: 68,
    byDay: buildByDay(6, 1820),
  },`,
  imports: `function buildByDay(count, kcal = 1850) {
  const byDay = {};
  for (let i = 0; i < count; i++) {
    byDay[\`2026-07-\${String(i + 1).padStart(2, "0")}\`] = [{ calories: kcal }];
  }
  return byDay;
}\n`,
  stories: `export const Projection: Story = {};\nexport const Placeholder: Story = { args: { byDay: buildByDay(3) } };`,
});

add(progressDir, "Mobile/Progress/DigestStoryCard", "DigestStoryCard", {
  imports: `import { DIGEST_SUCCESS_ARGS, DIGEST_BLENDED_EXTRAS } from "../_mobileStoryDecorators";\n`,
  metaExtra: `args: { ...DIGEST_SUCCESS_ARGS, ...DIGEST_BLENDED_EXTRAS },`,
  stories: `export const ActiveWeek: Story = {};\nexport const EmptyWeek: Story = { args: { daysLogged: 0, headline: undefined } };`,
});

add(progressDir, "Mobile/Progress/ProgressEnergyTriad", "ProgressEnergyTriad", {
  metaExtra: `args: { avgIntakeKcal: 1800, maintenanceKcal: 2200, isAdaptive: true },`,
  stories: `export const Deficit: Story = {};\nexport const Surplus: Story = { args: { avgIntakeKcal: 2400, maintenanceKcal: 2200, isAdaptive: false } };`,
});

add(progressDir, "Mobile/Progress/ProgressHeroMetric", "ProgressHeroMetric", {
  metaExtra: `args: { label: "Weight", value: "72.4 kg", delta: "-0.4 kg", trend: "down" },`,
  stories: `export const Losing: Story = {};\nexport const Flat: Story = { args: { delta: "0.0 kg", trend: "flat" } };`,
});

add(progressDir, "Mobile/Progress/ProgressOnTargetRibbon", "ProgressOnTargetRibbon", {
  metaExtra: `args: { onTargetDays: 5, totalDays: 7 },`,
  stories: `export const StrongWeek: Story = {};\nexport const MixedWeek: Story = { args: { onTargetDays: 3 } };`,
});

add(progressDir, "Mobile/Progress/ProgressAverageAdherence", "ProgressAverageAdherence", {
  metaExtra: `args: { adherencePct: 82, label: "This month" },`,
  stories: `export const Default: Story = {};\nexport const LowAdherence: Story = { args: { adherencePct: 54 } };`,
});

add(progressDir, "Mobile/Progress/TrendSummaryCard", "TrendSummaryCard", {
  metaExtra: `args: { title: "Weight trend", summary: "Down 0.4 kg over 30 days", tone: "positive" },`,
  stories: `export const Positive: Story = {};\nexport const Neutral: Story = { args: { tone: "neutral", summary: "Stable over 30 days" } };`,
});

add(progressDir, "Mobile/Progress/WeightSparseState", "WeightSparseState", {
  metaExtra: `args: { points: 2, goalKg: 68, onLogWeight: ${noop} },`,
  stories: `export const Sparse: Story = {};\nexport const NoGoal: Story = { args: { goalKg: null } };`,
});

add(progressDir, "Mobile/Progress/WeightTrendHeader", "WeightTrendHeader", {
  metaExtra: `args: { trend: "down", isImperial: false, periodLabel: "This month" },`,
  stories: `export const Losing: Story = {};\nexport const Imperial: Story = { args: { isImperial: true } };`,
});

add(progressDir, "Mobile/Progress/WeightPlateauInsight", "WeightPlateauInsight", {
  metaExtra: `args: { weeksFlat: 3, onLearnMore: ${noop} },`,
  stories: `export const Default: Story = {};\nexport const Dismissed: Story = { args: { dismissed: true } };`,
});

add(progressDir, "Mobile/Progress/WeightCelebrationOverlays", "WeightCelebrationOverlays", {
  metaExtra: `args: { milestoneKg: 70, visible: true, onDismiss: ${noop} },`,
  stories: `export const Visible: Story = {};\nexport const Hidden: Story = { args: { visible: false } };`,
});

add(progressDir, "Mobile/Progress/ExpenditureTrendCard", "ExpenditureTrendCard", {
  metaExtra: `args: { maintenanceKcal: 2200, adaptiveKcal: 2073, confidence: "high" },`,
  stories: `export const Adaptive: Story = {};\nexport const FormulaOnly: Story = { args: { adaptiveKcal: null, confidence: "low" } };`,
});

add(progressDir, "Mobile/Progress/MaintenanceExplainer", "MaintenanceExplainer", {
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function ExplainerHarness(props) {
  const [open, setOpen] = React.useState(false);
  return <MaintenanceExplainer {...props} open={open} onToggle={() => setOpen((v) => !v)} />;
}

export const Collapsed: Story = {
  render: () => (
    <ExplainerHarness
      sex="female"
      weightKg={62}
      heightCm={165}
      age={34}
      activityLevel="moderate"
      resolved={{ kcal: 2073, source: "adaptive", confidence: "high" }}
      planPace="steady"
      userGoal="lose"
      goalCalories={1500}
    />
  ),
};

export const Expanded: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true);
    return (
      <MaintenanceExplainer
        sex="female"
        weightKg={62}
        heightCm={165}
        age={34}
        activityLevel="moderate"
        resolved={{ kcal: 2073, source: "adaptive", confidence: "high" }}
        planPace="steady"
        userGoal="lose"
        goalCalories={1500}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
    );
  },
};`,
  skipComponentImport: false,
});

add(progressDir, "Mobile/Progress/ProgressEnergyEquation", "ProgressEnergyEquation", {
  metaExtra: `args: { intakeKcal: 1800, maintenanceKcal: 2200 },`,
  stories: `export const Deficit: Story = {};\nexport const Surplus: Story = { args: { intakeKcal: 2400 } };`,
});

add(progressDir, "Mobile/Progress/WeightChart", "WeightChart", {
  metaExtra: `args: {
    data: [
      { date: "1 Jul", value: 73.1, ma: 73.0 },
      { date: "8 Jul", value: 72.7, ma: 72.8 },
      { date: "15 Jul", value: 72.4, ma: 72.6, isToday: true },
    ],
    goalWeightKg: 68,
    isImperial: false,
    onLogWeight: ${noop},
  },`,
  stories: `export const Default: Story = {};\nexport const SparsePoints: Story = { args: { data: [{ date: "15 Jul", value: 72.4, isToday: true }] } };`,
});

add(progressDir, "Mobile/Progress/AllWeightDataSheet", "AllWeightDataSheet", {
  metaExtra: `args: {
    visible: true,
    onClose: ${noop},
    entries: [
      { date: "2026-07-15", kg: 72.4 },
      { date: "2026-07-08", kg: 72.7 },
    ],
  },`,
  stories: `export const Open: Story = {};\nexport const Empty: Story = { args: { entries: [] } };`,
});

add(progressDir, "Mobile/Progress/LogWeightSheet", "LogWeightSheet", {
  metaExtra: `args: { visible: true, onClose: ${noop}, onSave: ${noop}, initialKg: 72.4 },`,
  stories: `export const Open: Story = {};\nexport const Imperial: Story = { args: { isImperial: true, initialKg: 72.4 } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/HierarchyOverline", "HierarchyOverline", {
  metaExtra: `args: { label: "Your progress" },`,
  stories: `export const Default: Story = {};\nexport const LongLabel: Story = { args: { label: "Energy balance this month" } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressHierarchyV1", "ProgressHierarchyV1", {
  imports: `import { hierarchyBaseProps } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps(),`,
  stories: `export const Default: Story = {};\nexport const WeightHidden: Story = { args: hierarchyBaseProps({ weightSurfaceMode: "hide" }) };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressTrajectoryHero", "ProgressTrajectoryHero", {
  imports: `import { hierarchyBaseProps, hierarchyTimeline } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps().hero,`,
  stories: `export const Default: Story = {};\nexport const Sparse: Story = { args: { ...hierarchyBaseProps().hero, sparse: true, chartData: [] } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressWeekSection", "ProgressWeekSection", {
  imports: `import { hierarchyBaseProps } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps().week,`,
  stories: `export const Default: Story = {};\nexport const LowAdherence: Story = { args: { ...hierarchyBaseProps().week, adherencePct: 42, onTargetCount: 2 } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressEnergySection", "ProgressEnergySection", {
  imports: `import { hierarchyBaseProps } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps().energy,`,
  stories: `export const Default: Story = {};\nexport const InsufficientData: Story = { args: { ...hierarchyBaseProps().energy, hasEnoughData: false } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressBodyCompSection", "ProgressBodyCompSection", {
  imports: `import { hierarchyBaseProps } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps().bodyComp,`,
  stories: `export const FreeTier: Story = {};\nexport const ProTier: Story = { args: { ...hierarchyBaseProps().bodyComp, userTier: "pro" } };`,
});

add(hierarchyDir, "Mobile/Progress/Hierarchy/ProgressYourWeekSection", "ProgressYourWeekSection", {
  imports: `import { hierarchyBaseProps } from "./_storyFixtures";\n`,
  metaExtra: `args: hierarchyBaseProps().yourWeek,`,
  stories: `export const Default: Story = {};\nexport const NoUsualMeal: Story = { args: { ...hierarchyBaseProps().yourWeek, usualMeal: null } };`,
});

// Onboarding root components
add(onboardingDir, "Mobile/Onboarding/OnboardingSegmentedProgress", "OnboardingSegmentedProgress", {
  metaExtra: `args: { current: 3, total: 12 },`,
  stories: `export const MidFlow: Story = {};\nexport const NearEnd: Story = { args: { current: 11, total: 12 } };`,
});

add(onboardingDir, "Mobile/Onboarding/ProgressiveText", "ProgressiveText", {
  defaultImport: true,
  metaExtra: `args: { text: "Still reach your goals", enabled: true },`,
  stories: `export const Animated: Story = {};\nexport const Instant: Story = { args: { enabled: false } };`,
});

add(onboardingDir, "Mobile/Onboarding/OnboardingRevealProjectionChart", "OnboardingRevealProjectionChart", {
  metaExtra: `args: {
    currentKg: 68,
    goalKg: 62,
    weeklyRateKg: 0.5,
    targetCalories: 1500,
  },`,
  stories: `export const LoseGoal: Story = {};\nexport const Maintain: Story = { args: { goalKg: 68, weeklyRateKg: 0 } };`,
});

add(onboardingDir, "Mobile/Onboarding/number-stepper", "number-stepper", {
  exportName: "MobileNumberStepper",
  importFrom: "./number-stepper",
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function StepperHarness() {
  const [value, setValue] = React.useState(32);
  return <MobileNumberStepper value={value} onChange={setValue} min={16} max={99} unit="years" />;
}

export const Default: Story = { render: () => <StepperHarness /> };
export const AtMin: Story = { render: () => <MobileNumberStepper value={16} onChange={${noop}} min={16} max={99} unit="years" /> };`,
});

add(onboardingDir, "Mobile/Onboarding/scaffold", "scaffold", {
  exportName: "MobileStepHeader",
  importFrom: "./scaffold",
  metaExtra: `args: { overline: "Step 3 of 12", title: "What's your goal?", subtitle: "We'll tailor calories and macros." },`,
  stories: `export const WithSubtitle: Story = {};\nexport const TitleOnly: Story = { args: { subtitle: undefined } };`,
});

add(onboardingDir, "Mobile/Onboarding/segmented", "segmented", {
  exportName: "MobileSegmented",
  importFrom: "./segmented",
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function SegmentedHarness() {
  const [value, setValue] = React.useState("metric");
    return (
      <MobileSegmented
        options={[
          { value: "metric", label: "Metric" },
          { value: "imperial", label: "Imperial" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  }

export const Default: Story = { render: () => <SegmentedHarness /> };
export const ImperialSelected: Story = {
  render: () => (
    <MobileSegmented
      options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]}
      value="imperial"
      onChange={${noop}}
    />
  ),
};`,
});

add(onboardingDir, "Mobile/Onboarding/slider", "slider", {
  exportName: "MobileMiniSlider",
  importFrom: "./slider",
  imports: `import * as React from "react";\n`,
  metaExtra: "",
  stories: `function SliderHarness() {
  const [value, setValue] = React.useState(0.5);
  return <MobileMiniSlider value={value} onChange={setValue} min={0.25} max={1} step={0.25} />;
}

export const Default: Story = { render: () => <SliderHarness /> };
export const Slow: Story = { render: () => <MobileMiniSlider value={0.25} onChange={${noop}} min={0.25} max={1} step={0.25} /> };`,
});

add(onboardingDir, "Mobile/Onboarding/OnboardingRecipeImportStates", "OnboardingRecipeImportStates", {
  exportName: "ImportProgress",
  importFrom: "./OnboardingRecipeImportStates",
  stories: `export const Progress: Story = {};\nexport const Success: Story = {
  render: () => {
    const { ImportSuccess } = require("./OnboardingRecipeImportStates");
    return <ImportSuccess recipeTitle="Mob Kitchen pasta" onContinue={${noop}} />;
  },
};`,
});

function onboardingStep(title, fileBase, exportName, stepId, extraInitial = "") {
  const initial = extraInitial || `{}`;
  add(`apps/mobile/components/onboarding/steps`, `Mobile/Onboarding/Steps/${title}`, `${fileBase}.stories`, {
    skipComponentImport: true,
    imports: `import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { ${exportName} } from "./${fileBase}";
`,
    componentMeta: exportName,
    decorators: `decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("${stepId}", ${initial})}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],`,
    stories: `export const Default: Story = {};\nexport const Prefilled: Story = {};`,
  });
  // fix filename - the add() uses name.stories.tsx but we passed fileBase.stories as name - WRONG
}

