/* Suppr prototype — shared data, helpers, small components.
 * All components go on window so other <script type="text/babel"> files can use them.
 */

const { useState, useEffect, useRef, useMemo, createContext, useContext, Fragment } = React;

// ─────────────────────────────────────────────────────────────
// Lucide icon helper (uses CDN lucide + re-renders on demand)
// ─────────────────────────────────────────────────────────────
function Icon({ name, size = 16, color, strokeWidth = 1.75, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      el.style.width = size + "px";
      el.style.height = size + "px";
      if (color) el.style.color = color;
      el.style.strokeWidth = strokeWidth;
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { "stroke-width": strokeWidth } });
    }
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-grid", placeItems: "center", ...style }} />;
}

// ─────────────────────────────────────────────────────────────
// Daily Ring — progress ring used on Today
// ─────────────────────────────────────────────────────────────
function DailyRing({ size = 180, stroke = 14, progress = 0.79, color = "var(--ring-track)", trackColor = "var(--ring-bg)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(progress, 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────
function Badge({ variant = "neutral", children, icon }) {
  return (
    <span className={`badge badge-${variant}`}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Macro tile
// ─────────────────────────────────────────────────────────────
function MacroTile({ name, value, target, unit, color, icon }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const remain = target - value;
  const remainLabel = remain >= 0 ? `${remain} ${unit} remaining` : `${Math.abs(remain)} ${unit} over`;
  return (
    <div className="macro-tile">
      <div className="head">
        <span className="name">{name}</span>
        <Icon name={icon} size={13} color={color} />
      </div>
      <div><span className="val">{value}</span><span className="unit">/ {target} {unit}</span></div>
      <div className="bar"><div className="fill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="remain">{remainLabel}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Personas — three sample days
// ─────────────────────────────────────────────────────────────
const personas = {
  loss: {
    name: "Weight loss",
    initials: "GH",
    targetKcal: 1800,
    targetProtein: 140,
    targetCarbs: 180,
    targetFat: 60,
    targetFiber: 30,
    loggedKcal: 1420,
    loggedProtein: 92,
    loggedCarbs: 168,
    loggedFat: 48,
    loggedFiber: 22,
    burnedKcal: 2180,
    steps: 8240,
    restingBurn: 1768,
    activeBurn: 412,
    weight: 72.4,
    goalWeight: 68,
    insight: { title: "Protein intake up 18%", body: "Your weekly average climbed from 92 g to 108 g. Third week in a row with an increase." },
    meals: [
      { id: "m1", icon: "coffee", color: "#4cd080", title: "Greek yogurt & berries", meta: "Breakfast · 08:40", kcal: 280, p: 24, c: 18, f: 12 },
      { id: "m2", icon: "utensils", color: "#6c8cff", title: "Sheet-pan chicken bowl", meta: "Lunch · 13:10 · imported from instagram.com", kcal: 620, p: 48, c: 52, f: 22, confidence: 94 },
      { id: "m3", icon: "apple", color: "#ffc04c", title: "Apple & peanut butter", meta: "Snack · 16:00 · 2 servings", kcal: 220, p: 6, c: 28, f: 10 },
    ],
  },
  maintain: {
    name: "Maintenance",
    initials: "AK",
    targetKcal: 2400,
    targetProtein: 160,
    targetCarbs: 280,
    targetFat: 80,
    targetFiber: 35,
    loggedKcal: 1980,
    loggedProtein: 128,
    loggedCarbs: 224,
    loggedFat: 62,
    loggedFiber: 28,
    burnedKcal: 2460,
    steps: 10220,
    restingBurn: 1820,
    activeBurn: 640,
    weight: 78.1,
    goalWeight: 78,
    insight: { title: "You're holding steady", body: "Weight has stayed within 0.4 kg of goal for 14 days. Your intake is well-matched to burn." },
    meals: [
      { id: "m1", icon: "egg", color: "#ffc04c", title: "Eggs, avocado toast, coffee", meta: "Breakfast · 07:20", kcal: 520, p: 28, c: 48, f: 24 },
      { id: "m2", icon: "utensils", color: "#6c8cff", title: "Turkey & rice bowl", meta: "Lunch · 12:50", kcal: 720, p: 52, c: 78, f: 18 },
      { id: "m3", icon: "cookie", color: "#ff7eb3", title: "Protein bar", meta: "Snack · 15:40", kcal: 220, p: 20, c: 22, f: 7 },
      { id: "m4", icon: "utensils", color: "#4cd080", title: "Salmon, potatoes, greens", meta: "Dinner · 19:30", kcal: 520, p: 28, c: 76, f: 13 },
    ],
  },
  recomp: {
    name: "Recomp",
    initials: "JM",
    targetKcal: 2650,
    targetProtein: 180,
    targetCarbs: 300,
    targetFat: 85,
    targetFiber: 38,
    loggedKcal: 1860,
    loggedProtein: 138,
    loggedCarbs: 190,
    loggedFat: 58,
    loggedFiber: 24,
    burnedKcal: 2720,
    steps: 12450,
    restingBurn: 1910,
    activeBurn: 810,
    weight: 84.6,
    goalWeight: 82,
    insight: { title: "Training day — more carbs to go", body: "110 g of carbs to hit target. Oats or rice before your session would round this out." },
    meals: [
      { id: "m1", icon: "coffee", color: "#6c8cff", title: "Protein oats, banana, whey", meta: "Breakfast · 06:40", kcal: 640, p: 48, c: 72, f: 14 },
      { id: "m2", icon: "utensils", color: "#4cd080", title: "Chicken, rice, broccoli", meta: "Lunch · 13:00", kcal: 780, p: 62, c: 84, f: 16 },
      { id: "m3", icon: "dumbbell", color: "#ffc04c", title: "Whey shake + banana", meta: "Post-workout · 17:20", kcal: 440, p: 28, c: 34, f: 28 },
    ],
  },
  household: {
    name: "Household",
    initials: "AL",
    isHousehold: true,
    targetKcal: 2100,
    targetProtein: 150,
    targetCarbs: 240,
    targetFat: 70,
    targetFiber: 32,
    loggedKcal: 1640,
    loggedProtein: 108,
    loggedCarbs: 180,
    loggedFat: 52,
    loggedFiber: 24,
    burnedKcal: 2340,
    steps: 9120,
    restingBurn: 1790,
    activeBurn: 550,
    weight: 74.8,
    goalWeight: 72,
    members: [
      { id: "me", name: "Alex", role: "you", initials: "AL", color: "#6c8cff", kcal: 2100, protein: 150, diet: "No restrictions" },
      { id: "p", name: "Sam", role: "partner", initials: "SM", color: "#4cd080", kcal: 1850, protein: 130, diet: "Pescatarian" },
      { id: "k1", name: "Mia", role: "child · 9", initials: "MI", color: "#ffc04c", kcal: 1600, protein: 50, diet: "No shellfish" },
      { id: "k2", name: "Leo", role: "child · 6", initials: "LE", color: "#ff7eb3", kcal: 1400, protein: 40, diet: "Picky — no tomato" },
    ],
    insight: { title: "Planning for 4 this week", body: "Friday dinner needs a swap — Mia has a school event. Tap Swap to rework it." },
    sharing: {
      // preset: "all" | "dinners" | "weekends" | "custom"
      preset: "dinners",
      // slots: breakfast, lunch, dinner, snack
      // days: mon..sun
      // grid[day][slot] = array of member ids who share this slot, or "solo"
      grid: {
        mon: { breakfast: "solo", lunch: "solo", dinner: ["me","p","k1","k2"], snack: "solo" },
        tue: { breakfast: "solo", lunch: "solo", dinner: ["me","p","k1","k2"], snack: "solo" },
        wed: { breakfast: "solo", lunch: "solo", dinner: ["me","p","k1","k2"], snack: "solo" },
        thu: { breakfast: "solo", lunch: "solo", dinner: ["me","p","k1","k2"], snack: "solo" },
        fri: { breakfast: "solo", lunch: "solo", dinner: ["me","p","k1","k2"], snack: "solo" },
        sat: { breakfast: ["me","p","k1","k2"], lunch: ["me","p","k1","k2"], dinner: ["me","p","k1","k2"], snack: "solo" },
        sun: { breakfast: ["me","p","k1","k2"], lunch: ["me","p","k1","k2"], dinner: ["me","p","k1","k2"], snack: "solo" },
      },
    },
    meals: [
      { id: "m1", icon: "coffee", color: "#4cd080", title: "Family pancakes & fruit", meta: "Breakfast · 07:30 · for 4", kcal: 420, p: 14, c: 62, f: 12 },
      { id: "m2", icon: "utensils", color: "#6c8cff", title: "Sheet-pan chicken bowl", meta: "Lunch · 13:10 · Alex & Sam", kcal: 620, p: 48, c: 52, f: 22 },
      { id: "m3", icon: "apple", color: "#ffc04c", title: "Apple slices & cheese", meta: "Snack · 15:40 · Mia & Leo", kcal: 180, p: 8, c: 20, f: 8 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Recipes
// ─────────────────────────────────────────────────────────────
const recipes = [
  {
    id: "r1",
    title: "Sheet-pan chicken bowl",
    source: "instagram.com/@homefood",
    time: 32,
    servings: 2,
    kcal: 620,
    p: 48, c: 52, f: 22,
    tags: ["high-protein", "one-pan"],
    confidence: 94,
    intro: "An easy weeknight bowl. Toss chicken and vegetables on a sheet pan, roast, and serve over rice or greens.",
    ingredients: [
      { name: "Chicken thighs, boneless", qty: "400 g" },
      { name: "Broccoli florets", qty: "1 head" },
      { name: "Red pepper", qty: "1 large" },
      { name: "Olive oil", qty: "2 tbsp" },
      { name: "Paprika", qty: "1 tsp" },
      { name: "Garlic, minced", qty: "3 cloves" },
      { name: "Cooked jasmine rice", qty: "2 cups" },
    ],
    steps: [
      { body: "Heat oven to 220 °C. Line a sheet pan with baking paper.", ingredients: [] },
      { body: "Toss chicken, broccoli, and pepper with olive oil, paprika, and garlic. Spread on the pan.", ingredients: ["Chicken thighs, boneless", "Broccoli florets", "Red pepper", "Olive oil", "Paprika", "Garlic, minced"] },
      { body: "Roast at 220 °C for 20 minutes, tossing halfway. Vegetables should be lightly charred.", ingredients: ["Chicken thighs, boneless", "Broccoli florets", "Red pepper"], timer: { name: "Roast timer", minutes: 20 } },
      { body: "While the pan roasts, warm the jasmine rice. Taste and adjust salt.", ingredients: ["Cooked jasmine rice"] },
      { body: "Divide rice between two bowls. Top with chicken and vegetables. Drizzle any pan juices.", ingredients: [] },
      { body: "Serve immediately. Leftovers keep 3 days refrigerated.", ingredients: [] },
    ],
  },
  {
    id: "r2",
    title: "Salmon with lentils & greens",
    source: "From your library",
    time: 28,
    servings: 2,
    kcal: 460,
    p: 42, c: 28, f: 18,
    tags: ["high-protein", "omega-3"],
    confidence: 100,
  },
  {
    id: "r3",
    title: "Miso glazed tofu bowl",
    source: "tiktok.com/@weeknight",
    time: 25,
    servings: 2,
    kcal: 520,
    p: 28, c: 62, f: 16,
    tags: ["vegetarian", "quick"],
    confidence: 88,
  },
  {
    id: "r4",
    title: "Sweet potato & black bean tacos",
    source: "bon appétit",
    time: 35,
    servings: 4,
    kcal: 410,
    p: 16, c: 58, f: 14,
    tags: ["vegetarian", "fiber"],
    confidence: 92,
  },
  {
    id: "r5",
    title: "Shrimp & zucchini noodles",
    source: "nytcooking.com",
    time: 22,
    servings: 2,
    kcal: 320,
    p: 34, c: 18, f: 12,
    tags: ["low-carb", "quick"],
    confidence: 96,
  },
  {
    id: "r6",
    title: "Overnight oats, two ways",
    source: "imported from instagram.com",
    time: 5,
    servings: 1,
    kcal: 380,
    p: 22, c: 58, f: 10,
    tags: ["breakfast", "meal-prep"],
    confidence: 97,
  },
];

// Week plan — 7 days, 3 slots each
const weekPlan = [
  { day: "Mon", breakfast: "r6", lunch: "r3", dinner: "r2" },
  { day: "Tue", breakfast: "r6", lunch: "r1", dinner: "r5" },
  { day: "Wed", breakfast: "r6", lunch: "r1", dinner: "r4", today: true },
  { day: "Thu", breakfast: "r6", lunch: "r2", dinner: "r3" },
  { day: "Fri", breakfast: "r6", lunch: "r5", dinner: "r1" },
  { day: "Sat", breakfast: "r6", lunch: "r4", dinner: "r2" },
  { day: "Sun", breakfast: "r6", lunch: "r3", dinner: "r5" },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Progress — last 7 days of weight & calories
const progressSeries = {
  weight: [73.2, 73.0, 72.8, 72.9, 72.7, 72.5, 72.4],
  kcal: [1820, 1760, 1920, 1680, 1850, 1780, 1420],
  protein: [128, 118, 142, 108, 132, 124, 92],
};

// ─── App state context (logged meals, bookmarks, toasts, etc.) ───
const AppCtx = createContext(null);
function AppProvider({ children, personaKey }) {
  const [mealsByPersona, setMealsByPersona] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("suppr.meals") || "null"); if (s) return s; } catch {}
    return { loss: [...personas.loss.meals], maintain: [...personas.maintain.meals], recomp: [...personas.recomp.meals], household: [...personas.household.meals] };
  });
  const [bookmarks, setBookmarks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("suppr.bookmarks") || "[\"r2\",\"r5\"]")); } catch { return new Set(["r2","r5"]); }
  });
  const [shopping, setShopping] = useState(() => {
    try { return JSON.parse(localStorage.getItem("suppr.shopping") || "{}"); } catch { return {}; }
  });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => { try { localStorage.setItem("suppr.meals", JSON.stringify(mealsByPersona)); } catch {} }, [mealsByPersona]);
  useEffect(() => { try { localStorage.setItem("suppr.bookmarks", JSON.stringify([...bookmarks])); } catch {} }, [bookmarks]);
  useEffect(() => { try { localStorage.setItem("suppr.shopping", JSON.stringify(shopping)); } catch {} }, [shopping]);

  const showToast = (msg, icon = "check") => {
    setToast({ msg, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const logMeal = (food, servings = 1) => {
    const hasItems = food.items && food.items.length > 0;
    const m = {
      id: "u" + Date.now(),
      icon: hasItems ? "layers" : "utensils", color: "#6c8cff",
      title: food.title,
      meta: hasItems
        ? `${food.items.length} items · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : `Logged · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${servings !== 1 ? ` · ${servings} servings` : ""}`,
      kcal: Math.round(food.kcal * servings),
      p: +(food.p * servings).toFixed(1),
      c: +(food.c * servings).toFixed(1),
      f: +(food.f * servings).toFixed(1),
      items: food.items,
    };
    setMealsByPersona(prev => ({ ...prev, [personaKey]: [...prev[personaKey], m] }));
    showToast(`Logged ${food.title} · ${m.kcal} kcal`);
  };
  const deleteMeal = (id) => {
    setMealsByPersona(prev => ({ ...prev, [personaKey]: prev[personaKey].filter(m => m.id !== id) }));
    showToast("Meal removed", "trash-2");
  };
  const toggleBookmark = (id) => {
    setBookmarks(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); showToast("Removed from library", "bookmark"); }
      else { n.add(id); showToast("Saved to library", "bookmark-check"); }
      return n;
    });
  };
  const toggleShop = (key) => setShopping(s => ({ ...s, [key]: !s[key] }));

  return (
    <AppCtx.Provider value={{ mealsByPersona, logMeal, deleteMeal, bookmarks, toggleBookmark, shopping, toggleShop, toast, showToast }}>
      {children}
    </AppCtx.Provider>
  );
}
const useApp = () => useContext(AppCtx);

// Build a live persona by merging base persona with dynamic meals and recomputing totals
function buildLivePersona(key) {
  const base = personas[key];
  try {
    const all = JSON.parse(localStorage.getItem("suppr.meals") || "null");
    const meals = all?.[key] || base.meals;
    const t = meals.reduce((a, m) => ({
      kcal: a.kcal + (m.kcal || 0),
      p: a.p + (m.p || 0),
      c: a.c + (m.c || 0),
      f: a.f + (m.f || 0),
    }), { kcal: 0, p: 0, c: 0, f: 0 });
    return { ...base, meals, loggedKcal: Math.round(t.kcal), loggedProtein: Math.round(t.p), loggedCarbs: Math.round(t.c), loggedFat: Math.round(t.f) };
  } catch { return base; }
}

function livePersona(key, mealsByPersona) {
  const base = personas[key];
  const meals = mealsByPersona[key] || base.meals;
  const t = meals.reduce((a, m) => ({
    kcal: a.kcal + (m.kcal || 0),
    p: a.p + (m.p || 0),
    c: a.c + (m.c || 0),
    f: a.f + (m.f || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  return { ...base, meals, loggedKcal: Math.round(t.kcal), loggedProtein: Math.round(t.p), loggedCarbs: Math.round(t.c), loggedFat: Math.round(t.f) };
}

Object.assign(window, { Icon, DailyRing, Badge, MacroTile, personas, recipes, weekPlan, weekDays, progressSeries, useState, useEffect, useRef, useMemo, createContext, useContext, Fragment, AppProvider, useApp, livePersona });
