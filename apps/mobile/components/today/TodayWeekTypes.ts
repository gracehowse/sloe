export interface TodayWeekDay {
  key: string;
  short: string;
  date: Date;
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

export interface TodayWeekViewProps {
  days: TodayWeekDay[];
  weekTotals: { calories: number; protein: number; carbs: number; fat: number };
  weekAvg: { calories: number; protein: number; carbs: number; fat: number };
  daysWithFood: number;
  weekEffectiveCalorieBudget: number;
  weekBurnTotal?: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  preferActivityAdjustedCalories: boolean;
  activityBonusCaloriesOnly: boolean;
  maintenanceKcal: number | null;
  dayGoals: number[];
  onSelectDay: (d: Date) => void;
  styles: Record<string, unknown>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
}
