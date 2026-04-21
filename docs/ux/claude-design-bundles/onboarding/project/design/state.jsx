// Onboarding state — shared between mobile + web surfaces.
// Uses React context so both <MobileFlow/> and <WebFlow/> stay in sync.

const STEP_IDS = [
  'welcome',       // 01
  'signup',        // 02
  'goal',          // 03
  'sex',           // 04
  'age',           // 05
  'height',        // 06
  'weight',        // 07
  'activity',      // 08
  'pace',          // 09 — (only shown for lose/gain/recomp; skipped for maintain)
  'diet',          // 10
  'reveal',        // 11 — aha moment
  'permissions',   // 12
  'import',        // 13
];
const STEP_LABELS = [
  'Welcome', 'Account', 'Goal', 'Sex', 'Age', 'Height', 'Weight',
  'Activity', 'Pace', 'Diet', 'Your targets', 'Permissions', 'Import',
];
const TOTAL = STEP_IDS.length;

// Mifflin-St Jeor basal metabolic rate (BMR)
function mifflinStJeor({ sex, age, heightCm, weightKg }) {
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

// Activity multiplier (industry-standard PAL values)
const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

// Goal adjustment — derived from pace (kg/week) for lose/gain.
// 7700 kcal ≈ 1 kg of body mass change. Conservative brand stance:
// cap lose at -0.75 kg/wk (~-825 kcal), gain at +0.35 kg/wk (~+385 kcal).
const GOAL_DEFAULT_PACE = {
  lose: 0.4,        // kg/week (moderate default)
  maintain: 0,
  gain: 0.25,
  recomp: 0.15,     // modest cut for recomp
};
function paceToKcal(goal, paceKgPerWeek) {
  const kcalPerKg = 7700;
  const daily = Math.round((paceKgPerWeek * kcalPerKg) / 7);
  if (goal === 'lose' || goal === 'recomp') return -daily;
  if (goal === 'gain') return daily;
  return 0;
}

function computeTargets(state) {
  const { sex, age, heightCm, weightKg, activity, goal, paceKgPerWeek } = state;
  if (!sex || !age || !heightCm || !weightKg || !activity || !goal) return null;
  const bmr = mifflinStJeor({ sex, age, heightCm, weightKg });
  const tdee = Math.round(bmr * (ACTIVITY_MULT[activity] || 1.55));
  const pace = paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal] ?? 0;
  const kcalAdj = paceToKcal(goal, pace);
  const target = Math.round(tdee + kcalAdj);

  // Macro split — protein is anchored to bodyweight, fat to a floor %, carbs fill the rest.
  // Suppr uses: protein 1.8g/kg (lose/recomp) or 1.6g/kg (maintain/gain), fat 25-30% kcal, rest carbs.
  const proteinPerKg = (goal === 'lose' || goal === 'recomp') ? 1.8 : 1.6;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatKcal = target * 0.28;
  const fatG = Math.round(fatKcal / 9);
  const proteinKcal = proteinG * 4;
  const carbsKcal = Math.max(0, target - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);
  const fiberG = Math.round(target / 1000 * 14); // IOM 14g/1000kcal

  return { bmr: Math.round(bmr), tdee, target, proteinG, fatG, carbsG, fiberG, pace, kcalAdj };
}

const DEFAULT_STATE = {
  step: 0,
  name: '',
  email: '',
  authMethod: null,          // 'apple' | 'google' | 'email'
  goal: null,                // 'lose' | 'maintain' | 'gain' | 'recomp'
  paceKgPerWeek: null,       // 0..0.75 for lose, 0..0.35 for gain (null = use default for goal)
  sex: null,                 // 'male' | 'female' | 'other'
  age: 28,
  heightCm: 170,
  weightKg: 72,
  activity: null,            // key of ACTIVITY_MULT
  diet: [],                  // multi
  allergies: [],
  healthGranted: null,       // null | true | false
  notifGranted: null,
  importSource: null,        // 'instagram' | 'tiktok' | 'blog'
  unitSystem: 'metric',      // 'metric' | 'imperial'
};

const OnboardingContext = React.createContext(null);

function OnboardingProvider({ children, initial }) {
  const [state, setState] = React.useState({ ...DEFAULT_STATE, ...(initial || {}) });
  const set = React.useCallback(patch => {
    setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);
  const go = React.useCallback(delta => {
    setState(s => {
      let next = s.step + delta;
      // Skip 'pace' step if goal is maintain (no calorie delta needed)
      if (s.goal === 'maintain' && STEP_IDS[next] === 'pace') {
        next += delta > 0 ? 1 : -1;
      }
      return { ...s, step: Math.max(0, Math.min(TOTAL - 1, next)) };
    });
  }, []);
  const goTo = React.useCallback(idx => {
    setState(s => ({ ...s, step: Math.max(0, Math.min(TOTAL - 1, idx)) }));
  }, []);
  const reset = React.useCallback(() => setState({ ...DEFAULT_STATE }), []);

  const targets = React.useMemo(() => computeTargets(state), [state]);
  const value = { state, set, go, goTo, reset, targets, TOTAL, STEP_IDS, STEP_LABELS };
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

const useOnboarding = () => React.useContext(OnboardingContext);

Object.assign(window, {
  OnboardingProvider, useOnboarding, OnboardingContext,
  STEP_IDS, STEP_LABELS, TOTAL: STEP_IDS.length,
  computeTargets, mifflinStJeor, ACTIVITY_MULT, GOAL_DEFAULT_PACE, paceToKcal,
});
