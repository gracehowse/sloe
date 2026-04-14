import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════ */
const LIGHT = {
  bg: "#faf9f7", surface: "#f5f3f0", surfaceElevated: "#ffffff",
  textPrimary: "#1a1714", textSecondary: "#6b6560", textTertiary: "#9a938c",
  border: "#e8e4df", shadow: "0 1px 3px rgba(26,23,20,0.06)",
  shadowLg: "0 8px 24px rgba(26,23,20,0.08)", ringBg: "#e8e4df",
  chipBg: "#ffffff", chipBorder: "#e8e4df", mealGhost: "#f0ece8",
  overlay: "rgba(0,0,0,0.4)", sheetBg: "#ffffff",
};
const DARK = {
  bg: "#111118", surface: "#1a1a22", surfaceElevated: "#23232e",
  textPrimary: "#ede9e3", textSecondary: "#8a847e", textTertiary: "#5c5751",
  border: "#2a2a35", shadow: "none", shadowLg: "none", ringBg: "#2a2a35",
  chipBg: "#1a1a22", chipBorder: "#2a2a35", mealGhost: "#1a1a22",
  overlay: "rgba(0,0,0,0.7)", sheetBg: "#23232e",
};
const A = {
  green: "#3a9a5c", greenSoft: "#3a9a5c22", greenMid: "#3a9a5c55",
  amber: "#c8903a", amberSoft: "#c8903a22",
  red: "#c44a4a", redSoft: "#c44a4a22",
  protein: "#5580cc", proteinSoft: "#5580cc20",
  carbs: "#cca040", carbsSoft: "#cca04020",
  fat: "#cc5588", fatSoft: "#cc558820",
  blue: "#4a7ec4", blueSoft: "#4a7ec422",
};

/* ═══════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════ */
const MEALS = [
  { name: "Breakfast", icon: "🌅", time: "8:15 AM", calories: 485, items: [
    { name: "Greek Yogurt", portion: "200g", cal: 130, confidence: "high" },
    { name: "Granola", portion: "45g", cal: 195, confidence: "high" },
    { name: "Blueberries", portion: "1 cup", cal: 85, confidence: "high" },
    { name: "Honey", portion: "1 tbsp", cal: 75, confidence: "medium" },
  ]},
  { name: "Lunch", icon: "☀️", time: "12:30 PM", calories: 620, items: [
    { name: "Chicken Breast", portion: "150g", cal: 248, confidence: "high" },
    { name: "Brown Rice", portion: "1 cup", cal: 216, confidence: "high" },
    { name: "Mixed Greens", portion: "2 cups", cal: 18, confidence: "high" },
    { name: "Olive Oil Dressing", portion: "2 tbsp", cal: 138, confidence: "medium" },
  ]},
];

const FEED_RECIPES = [
  { id: 1, title: "Creamy Tuscan Chicken Pasta", creator: "Sarah Cooks", avatar: "S", source: "tiktok", time: "25 min", servings: 4, cal: 520, p: 38, c: 52, f: 16, fit: "good", fitLabel: "Fits your dinner", saves: 2340, made: 891, img: "linear-gradient(135deg, #e8c4a0 0%, #d4956b 50%, #8b5e3c 100%)", emoji: "🍝" },
  { id: 2, title: "High Protein Overnight Oats", creator: "FitMeals", avatar: "F", source: "instagram", time: "5 min", servings: 1, cal: 385, p: 32, c: 45, f: 8, fit: "great", fitLabel: "Perfect for breakfast", saves: 5120, made: 3200, img: "linear-gradient(135deg, #f0e6d3 0%, #c9b896 50%, #8a7a5e 100%)", emoji: "🥣" },
  { id: 3, title: "Korean Beef Bibimbap Bowl", creator: "Chef Min", avatar: "M", source: "youtube", time: "35 min", servings: 2, cal: 610, p: 42, c: 65, f: 18, fit: "warn", fitLabel: "High carb for targets", saves: 1890, made: 720, img: "linear-gradient(135deg, #e8d5b7 0%, #c97c52 50%, #8b4513 100%)", emoji: "🍜" },
  { id: 4, title: "Mediterranean Chicken Bowl", creator: "HealthyEats", avatar: "H", source: "platemate", time: "20 min", servings: 2, cal: 485, p: 44, c: 38, f: 14, fit: "great", fitLabel: "Macro balanced", saves: 3400, made: 1560, img: "linear-gradient(135deg, #b8d4a8 0%, #7ea87e 50%, #4a7a4a 100%)", emoji: "🥗" },
  { id: 5, title: "Peanut Butter Banana Smoothie", creator: "BlendQueen", avatar: "B", source: "tiktok", time: "3 min", servings: 1, cal: 340, p: 18, c: 42, f: 12, fit: "good", fitLabel: "Great snack option", saves: 8900, made: 5100, img: "linear-gradient(135deg, #f5e6c8 0%, #d4a76a 50%, #a67c52 100%)", emoji: "🥤" },
  { id: 6, title: "Salmon Teriyaki with Greens", creator: "OceanTable", avatar: "O", source: "instagram", time: "22 min", servings: 2, cal: 440, p: 36, c: 28, f: 20, fit: "great", fitLabel: "High protein dinner", saves: 4200, made: 1800, img: "linear-gradient(135deg, #ffc5a3 0%, #e88a6a 50%, #c45a3c 100%)", emoji: "🐟" },
];

const RECIPE_DETAIL = {
  title: "Creamy Tuscan Chicken Pasta",
  creator: "Sarah Cooks", avatar: "S", source: "tiktok",
  description: "A rich, creamy pasta with sun-dried tomatoes, spinach, and perfectly seared chicken. Restaurant quality in 25 minutes.",
  time: "25 min", cook: "20 min", servings: 4, difficulty: "Easy",
  cal: 520, p: 38, c: 52, f: 16,
  confidence: 87,
  ingredients: [
    { name: "Chicken Breast", qty: "500g", cal: 275, p: 52, c: 0, f: 6, confidence: "high" },
    { name: "Penne Pasta", qty: "300g", cal: 450, p: 15, c: 90, f: 2, confidence: "high" },
    { name: "Heavy Cream", qty: "200ml", cal: 340, p: 2, c: 4, f: 36, confidence: "high" },
    { name: "Sun-dried Tomatoes", qty: "80g", cal: 105, p: 3, c: 12, f: 6, confidence: "medium" },
    { name: "Baby Spinach", qty: "100g", cal: 23, p: 3, c: 3, f: 0, confidence: "high" },
    { name: "Parmesan", qty: "60g", cal: 240, p: 22, c: 2, f: 16, confidence: "high" },
    { name: "Garlic", qty: "4 cloves", cal: 18, p: 1, c: 4, f: 0, confidence: "medium" },
    { name: "Olive Oil", qty: "2 tbsp", cal: 240, p: 0, c: 0, f: 28, confidence: "high" },
  ],
  steps: [
    "Season chicken breasts with salt, pepper, and Italian herbs. Slice into strips.",
    "Cook pasta in salted boiling water until al dente. Reserve 1 cup pasta water. Drain.",
    "Heat olive oil in a large skillet over medium-high heat. Sear chicken strips until golden, about 3–4 minutes per side. Remove and set aside.",
    "In the same skillet, add minced garlic and cook for 30 seconds until fragrant.",
    "Add sun-dried tomatoes, heavy cream, and half the parmesan. Stir until smooth and simmering.",
    "Add baby spinach and stir until just wilted, about 1 minute.",
    "Return chicken to the pan. Add cooked pasta and toss everything together. Add pasta water as needed for consistency.",
    "Top with remaining parmesan and serve immediately.",
  ],
};

const PLAN_DATA = [
  { day: "Mon", meals: [{ name: "Overnight Oats", cal: 385, emoji: "🥣" }, { name: "Chicken Bowl", cal: 485, emoji: "🥗" }, { name: "Salmon Teriyaki", cal: 440, emoji: "🐟" }], total: 1310, target: 2100 },
  { day: "Tue", meals: [{ name: "Smoothie Bowl", cal: 340, emoji: "🥤" }, { name: "Turkey Wrap", cal: 420, emoji: "🌯" }, { name: "Tuscan Pasta", cal: 520, emoji: "🍝" }], total: 1280, target: 2100 },
  { day: "Wed", meals: [{ name: "Egg Muffins", cal: 290, emoji: "🍳" }, { name: "Bibimbap", cal: 610, emoji: "🍜" }, { name: "Grilled Fish", cal: 380, emoji: "🐟" }], total: 1280, target: 2100 },
  { day: "Thu", meals: [{ name: "Protein Pancakes", cal: 360, emoji: "🥞" }, { name: "Caesar Salad", cal: 410, emoji: "🥗" }], total: 770, target: 2100 },
  { day: "Fri", meals: [{ name: "Granola Bowl", cal: 420, emoji: "🥣" }, { name: "Poke Bowl", cal: 490, emoji: "🍣" }, { name: "Stir Fry", cal: 460, emoji: "🥘" }], total: 1370, target: 2100 },
  { day: "Sat", meals: [], total: 0, target: 2100 },
  { day: "Sun", meals: [{ name: "Avocado Toast", cal: 380, emoji: "🥑" }], total: 380, target: 2100 },
];

/* ═══════════════════════════════════════════
   UTILITY COMPONENTS
   ═══════════════════════════════════════════ */
const Icon = ({ d, size = 20, color, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{typeof d === "string" ? <path d={d} /> : d}</svg>
);

const ICONS = {
  home: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z",
  compass: <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor"/></>,
  import: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
  mic: <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></>,
  scan: <><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>,
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  heart: <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></>,
  bookmark: <><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></>,
  check: <><polyline points="20 6 9 17 4 12"/></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  chevDown: <><polyline points="6 9 12 15 18 9"/></>,
  chevRight: <><polyline points="9 18 15 12 9 6"/></>,
  chevLeft: <><polyline points="15 18 9 12 15 6"/></>,
  play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  fire: "M12 2c.5 2.5-1 5-3 7 1 1 2 1 3 0 0 3-2 5.5-4 7 1.5.5 3 .5 4.5 0C15 18 17 15.5 17 12c0-4-2.5-7-5-10z",
  timer: <><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="16.24" y1="7.76" x2="14.12" y2="9.88"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="9" y1="1" x2="15" y2="1"/></>,
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></>,
};

const SourceIcon = ({ source, size = 14 }) => {
  const colors = { tiktok: "#000", instagram: "#E1306C", youtube: "#FF0000", pinterest: "#E60023", platemate: A.green };
  const labels = { tiktok: "TT", instagram: "IG", youtube: "YT", pinterest: "PI", platemate: "PM" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4, borderRadius: 4, background: (colors[source] || A.green) + "20", fontSize: size * 0.6, fontWeight: 700, color: colors[source] || A.green, letterSpacing: "-0.02em" }}>
      {labels[source] || "?"}
    </span>
  );
};

const ConfDot = ({ level, size = 6 }) => {
  const c = { high: A.green, medium: A.amber, low: A.red };
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: c[level] || c.high, flexShrink: 0 }} />;
};

const FitBadge = ({ fit, label, theme }) => {
  const styles = {
    great: { bg: A.greenSoft, color: A.green, border: A.green + "33" },
    good: { bg: A.blueSoft, color: A.blue, border: A.blue + "33" },
    warn: { bg: A.amberSoft, color: A.amber, border: A.amber + "33" },
  };
  const s = styles[fit] || styles.good;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
};

const Pill = ({ label, active, onClick, theme }) => (
  <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? A.green : theme.border}`, background: active ? A.greenSoft : "transparent", color: active ? A.green : theme.textSecondary, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", transition: "all 0.15s" }}>
    {label}
  </button>
);

/* ═══════════════════════════════════════════
   DAILY RING
   ═══════════════════════════════════════════ */
function DailyRing({ theme, progress, expanded, onToggle, size = 180 }) {
  const [anim, setAnim] = useState({ cal: 0, p: 0, c: 0, f: 0 });
  useEffect(() => {
    const t = setTimeout(() => setAnim({ cal: progress.calories, p: progress.protein, c: progress.carbs, f: progress.fat }), 200);
    return () => clearTimeout(t);
  }, [progress]);

  const sw = 9, msw = 6, cx = size / 2, r = (size - sw) / 2 - 3;
  const mr = [r - 14, r - 26, r - 38];
  const arc = (radius, pct) => {
    const a = Math.min(pct, 0.999) * 360, rad = ((a - 90) * Math.PI) / 180;
    return `M ${cx} ${cx - radius} A ${radius} ${radius} 0 ${a > 180 ? 1 : 0} 1 ${cx + radius * Math.cos(rad)} ${cx + radius * Math.sin(rad)}`;
  };
  const remaining = Math.max(0, 2100 - Math.round(2100 * anim.cal));

  return (
    <div onClick={onToggle} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={theme.ringBg} strokeWidth={sw} />
        <path d={arc(r, anim.cal)} fill="none" stroke={A.green} strokeWidth={sw} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1)" }} />
        {expanded && [
          [mr[0], anim.p, A.protein], [mr[1], anim.c, A.carbs], [mr[2], anim.f, A.fat]
        ].map(([rad, val, col], i) => (
          <g key={i}>
            <circle cx={cx} cy={cx} r={rad} fill="none" stroke={theme.ringBg} strokeWidth={msw} opacity={0.4} />
            <path d={arc(rad, val)} fill="none" stroke={col} strokeWidth={msw} strokeLinecap="round" style={{ transition: `all 1s cubic-bezier(0.22,1,0.36,1) ${0.1 * (i + 1)}s` }} />
          </g>
        ))}
        <text x={cx} y={expanded ? cx - 4 : cx - 2} textAnchor="middle" fill={theme.textPrimary} fontSize={expanded ? 26 : 32} fontWeight="700" fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>{remaining}</text>
        <text x={cx} y={expanded ? cx + 12 : cx + 16} textAnchor="middle" fill={theme.textTertiary} fontSize="10" fontWeight="500" fontFamily="inherit" letterSpacing="0.06em">KCAL LEFT</text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MACRO PILL
   ═══════════════════════════════════════════ */
function MacroPill({ label, current, target, color, soft, theme }) {
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 10, padding: "9px 11px", background: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${Math.min(current / target, 1) * 100}%`, background: soft, transition: "width 1s cubic-bezier(0.22,1,0.36,1)" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>
          {current}g <span style={{ color: theme.textTertiary, fontWeight: 400, fontSize: 11 }}>/ {target}g</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEAL CARD
   ═══════════════════════════════════════════ */
function MealCard({ meal, theme, startOpen }) {
  const [open, setOpen] = useState(startOpen || false);
  return (
    <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 17 }}>{meal.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>{meal.name}</div>
            <div style={{ fontSize: 11, color: theme.textTertiary }}>{meal.time} · {meal.items.length} items</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>{meal.calories}</span>
          <span style={{ fontSize: 10, color: theme.textTertiary }}>kcal</span>
          <Icon d={ICONS.chevDown} size={14} color={theme.textTertiary} />
        </div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: "2px 0" }}>
          {meal.items.map((item, i) => (
            <div key={i} style={{ padding: "9px 14px 9px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ConfDot level={item.confidence} />
                <span style={{ fontSize: 12, color: theme.textPrimary }}>{item.name}</span>
                <span style={{ fontSize: 10, color: theme.textTertiary }}>{item.portion}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontVariantNumeric: "tabular-nums" }}>{item.cal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEED RECIPE CARD
   ═══════════════════════════════════════════ */
function FeedCard({ recipe, theme, onTap }) {
  return (
    <div onClick={() => onTap && onTap(recipe)} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${theme.border}`, boxShadow: theme.shadow, cursor: "pointer", background: theme.surfaceElevated, transition: "transform 0.15s" }}>
      <div style={{ height: 130, background: recipe.img, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 40, opacity: 0.5 }}>{recipe.emoji}</span>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "20px 12px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>{recipe.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <SourceIcon source={recipe.source} size={12} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{recipe.creator}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {[["P", recipe.p, A.protein], ["C", recipe.c, A.carbs], ["F", recipe.f, A.fat]].map(([l, v, c], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: theme.textSecondary }}>{l} {v}g</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: A.green }}>{recipe.cal} kcal</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <FitBadge fit={recipe.fit} label={recipe.fitLabel} theme={theme} />
          <div style={{ display: "flex", gap: 8, fontSize: 10, color: theme.textTertiary }}>
            <span>{recipe.saves.toLocaleString()} saves</span>
            <span>{recipe.made.toLocaleString()} made</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREENS
   ═══════════════════════════════════════════ */

// ─── TODAY ───
function TodayScreen({ theme, nav }) {
  const [expanded, setExpanded] = useState(false);
  const progress = { calories: 0.53, protein: 0.30, carbs: 0.48, fat: 0.46 };
  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 2px" }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Good morning, Grace</div>
        <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>Sunday, April 13</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 4px" }}>
        <DailyRing theme={theme} progress={progress} expanded={expanded} onToggle={() => setExpanded(!expanded)} size={170} />
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: theme.textTertiary, marginBottom: 10 }}>{expanded ? "Tap to collapse" : "Tap for macros"}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <MacroPill label="Protein" current={45} target={150} color={A.protein} soft={A.proteinSoft} theme={theme} />
        <MacroPill label="Carbs" current={120} target={250} color={A.carbs} soft={A.carbsSoft} theme={theme} />
        <MacroPill label="Fat" current={30} target={65} color={A.fat} soft={A.fatSoft} theme={theme} />
      </div>
      {/* Quick log */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["📷", "Photo"], ["🎤", "Voice"], ["🔍", "Search"], ["⬜", "Scan"], ["⭐", "Favs"]].map(([e, l], i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 2px", borderRadius: 10, background: theme.chipBg, border: `1px solid ${theme.chipBorder}`, cursor: "pointer", boxShadow: theme.shadow }}>
            <span style={{ fontSize: 16 }}>{e}</span>
            <span style={{ fontSize: 9, fontWeight: 500, color: theme.textSecondary }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Meals */}
      <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Meals today</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <MealCard meal={MEALS[0]} theme={theme} startOpen />
        <MealCard meal={MEALS[1]} theme={theme} />
        {/* Ghost cards */}
        {["Dinner", "Snacks"].map((n) => (
          <div key={n} onClick={() => nav("feed")} style={{ background: theme.mealGhost, borderRadius: 12, border: `1px dashed ${theme.border}`, padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textTertiary }}>{n}</div>
              <div style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>Tap to log or browse recipes</div>
            </div>
            <Icon d={ICONS.plus} size={18} color={theme.textTertiary} />
          </div>
        ))}
      </div>
      {/* Insight */}
      <div style={{ marginTop: 14, background: A.greenSoft, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${A.green}33` }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: A.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🔥</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: theme.textPrimary }}>5-day protein streak!</div>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>You've hit your target 5 days running.</div>
        </div>
      </div>
    </div>
  );
}

// ─── DISCOVERY FEED ───
function FeedScreen({ theme, nav, setSelectedRecipe }) {
  const [filter, setFilter] = useState("For You");
  const filters = ["For You", "Popular", "Quick", "High Protein", "Low Carb"];
  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 12px" }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Discover</div>
        <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>Recipes that fit your macros</div>
      </div>
      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, marginBottom: 12 }}>
        <Icon d={ICONS.search} size={16} color={theme.textTertiary} />
        <span style={{ fontSize: 13, color: theme.textTertiary }}>Search recipes or paste a link...</span>
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
        {filters.map((f) => <Pill key={f} label={f} active={filter === f} onClick={() => setFilter(f)} theme={theme} />)}
      </div>
      {/* Import CTA */}
      <div onClick={() => nav("import")} style={{ background: `linear-gradient(135deg, ${A.green}15, ${A.blue}15)`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${A.green}33`, marginBottom: 14, cursor: "pointer" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: A.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={ICONS.import} size={18} color="#fff" sw={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Import from TikTok, Instagram...</div>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>Paste a link or share from any app</div>
        </div>
        <Icon d={ICONS.chevRight} size={16} color={theme.textTertiary} />
      </div>
      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FEED_RECIPES.map((r) => (
          <FeedCard key={r.id} recipe={r} theme={theme} onTap={() => { setSelectedRecipe(r); nav("recipe"); }} />
        ))}
      </div>
    </div>
  );
}

// ─── SOCIAL IMPORT ───
function ImportScreen({ theme, nav }) {
  const [step, setStep] = useState(0); // 0=input, 1=processing, 2=result
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => setStep(2), 2200);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 4px", display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => nav("feed")} style={{ cursor: "pointer", padding: 4 }}><Icon d={ICONS.chevLeft} size={20} color={theme.textPrimary} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary }}>Import Recipe</div>
      </div>

      {step === 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
            Paste a link from TikTok, Instagram, YouTube or any recipe website. We'll extract the recipe and calculate full macro breakdowns.
          </div>
          {/* URL input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div style={{ flex: 1, padding: "11px 14px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, fontSize: 13, color: url ? theme.textPrimary : theme.textTertiary }}>
              {url || "https://www.tiktok.com/@sarahcooks/..."}
            </div>
          </div>
          {/* Source buttons */}
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Or import from</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[["TikTok", "tiktok", "🎵"], ["Instagram", "instagram", "📸"], ["YouTube", "youtube", "▶️"], ["Website", "web", "🌐"]].map(([name, src, emoji]) => (
              <div key={name} onClick={() => { setUrl(`https://${name.toLowerCase()}.com/@sarahcooks/recipe`); setStep(1); }} style={{ padding: "14px", borderRadius: 12, background: theme.surfaceElevated, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", boxShadow: theme.shadow }}>
                <span style={{ fontSize: 20 }}>{emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>{name}</span>
              </div>
            ))}
          </div>
          {/* Recent imports */}
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Recent imports</div>
          {[["Protein Ice Cream", "tiktok", "2 days ago"], ["Sheet Pan Fajitas", "instagram", "5 days ago"]].map(([name, src, time], i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <SourceIcon source={src} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: theme.textPrimary }}>{name}</div>
                <div style={{ fontSize: 11, color: theme.textTertiary }}>{time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", border: `3px solid ${theme.ringBg}`, borderTopColor: A.green,
              animation: "spin 1s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes shimmer { to { background-position: 200% 0 } }`}</style>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary, marginBottom: 6 }}>Extracting recipe...</div>
          <div style={{ fontSize: 12, color: theme.textTertiary, lineHeight: 1.5 }}>
            Parsing ingredients, matching nutrition data,<br />and calculating macros
          </div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10, textAlign: "left", padding: "0 20px" }}>
            {["Extracting ingredients from video", "Matching to nutrition database", "Calculating macro breakdown"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: i < 2 ? A.green : theme.ringBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i < 2 && <Icon d={ICONS.check} size={10} color="#fff" sw={2.5} />}
                </div>
                <span style={{ fontSize: 12, color: i < 2 ? theme.textPrimary : theme.textTertiary }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 14 }}>
          {/* Result card */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${theme.border}`, boxShadow: theme.shadow, background: theme.surfaceElevated, marginBottom: 14 }}>
            <div style={{ height: 120, background: "linear-gradient(135deg, #e8c4a0 0%, #d4956b 50%, #8b5e3c 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 40, opacity: 0.5 }}>🍝</span>
              <div style={{ position: "absolute", top: 10, left: 10 }}><SourceIcon source="tiktok" size={16} /></div>
            </div>
            <div style={{ padding: "14px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>Creamy Tuscan Chicken Pasta</div>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>by Sarah Cooks · 25 min · 4 servings</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[["87%", "Confidence", A.green, A.greenSoft], ["520", "kcal/serving", A.green, A.greenSoft]].map(([v, l, c, bg], i) => (
                  <div key={i} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: bg, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                    <div style={{ fontSize: 10, color: c, opacity: 0.8, marginTop: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Macro bar */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <MacroPill label="Protein" current={38} target={38} color={A.protein} soft={A.proteinSoft} theme={theme} />
                <MacroPill label="Carbs" current={52} target={52} color={A.carbs} soft={A.carbsSoft} theme={theme} />
                <MacroPill label="Fat" current={16} target={16} color={A.fat} soft={A.fatSoft} theme={theme} />
              </div>
            </div>
          </div>
          {/* How it fits */}
          <div style={{ background: A.greenSoft, borderRadius: 12, padding: "14px", border: `1px solid ${A.green}33`, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: A.green, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>How this fits your day</div>
            <div style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.5, marginBottom: 8 }}>
              This recipe uses <strong>45%</strong> of your remaining carb budget and <strong>25%</strong> of your remaining protein. Good fit for dinner.
            </div>
            <div style={{ height: 6, borderRadius: 3, background: theme.ringBg, overflow: "hidden", display: "flex", gap: 2 }}>
              <div style={{ width: "53%", background: A.green, borderRadius: 3 }} />
              <div style={{ width: "25%", background: A.greenMid, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: theme.textTertiary }}>
              <span>Already eaten: 1,105 kcal</span>
              <span>After this: 1,625 kcal</span>
            </div>
          </div>
          {/* Parsed ingredients */}
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Parsed ingredients (8)</div>
          <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", marginBottom: 16 }}>
            {RECIPE_DETAIL.ingredients.slice(0, 5).map((ing, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: i < 4 ? `1px solid ${theme.border}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                <ConfDot level={ing.confidence} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: theme.textPrimary }}>{ing.name}</span>
                  <span style={{ fontSize: 11, color: theme.textTertiary, marginLeft: 6 }}>{ing.qty}</span>
                </div>
                <span style={{ fontSize: 11, color: theme.textSecondary, fontVariantNumeric: "tabular-nums" }}>{ing.cal} kcal</span>
              </div>
            ))}
            <div style={{ padding: "8px 14px", fontSize: 11, color: A.green, fontWeight: 500, cursor: "pointer" }}>+ 3 more ingredients</div>
          </div>
          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("recipe")} style={{ flex: 1, padding: "13px", borderRadius: 10, background: A.green, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Save to Library</button>
            <button style={{ padding: "13px 16px", borderRadius: 10, background: theme.surface, color: theme.textPrimary, fontSize: 14, fontWeight: 600, border: `1px solid ${theme.border}`, cursor: "pointer", fontFamily: "inherit" }}>Add to Plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RECIPE DETAIL ───
function RecipeScreen({ theme, nav, recipe }) {
  const [tab, setTab] = useState("ingredients");
  const [cookMode, setCookMode] = useState(false);
  const r = RECIPE_DETAIL;

  if (cookMode) return <CookModeScreen theme={theme} recipe={r} onExit={() => setCookMode(false)} />;

  return (
    <div style={{ padding: "0 0 20px" }}>
      {/* Hero */}
      <div style={{ height: 200, background: "linear-gradient(135deg, #e8c4a0 0%, #d4956b 50%, #8b5e3c 100%)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 56, opacity: 0.4 }}>🍝</span>
        <div onClick={() => nav("feed")} style={{ position: "absolute", top: 14, left: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)" }}>
          <Icon d={ICONS.chevLeft} size={18} color="#fff" />
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }}>
          {[ICONS.bookmark, ICONS.share].map((ic, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)" }}>
              <Icon d={ic} size={16} color="#fff" />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "30px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <SourceIcon source="tiktok" size={14} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{r.creator}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>{r.title}</div>
        </div>
      </div>

      <div style={{ padding: "0 18px" }}>
        {/* Meta */}
        <div style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: `1px solid ${theme.border}` }}>
          {[[r.time, "Prep"], [r.cook, "Cook"], [`${r.servings}`, "Servings"], [r.difficulty, "Level"]].map(([v, l], i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{v}</div>
              <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 1 }}>{l}</div>
            </div>
          ))}
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: A.green }}>{r.confidence}%</div>
            <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 1 }}>Confidence</div>
          </div>
        </div>

        {/* Macro bar */}
        <div style={{ display: "flex", gap: 6, padding: "12px 0" }}>
          <MacroPill label="Protein" current={r.p} target={r.p} color={A.protein} soft={A.proteinSoft} theme={theme} />
          <MacroPill label="Carbs" current={r.c} target={r.c} color={A.carbs} soft={A.carbsSoft} theme={theme} />
          <MacroPill label="Fat" current={r.f} target={r.f} color={A.fat} soft={A.fatSoft} theme={theme} />
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px", borderRadius: 10, background: A.greenSoft, border: `1px solid ${A.green}33` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: A.green }}>{r.cal}</span>
            <span style={{ fontSize: 9, color: A.green, marginLeft: 2 }}>kcal</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, marginBottom: 14 }}>
          {["ingredients", "steps", "nutrition"].map((t) => (
            <div key={t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
              color: tab === t ? A.green : theme.textTertiary,
              borderBottom: tab === t ? `2px solid ${A.green}` : "2px solid transparent",
              textTransform: "capitalize", transition: "all 0.15s",
            }}>{t}</div>
          ))}
        </div>

        {/* Tab content */}
        {tab === "ingredients" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {r.ingredients.map((ing, i) => {
              const total = r.ingredients.reduce((s, x) => s + x.cal, 0);
              return (
                <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <ConfDot level={ing.confidence} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 500 }}>{ing.name}</span>
                      <span style={{ fontSize: 12, color: theme.textSecondary, fontVariantNumeric: "tabular-nums" }}>{ing.cal} kcal</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}>{ing.qty}</div>
                    {/* Macro contribution bar */}
                    <div style={{ display: "flex", gap: 2, marginTop: 4, height: 3, borderRadius: 2, overflow: "hidden" }}>
                      {[[ing.p, A.protein], [ing.c, A.carbs], [ing.f, A.fat]].map(([v, c], j) => (
                        <div key={j} style={{ width: `${Math.max((v / (ing.p + ing.c + ing.f || 1)) * 100, 2)}%`, background: c, borderRadius: 2, minWidth: 2 }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "steps" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {r.steps.map((s, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${theme.border}`, display: "flex", gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: A.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: A.green, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.5, paddingTop: 2 }}>{s}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "nutrition" && (
          <div>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>Per serving ({r.servings} servings total)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[["Calories", r.cal, "kcal", A.green], ["Protein", r.p, "g", A.protein], ["Carbs", r.c, "g", A.carbs], ["Fat", r.f, "g", A.fat]].map(([l, v, u, c], i) => (
                <div key={i} style={{ padding: "12px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}<span style={{ fontSize: 11, fontWeight: 400 }}>{u}</span></div>
                  <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Micronutrients</div>
            {[["Fiber", "4.2g", 0.3], ["Iron", "3.1mg", 0.4], ["Calcium", "180mg", 0.18], ["Vitamin A", "2400 IU", 0.48], ["Vitamin C", "15mg", 0.17]].map(([n, v, pct], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                <span style={{ fontSize: 12, color: theme.textPrimary, width: 80 }}>{n}</span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: theme.ringBg, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 3, background: pct > 0.3 ? A.green : A.amber }} />
                </div>
                <span style={{ fontSize: 11, color: theme.textSecondary, fontVariantNumeric: "tabular-nums", width: 45, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={() => setCookMode(true)} style={{ flex: 1, padding: "13px", borderRadius: 10, background: A.green, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon d={ICONS.utensils} size={16} color="#fff" /> Start Cooking
          </button>
          <button style={{ flex: 1, padding: "13px", borderRadius: 10, background: theme.surface, color: theme.textPrimary, fontSize: 14, fontWeight: 600, border: `1px solid ${theme.border}`, cursor: "pointer", fontFamily: "inherit" }}>I Made This</button>
        </div>
      </div>
    </div>
  );
}

// ─── COOK MODE ───
function CookModeScreen({ theme, recipe, onExit }) {
  const [step, setStep] = useState(0);
  const [timer, setTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (timer !== null) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      clearInterval(intervalRef.current);
    }
  }, [timer]);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100%", background: theme.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}` }}>
        <div onClick={onExit} style={{ cursor: "pointer", fontSize: 13, fontWeight: 500, color: A.red }}>Exit</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textTertiary }}>Step {step + 1} of {recipe.steps.length}</div>
        <div style={{ width: 40 }} />
      </div>
      {/* Progress bar */}
      <div style={{ height: 3, background: theme.ringBg }}>
        <div style={{ width: `${((step + 1) / recipe.steps.length) * 100}%`, height: "100%", background: A.green, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: A.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: A.green, margin: "0 auto 20px" }}>{step + 1}</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: theme.textPrimary, lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>
          {recipe.steps[step]}
        </div>
        {/* Timer */}
        {timer !== null && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: A.green, fontVariantNumeric: "tabular-nums" }}>{fmtTime(elapsed)}</div>
            <button onClick={() => { setTimer(null); setElapsed(0); }} style={{ marginTop: 8, padding: "6px 16px", borderRadius: 8, background: A.redSoft, color: A.red, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Stop Timer</button>
          </div>
        )}
        {timer === null && (
          <button onClick={() => setTimer(Date.now())} style={{ marginTop: 24, padding: "10px 20px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "24px auto 0" }}>
            <Icon d={ICONS.timer} size={16} color={theme.textSecondary} /> Start Timer
          </button>
        )}
      </div>
      {/* Navigation */}
      <div style={{ padding: "16px 18px", display: "flex", gap: 10, borderTop: `1px solid ${theme.border}` }}>
        <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} style={{ flex: 1, padding: "13px", borderRadius: 10, background: theme.surface, color: step > 0 ? theme.textPrimary : theme.textTertiary, fontSize: 14, fontWeight: 600, border: `1px solid ${theme.border}`, cursor: step > 0 ? "pointer" : "default", fontFamily: "inherit", opacity: step === 0 ? 0.5 : 1 }}>Previous</button>
        <button onClick={() => step < recipe.steps.length - 1 ? setStep(step + 1) : onExit()} style={{ flex: 1, padding: "13px", borderRadius: 10, background: A.green, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {step < recipe.steps.length - 1 ? "Next Step" : "Done!"}
        </button>
      </div>
    </div>
  );
}

// ─── MEAL PLAN ───
function PlanScreen({ theme }) {
  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Meal Plan</div>
          <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>Apr 7 – Apr 13</div>
        </div>
        <button style={{ padding: "8px 14px", borderRadius: 8, background: A.greenSoft, color: A.green, fontSize: 12, fontWeight: 600, border: `1px solid ${A.green}33`, cursor: "pointer", fontFamily: "inherit" }}>AI Auto-fill</button>
      </div>
      {/* Week scroll */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 0 16px" }}>
        {PLAN_DATA.map((d, i) => {
          const pct = d.total / d.target;
          const isToday = d.day === "Sun";
          return (
            <div key={i} style={{
              minWidth: 100, flex: "0 0 auto", borderRadius: 12, padding: "10px",
              background: isToday ? A.greenSoft : theme.surfaceElevated,
              border: `1px solid ${isToday ? A.green + "44" : theme.border}`, boxShadow: theme.shadow,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? A.green : theme.textTertiary, textAlign: "center", marginBottom: 6 }}>{d.day}{isToday ? " ·" : ""}</div>
              {d.meals.length > 0 ? d.meals.map((m, j) => (
                <div key={j} style={{ padding: "5px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>{m.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: theme.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: theme.textTertiary }}>Empty</div>
              )}
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: theme.ringBg, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(pct, 1) * 100}%`, height: "100%", borderRadius: 2, background: pct > 0.9 ? A.green : pct > 0.5 ? A.amber : theme.textTertiary }} />
              </div>
              <div style={{ fontSize: 9, color: theme.textTertiary, textAlign: "center", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{d.total} / {d.target}</div>
            </div>
          );
        })}
      </div>
      {/* Today detail */}
      <div style={{ fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Sunday's plan</div>
      <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", boxShadow: theme.shadow }}>
        {[{ name: "Avocado Toast", cal: 380, p: 12, c: 35, f: 22, emoji: "🥑", time: "Breakfast" }].map((m, i) => (
          <div key={i} style={{ padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{m.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>{m.name}</div>
              <div style={{ fontSize: 11, color: theme.textTertiary }}>{m.time} · {m.cal} kcal</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {[["P", m.p, A.protein], ["C", m.c, A.carbs], ["F", m.f, A.fat]].map(([l, v, c], j) => (
                  <span key={j} style={{ fontSize: 10, color: c, fontWeight: 500 }}>{l} {v}g</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: "12px 14px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: A.green, fontWeight: 500, cursor: "pointer" }}>+ Add meal to Sunday</span>
        </div>
      </div>
      {/* Shopping list teaser */}
      <div style={{ marginTop: 14, padding: "14px", borderRadius: 12, background: theme.surfaceElevated, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", boxShadow: theme.shadow }}>
        <div style={{ fontSize: 22 }}>🛒</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Shopping List</div>
          <div style={{ fontSize: 11, color: theme.textTertiary }}>23 items from this week's plan</div>
        </div>
        <Icon d={ICONS.chevRight} size={16} color={theme.textTertiary} />
      </div>
    </div>
  );
}

// ─── PROGRESS ───
function ProgressScreen({ theme }) {
  const weekData = [1850, 2050, 1980, 2200, 1750, 2100, 1105];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = 2400;
  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 14px" }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Progress</div>
        <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>Weekly report card</div>
      </div>
      {/* Weekly summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[["Avg Calories", "1,862", "vs 2,100 target", A.amber], ["Protein Hit", "5/7", "days on target", A.green], ["Current Streak", "5 days", "protein goal", A.green], ["Week Trend", "-0.4 kg", "on track", A.blue]].map(([title, val, sub, color], i) => (
          <div key={i} style={{ padding: "14px", borderRadius: 12, background: theme.surfaceElevated, border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
            <div style={{ fontSize: 10, color: theme.textTertiary, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{val}</div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>
      {/* Calorie bar chart */}
      <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, padding: "16px", boxShadow: theme.shadow, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, marginBottom: 12 }}>Daily Calories</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {weekData.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: theme.textTertiary, fontVariantNumeric: "tabular-nums" }}>{v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}</span>
              <div style={{ width: "100%", height: `${(v / max) * 80}px`, borderRadius: 5, background: v <= 2100 ? A.green : A.amber, opacity: i === 6 ? 0.5 : 0.8, transition: "height 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
              <span style={{ fontSize: 10, color: theme.textTertiary, fontWeight: 500 }}>{days[i]}</span>
            </div>
          ))}
        </div>
        {/* Target line label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div style={{ width: 12, height: 2, background: theme.textTertiary, borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: theme.textTertiary }}>Target: 2,100 kcal</span>
        </div>
      </div>
      {/* Macro adherence */}
      <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, padding: "16px", boxShadow: theme.shadow, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, marginBottom: 12 }}>Macro Adherence</div>
        {[["Protein", 82, A.protein], ["Carbs", 91, A.carbs], ["Fat", 78, A.fat]].map(([name, pct, color], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: theme.textSecondary, width: 55 }}>{name}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: theme.ringBg, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color, transition: "width 1s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color, width: 35, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          </div>
        ))}
      </div>
      {/* AI Insight */}
      <div style={{ background: A.blueSoft, borderRadius: 12, padding: "14px", border: `1px solid ${A.blue}33` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: A.blue, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Weekly insight</div>
        <div style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.5 }}>
          Your protein consistency is strong — 5 of 7 days on target. Fat intake dipped below target on Thursday and Saturday. Consider adding avocado or nuts as snacks on lighter days.
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE ───
function ProfileScreen({ theme }) {
  return (
    <div style={{ padding: "0 18px 20px" }}>
      <div style={{ padding: "18px 0 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: A.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: A.green }}>G</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary }}>Grace Turner</div>
          <div style={{ fontSize: 12, color: theme.textTertiary }}>Pro Member · Joined Jan 2026</div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["42", "Recipes"], ["12", "Published"], ["238", "Followers"]].map(([v, l], i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px", borderRadius: 10, background: theme.surfaceElevated, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary }}>{v}</div>
            <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      {/* Settings list */}
      <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
        {[["Daily Targets", "2,100 kcal · 150P / 250C / 65F"], ["Dietary Preferences", "No restrictions"], ["Connected Apps", "Apple Health, Instagram"], ["Notification Settings", "Daily reminder at 7 PM"], ["Data Export", "Download your data as CSV"]].map(([title, sub], i, arr) => (
          <div key={i} style={{ padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>{title}</div>
              <div style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>{sub}</div>
            </div>
            <Icon d={ICONS.chevRight} size={16} color={theme.textTertiary} />
          </div>
        ))}
      </div>
      {/* Creator section */}
      <div style={{ marginTop: 14, fontSize: 10, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Creator tools</div>
      <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
        {[["My Published Recipes", "12 recipes · 891 total makes"], ["Creator Analytics", "Views, saves, and engagement"], ["Publish New Recipe", "Share with the community"]].map(([title, sub], i, arr) => (
          <div key={i} style={{ padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>{title}</div>
              <div style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>{sub}</div>
            </div>
            <Icon d={ICONS.chevRight} size={16} color={theme.textTertiary} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP SHELL
   ═══════════════════════════════════════════ */
export default function PlatematePrototype() {
  const [isDark, setIsDark] = useState(false);
  const [screen, setScreen] = useState("today");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const theme = isDark ? DARK : LIGHT;

  const nav = (s) => setScreen(s);

  const tabs = [
    { id: "today", label: "Today", icon: ICONS.home },
    { id: "feed", label: "Discover", icon: ICONS.compass },
    { id: "plan", label: "Plan", icon: ICONS.calendar },
    { id: "progress", label: "Progress", icon: ICONS.chart },
    { id: "profile", label: "Profile", icon: ICONS.user },
  ];

  const renderScreen = () => {
    switch (screen) {
      case "today": return <TodayScreen theme={theme} nav={nav} />;
      case "feed": return <FeedScreen theme={theme} nav={nav} setSelectedRecipe={setSelectedRecipe} />;
      case "import": return <ImportScreen theme={theme} nav={nav} />;
      case "recipe": return <RecipeScreen theme={theme} nav={nav} recipe={selectedRecipe} />;
      case "plan": return <PlanScreen theme={theme} />;
      case "progress": return <ProgressScreen theme={theme} />;
      case "profile": return <ProfileScreen theme={theme} />;
      default: return <TodayScreen theme={theme} nav={nav} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: isDark ? "#0a0a0f" : "#e8e4df", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px", fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      {/* Top controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setIsDark(!isDark)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#1a1a22" : "#fff", color: isDark ? "#ede9e3" : "#1a1714", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          {isDark ? "Dark Mode" : "Light Mode"}
        </button>
        {["today", "feed", "import", "recipe", "plan", "progress"].map((s) => (
          <button key={s} onClick={() => nav(s)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${screen === s ? A.green : isDark ? "#333" : "#ccc"}`, background: screen === s ? A.greenSoft : isDark ? "#1a1a22" : "#fff", color: screen === s ? A.green : isDark ? "#ede9e3" : "#1a1714", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {s === "feed" ? "Discover" : s === "import" ? "Import" : s}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div style={{
        width: 375, maxHeight: 812, background: theme.bg, borderRadius: 40, overflow: "hidden",
        display: "flex", flexDirection: "column",
        fontFamily: "Inter, -apple-system, system-ui, sans-serif",
        border: `1px solid ${theme.border}`,
        boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)",
      }}>
        {/* Status bar */}
        <div style={{ padding: "12px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>9:41</span>
          <div style={{ display: "flex", gap: 4 }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill={theme.textPrimary}><rect x="0" y="4" width="3" height="8" rx="0.5" opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" opacity="0.6"/><rect x="9" y="1" width="3" height="11" rx="0.5" opacity="0.8"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={theme.textPrimary} strokeOpacity="0.35"/><rect x="2" y="2" width="14" height="8" rx="1" fill={A.green}/></svg>
          </div>
        </div>

        {/* Scrollable screen content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {renderScreen()}
        </div>

        {/* Tab bar */}
        {!["import", "recipe"].includes(screen) && (
          <div style={{ display: "flex", borderTop: `1px solid ${theme.border}`, background: theme.surfaceElevated, padding: "5px 0 2px", flexShrink: 0 }}>
            {tabs.map((t) => (
              <div key={t.id} onClick={() => nav(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 0", cursor: "pointer" }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={screen === t.id ? A.green : theme.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {typeof t.icon === "string" ? <path d={t.icon} /> : t.icon}
                </svg>
                <span style={{ fontSize: 9, fontWeight: screen === t.id ? 600 : 400, color: screen === t.id ? A.green : theme.textTertiary }}>{t.label}</span>
              </div>
            ))}
          </div>
        )}
        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0", flexShrink: 0 }}>
          <div style={{ width: 134, height: 5, borderRadius: 3, background: theme.textTertiary, opacity: 0.25 }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: A.green, letterSpacing: "0.1em", textTransform: "uppercase" }}>Platemate Prototype</div>
        <div style={{ fontSize: 12, color: isDark ? "#8a847e" : "#6b6560", marginTop: 2 }}>Tap the buttons above to explore every screen</div>
      </div>
    </div>
  );
}
