import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════
   DESIGN SYSTEM — Icon-driven & Structured
   Systematic. Grid-based. Every pixel intentional.
   ═══════════════════════════════════════════ */
const LIGHT = {
  bg: "#f4f5f7", surface: "#ffffff", elevated: "#ffffff", text: "#111118",
  sub: "#6b6b78", dim: "#c4c4cc", border: "#e4e4ec",
  accent: "#4c6ce0", accentSoft: "#4c6ce010", accentMid: "#4c6ce030",
  green: "#22a860", greenSoft: "#22a86010", greenMid: "#22a86030",
  amber: "#e8a020", amberSoft: "#e8a02010",
  red: "#e04848", redSoft: "#e0484810",
  protein: "#4c6ce0", proteinSoft: "#4c6ce012",
  carbs: "#e8a020", carbsSoft: "#e8a02012",
  fat: "#e04888", fatSoft: "#e0488812",
  ringBg: "#e4e4ec",
  overlay: "rgba(0,0,0,0.4)",
};
const DARK = {
  bg: "#101014", surface: "#18181c", elevated: "#202028", text: "#e4e4e8",
  sub: "#7a7a88", dim: "#4a4a55", border: "#282830",
  accent: "#6c8cff", accentSoft: "#6c8cff15", accentMid: "#6c8cff30",
  green: "#4cd080", greenSoft: "#4cd08015", greenMid: "#4cd08030",
  amber: "#ffc04c", amberSoft: "#ffc04c15",
  red: "#ff6b6b", redSoft: "#ff6b6b15",
  protein: "#6c8cff", proteinSoft: "#6c8cff15",
  carbs: "#ffc04c", carbsSoft: "#ffc04c15",
  fat: "#ff7eb3", fatSoft: "#ff7eb315",
  ringBg: "#28283060",
  overlay: "rgba(0,0,0,0.7)",
};

/* ── ICON SYSTEM ── */
const IC = {
  coffee: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  sun: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  plate: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,
  star: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  search: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  camera: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  mic: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
  scan: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  flame: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  users: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  clock: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  plus: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevLeft: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevRight: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  chevDown: (c,s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  check: (c,s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  download: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  bookmark: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  share: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  utensils: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  compass: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={c} opacity="0.3"/></svg>,
  calendar: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  timer: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="16.24" y1="7.76" x2="14.12" y2="9.88"/><line x1="9" y1="1" x2="15" y2="1"/><line x1="12" y1="1" x2="12" y2="3"/></svg>,
  cart: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  settings: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  link: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  globe: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  award: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  edit: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  barChart: (c,s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

const SRC = { tiktok: ["TT", "#000", "#ff004f15"], instagram: ["IG", "#c13584", "#c1358415"], youtube: ["YT", "#ff0000", "#ff000015"], suppr: ["SP", null, null], web: ["WEB", null, null] };
const SourceBadge = ({ source, t }) => {
  const [label, color, bg] = SRC[source] || ["?", t.sub, t.dim + "20"];
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "1px 5px", borderRadius: 4, background: bg || t.accentSoft, fontSize: 9, fontWeight: 700, color: color || t.accent, letterSpacing: "0.02em" }}>{label}</span>;
};
const Dot = ({ level, t }) => <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: { high: t.green, med: t.amber, low: t.red }[level] || t.green, flexShrink: 0 }} />;
const FitBadge = ({ fit, label, t }) => {
  const s = { great: [t.green, t.greenSoft], good: [t.accent, t.accentSoft], warn: [t.amber, t.amberSoft] }[fit] || [t.sub, t.dim + "20"];
  return <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: s[1], color: s[0] }}>{label}</span>;
};
const IconBox = ({ icon, color, size = 32, iconSize = 16, radius = 8 }) => (
  <div style={{ width: size, height: size, borderRadius: radius, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon(color, iconSize)}</div>
);

/* ── RING ── */
function Ring({ t, progress, expanded, onToggle, size = 160 }) {
  const [a, setA] = useState({ cal: 0, p: 0, c: 0, f: 0 });
  useEffect(() => { const tm = setTimeout(() => setA(progress), 200); return () => clearTimeout(tm); }, [progress]);
  const sw = 8, msw = 5, cx = size / 2, r = (size - sw) / 2 - 2;
  const mr = [r - 13, r - 24, r - 35];
  const arc = (rad, pct) => { const an = Math.min(pct, 0.999) * 360, rd = ((an - 90) * Math.PI) / 180; return `M ${cx} ${cx - rad} A ${rad} ${rad} 0 ${an > 180 ? 1 : 0} 1 ${cx + rad * Math.cos(rd)} ${cx + rad * Math.sin(rd)}`; };
  const rem = Math.max(0, 2100 - Math.round(2100 * a.cal));
  return (
    <div onClick={onToggle} style={{ cursor: "pointer", userSelect: "none" }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={t.ringBg} strokeWidth={sw} />
        <path d={arc(r, a.cal)} fill="none" stroke={t.green} strokeWidth={sw} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1)" }} />
        {expanded && [[mr[0], a.p, t.protein], [mr[1], a.c, t.carbs], [mr[2], a.f, t.fat]].map(([rad, v, col], i) => (
          <g key={i}><circle cx={cx} cy={cx} r={rad} fill="none" stroke={t.ringBg} strokeWidth={msw} opacity={0.4} />
          <path d={arc(rad, v)} fill="none" stroke={col} strokeWidth={msw} strokeLinecap="round" style={{ transition: `all 1s cubic-bezier(0.22,1,0.36,1) ${0.08*(i+1)}s` }} /></g>
        ))}
        <text x={cx} y={cx - 2} textAnchor="middle" fill={t.text} fontSize={expanded ? 22 : 28} fontWeight="700" fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>{rem}</text>
        <text x={cx} y={cx + (expanded ? 12 : 15)} textAnchor="middle" fill={t.dim} fontSize="9" fontWeight="600" fontFamily="inherit" letterSpacing="0.08em">KCAL LEFT</text>
      </svg>
    </div>
  );
}

/* ── MACRO CARD ── */
const MacroCard = ({ label, cur, tgt, color, t }) => (
  <div style={{ flex: 1, padding: "10px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: t.sub, letterSpacing: "0.05em" }}>{label}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{cur}g</div>
    <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: t.ringBg }}>
      <div style={{ width: `${Math.min(cur / tgt, 1) * 100}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.8s" }} />
    </div>
    <div style={{ fontSize: 10, color: t.dim, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>of {tgt}g</div>
  </div>
);

/* ── SECTION LABEL ── */
const Section = ({ children, t, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 600, color: t.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</div>
    {right}
  </div>
);

/* ── DATA ── */
const MEALS = [
  { name: "Breakfast", icon: IC.coffee, color: null, time: "8:15 AM", cal: 485, items: [
    { name: "Greek Yogurt", portion: "200g", cal: 130, conf: "high" }, { name: "Granola", portion: "45g", cal: 195, conf: "high" },
    { name: "Blueberries", portion: "1 cup", cal: 85, conf: "high" }, { name: "Honey", portion: "1 tbsp", cal: 75, conf: "med" },
  ]},
  { name: "Lunch", icon: IC.sun, color: null, time: "12:30 PM", cal: 620, items: [
    { name: "Chicken Breast", portion: "150g", cal: 248, conf: "high" }, { name: "Brown Rice", portion: "1 cup", cal: 216, conf: "high" },
    { name: "Mixed Greens", portion: "2 cups", cal: 18, conf: "high" }, { name: "Olive Oil Dressing", portion: "2 tbsp", cal: 138, conf: "med" },
  ]},
];

const FEED = [
  { id: 1, title: "Creamy Tuscan Chicken Pasta", creator: "Sarah Cooks", src: "tiktok", time: "25 min", cal: 520, p: 38, c: 52, f: 16, fit: "good", fitLabel: "Fits your dinner", saves: 2340, made: 891 },
  { id: 2, title: "High Protein Overnight Oats", creator: "FitMeals", src: "instagram", time: "5 min", cal: 385, p: 32, c: 45, f: 8, fit: "great", fitLabel: "Perfect breakfast", saves: 5120, made: 3200 },
  { id: 3, title: "Korean Beef Bibimbap Bowl", creator: "Chef Min", src: "youtube", time: "35 min", cal: 610, p: 42, c: 65, f: 18, fit: "warn", fitLabel: "High carb for targets", saves: 1890, made: 720 },
  { id: 4, title: "Mediterranean Chicken Bowl", creator: "HealthyEats", src: "suppr", time: "20 min", cal: 485, p: 44, c: 38, f: 14, fit: "great", fitLabel: "Macro balanced", saves: 3400, made: 1560 },
  { id: 5, title: "Peanut Butter Banana Smoothie", creator: "BlendQueen", src: "tiktok", time: "3 min", cal: 340, p: 18, c: 42, f: 12, fit: "good", fitLabel: "Great snack", saves: 8900, made: 5100 },
  { id: 6, title: "Salmon Teriyaki with Greens", creator: "OceanTable", src: "instagram", time: "22 min", cal: 440, p: 36, c: 28, f: 20, fit: "great", fitLabel: "High protein dinner", saves: 4200, made: 1800 },
];

const RECIPE = {
  title: "Creamy Tuscan Chicken Pasta", creator: "Sarah Cooks", src: "tiktok",
  desc: "A rich, creamy pasta with sun-dried tomatoes, spinach, and perfectly seared chicken.", time: "25 min", cook: "20 min", servings: 4, difficulty: "Easy",
  cal: 520, p: 38, c: 52, f: 16, confidence: 87,
  ingredients: [
    { name: "Chicken Breast", qty: "500g", cal: 275, p: 52, c: 0, f: 6, conf: "high" },
    { name: "Penne Pasta", qty: "300g", cal: 450, p: 15, c: 90, f: 2, conf: "high" },
    { name: "Heavy Cream", qty: "200ml", cal: 340, p: 2, c: 4, f: 36, conf: "high" },
    { name: "Sun-dried Tomatoes", qty: "80g", cal: 105, p: 3, c: 12, f: 6, conf: "med" },
    { name: "Baby Spinach", qty: "100g", cal: 23, p: 3, c: 3, f: 0, conf: "high" },
    { name: "Parmesan", qty: "60g", cal: 240, p: 22, c: 2, f: 16, conf: "high" },
    { name: "Garlic", qty: "4 cloves", cal: 18, p: 1, c: 4, f: 0, conf: "med" },
    { name: "Olive Oil", qty: "2 tbsp", cal: 240, p: 0, c: 0, f: 28, conf: "high" },
  ],
  steps: [
    "Season chicken with salt, pepper, and Italian herbs. Slice into strips.",
    "Cook pasta in salted boiling water until al dente. Reserve 1 cup pasta water.",
    "Heat olive oil over medium-high. Sear chicken strips 3–4 min per side. Remove.",
    "Add minced garlic, cook 30 seconds until fragrant.",
    "Add sun-dried tomatoes, cream, and half the parmesan. Stir until simmering.",
    "Add spinach, stir until wilted — about 1 minute.",
    "Return chicken, add pasta and toss. Add pasta water as needed.",
    "Top with remaining parmesan and serve immediately.",
  ],
};

const PLAN = [
  { day: "Mon", meals: [{ n: "Overnight Oats", c: 385 }, { n: "Chicken Bowl", c: 485 }, { n: "Salmon Teriyaki", c: 440 }], total: 1310 },
  { day: "Tue", meals: [{ n: "Smoothie Bowl", c: 340 }, { n: "Turkey Wrap", c: 420 }, { n: "Tuscan Pasta", c: 520 }], total: 1280 },
  { day: "Wed", meals: [{ n: "Egg Muffins", c: 290 }, { n: "Bibimbap", c: 610 }, { n: "Grilled Fish", c: 380 }], total: 1280 },
  { day: "Thu", meals: [{ n: "Protein Pancakes", c: 360 }, { n: "Caesar Salad", c: 410 }], total: 770 },
  { day: "Fri", meals: [{ n: "Granola Bowl", c: 420 }, { n: "Poke Bowl", c: 490 }, { n: "Stir Fry", c: 460 }], total: 1370 },
  { day: "Sat", meals: [], total: 0 },
  { day: "Sun", meals: [{ n: "Avocado Toast", c: 380 }], total: 380 },
];


/* ═══════════════════════════════════════════
   SCREENS
   ═══════════════════════════════════════════ */

function TodayScreen({ t, nav }) {
  const [expanded, setExpanded] = useState(false);
  const [openMeal, setOpenMeal] = useState(0);
  const progress = { cal: 0.53, p: 0.30, c: 0.48, f: 0.46 };
  const mealColor = (n) => ({ Breakfast: t.amber, Lunch: t.green, Dinner: t.accent, Snacks: t.fat }[n] || t.accent);
  const mealIcon = (n) => ({ Breakfast: IC.coffee, Lunch: IC.sun, Dinner: IC.plate, Snacks: IC.star }[n] || IC.plate);

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Apr 13 · Sunday</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: "-0.02em", marginTop: 2 }}>Today</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>G</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 4px" }}>
        <Ring t={t} progress={progress} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: t.dim, marginBottom: 10 }}>{expanded ? "Tap to collapse" : "Tap for macro breakdown"}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <MacroCard label="Protein" cur={45} tgt={150} color={t.protein} t={t} />
        <MacroCard label="Carbs" cur={120} tgt={250} color={t.carbs} t={t} />
        <MacroCard label="Fat" cur={30} tgt={65} color={t.fat} t={t} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["Photo", IC.camera, t.accent], ["Voice", IC.mic, t.green], ["Search", IC.search, t.amber], ["Scan", IC.scan, t.fat]].map(([label, icon, color], i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}`, cursor: "pointer" }}>
            <IconBox icon={icon} color={color} size={28} iconSize={14} />
            <span style={{ fontSize: 10, fontWeight: 500, color: t.sub }}>{label}</span>
          </div>
        ))}
      </div>

      <Section t={t}>Meals</Section>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
        {MEALS.map((meal, mi) => (
          <div key={mi}>
            <div onClick={() => setOpenMeal(openMeal === mi ? -1 : mi)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
              <IconBox icon={mealIcon(meal.name)} color={mealColor(meal.name)} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{meal.name}</div><div style={{ fontSize: 11, color: t.dim }}>{meal.time} · {meal.items.length} items</div></div>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{meal.cal}</span>
              <span style={{ fontSize: 10, color: t.dim }}>kcal</span>
            </div>
            {openMeal === mi && meal.items.map((item, ii) => (
              <div key={ii} style={{ padding: "9px 14px 9px 56px", display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${t.border}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot level={item.conf} t={t} /><span style={{ fontSize: 12, color: t.text }}>{item.name}</span><span style={{ fontSize: 10, color: t.dim }}>{item.portion}</span></div>
                <span style={{ fontSize: 12, color: t.sub, fontVariantNumeric: "tabular-nums" }}>{item.cal}</span>
              </div>
            ))}
          </div>
        ))}
        {["Dinner", "Snacks"].map((n) => (
          <div key={n} onClick={() => nav("feed")} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${t.border}`, cursor: "pointer", opacity: 0.45 }}>
            <IconBox icon={mealIcon(n)} color={mealColor(n)} /><span style={{ flex: 1, fontSize: 13, color: t.dim }}>{n}</span>{IC.plus(t.dim, 14)}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderRadius: 14, background: t.greenSoft, border: `1px solid ${t.green}22` }}>
        <IconBox icon={IC.flame} color={t.green} size={36} iconSize={18} radius={10} />
        <div><div style={{ fontSize: 12, fontWeight: 600, color: t.green }}>5-day protein streak</div><div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Consistently on target. Keep it going.</div></div>
      </div>
    </div>
  );
}

function FeedScreen({ t, nav, setRecipe }) {
  const [filter, setFilter] = useState("For You");
  const fitColor = (f) => ({ great: t.green, good: t.accent, warn: t.amber }[f] || t.accent);
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>Discover</div>
        <div style={{ fontSize: 12, color: t.dim, marginTop: 1 }}>Recipes that fit your macros</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: t.elevated, border: `1px solid ${t.border}`, marginBottom: 12 }}>
        {IC.search(t.dim, 15)}<span style={{ fontSize: 12, color: t.dim }}>Search or paste a link...</span>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
        {["For You", "Popular", "Quick", "High Protein", "Low Carb"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${filter === f ? t.accent : t.border}`, background: filter === f ? t.accentSoft : "transparent", color: filter === f ? t.accent : t.sub, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>{f}</button>
        ))}
      </div>

      <div onClick={() => nav("import")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderRadius: 14, background: `linear-gradient(135deg, ${t.accentSoft}, ${t.greenSoft})`, border: `1px solid ${t.accent}22`, marginBottom: 14, cursor: "pointer" }}>
        <IconBox icon={IC.download} color={t.accent} size={36} iconSize={18} radius={10} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Import from TikTok, Instagram...</div><div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Paste a link or share from any app</div></div>
        {IC.chevRight(t.dim, 16)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {FEED.map((r) => (
          <div key={r.id} onClick={() => { setRecipe(r); nav("recipe"); }} style={{ borderRadius: 14, background: t.elevated, border: `1px solid ${t.border}`, overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 80, background: `linear-gradient(135deg, ${fitColor(r.fit)}10, ${fitColor(r.fit)}25)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {IC.utensils(fitColor(r.fit), 28)}
              <div style={{ position: "absolute", top: 8, left: 8 }}><SourceBadge source={r.src} t={t} /></div>
            </div>
            <div style={{ padding: "10px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.3, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
              <div style={{ fontSize: 10, color: t.dim, marginBottom: 6 }}>{r.creator} · {r.time}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {[["P", r.p, t.protein], ["C", r.c, t.carbs], ["F", r.f, t.fat]].map(([l, v, c], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}><div style={{ width: 4, height: 4, borderRadius: 1, background: c }} /><span style={{ fontSize: 10, color: t.sub }}>{v}g</span></div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{r.cal}<span style={{ fontSize: 9, fontWeight: 400, color: t.dim }}> kcal</span></span>
                <FitBadge fit={r.fit} label={r.fit === "great" ? "Great" : r.fit === "warn" ? "High" : "Good"} t={t} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 9, color: t.dim }}>
                <span>{r.saves.toLocaleString()} saves</span><span>{r.made.toLocaleString()} made</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportScreen({ t, nav }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (step === 1) { const tm = setTimeout(() => setStep(2), 2000); return () => clearTimeout(tm); } }, [step]);

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 4px", display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => nav("feed")} style={{ cursor: "pointer", padding: 2 }}>{IC.chevLeft(t.text, 20)}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Import Recipe</div>
      </div>

      {step === 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: t.sub, marginBottom: 14, lineHeight: 1.5 }}>Paste a link from TikTok, Instagram, YouTube, or any recipe website.</div>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: t.elevated, border: `1px solid ${t.border}`, fontSize: 12, color: t.dim, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {IC.link(t.dim, 14)}<span>https://www.tiktok.com/@sarahcooks/...</span>
          </div>
          <Section t={t}>Import from</Section>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[["TikTok", "tiktok", IC.star], ["Instagram", "instagram", IC.camera], ["YouTube", "youtube", IC.compass], ["Website", "web", IC.globe]].map(([name, src, icon]) => (
              <div key={name} onClick={() => setStep(1)} style={{ padding: "14px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <IconBox icon={icon} color={t.accent} size={32} iconSize={15} />
                <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{name}</span>
              </div>
            ))}
          </div>
          <Section t={t}>Recent imports</Section>
          {[["Protein Ice Cream", "tiktok", "2 days ago"], ["Sheet Pan Fajitas", "instagram", "5 days ago"]].map(([n, s, time], i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <SourceBadge source={s} t={t} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: t.text }}>{n}</div><div style={{ fontSize: 10, color: t.dim }}>{time}</div></div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div style={{ marginTop: 50, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: `3px solid ${t.ringBg}`, borderTopColor: t.accent, margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 6 }}>Extracting recipe...</div>
          <div style={{ fontSize: 12, color: t.dim }}>Parsing ingredients and calculating macros</div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10, textAlign: "left", padding: "0 30px" }}>
            {["Extracting ingredients", "Matching nutrition data", "Calculating macros"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: i < 2 ? t.green : t.ringBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{i < 2 && IC.check("#fff", 10)}</div>
                <span style={{ fontSize: 12, color: i < 2 ? t.text : t.dim }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ borderRadius: 14, border: `1px solid ${t.border}`, background: t.elevated, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ height: 100, background: `linear-gradient(135deg, ${t.accent}12, ${t.accent}25)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {IC.utensils(t.accent, 36)}<div style={{ position: "absolute", top: 10, left: 10 }}><SourceBadge source="tiktok" t={t} /></div>
            </div>
            <div style={{ padding: "14px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Creamy Tuscan Chicken Pasta</div>
              <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>by Sarah Cooks · 25 min · 4 servings</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[["87%", "Confidence", t.green], ["520", "kcal/serv", t.accent]].map(([v, l, c], i) => (
                  <div key={i} style={{ flex: 1, padding: "8px", borderRadius: 10, background: c + "12", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                    <div style={{ fontSize: 10, color: c, opacity: 0.7, marginTop: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <MacroCard label="Protein" cur={38} tgt={38} color={t.protein} t={t} />
                <MacroCard label="Carbs" cur={52} tgt={52} color={t.carbs} t={t} />
                <MacroCard label="Fat" cur={16} tgt={16} color={t.fat} t={t} />
              </div>
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: 14, background: t.greenSoft, border: `1px solid ${t.green}22`, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.green, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>How this fits your day</div>
            <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5, marginBottom: 8 }}>Uses <strong>45%</strong> of remaining carbs and <strong>25%</strong> of protein. Good fit for dinner.</div>
            <div style={{ height: 6, borderRadius: 3, background: t.ringBg, overflow: "hidden", display: "flex", gap: 2 }}>
              <div style={{ width: "53%", background: t.green, borderRadius: 3 }} /><div style={{ width: "25%", background: t.greenMid, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: t.dim }}><span>Eaten: 1,105 kcal</span><span>After: 1,625 kcal</span></div>
          </div>

          <Section t={t}>Parsed ingredients (8)</Section>
          <div style={{ background: t.elevated, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 16 }}>
            {RECIPE.ingredients.slice(0, 5).map((ing, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}08`, display: "flex", alignItems: "center", gap: 8 }}>
                <Dot level={ing.conf} t={t} /><div style={{ flex: 1 }}><span style={{ fontSize: 12, color: t.text }}>{ing.name}</span><span style={{ fontSize: 10, color: t.dim, marginLeft: 6 }}>{ing.qty}</span></div>
                <span style={{ fontSize: 11, color: t.sub, fontVariantNumeric: "tabular-nums" }}>{ing.cal} kcal</span>
              </div>
            ))}
            <div style={{ padding: "8px 14px", fontSize: 11, color: t.accent, fontWeight: 500 }}>+ 3 more</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("recipe")} style={{ flex: 1, padding: "13px", borderRadius: 10, background: t.accent, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Save to Library</button>
            <button style={{ padding: "13px 16px", borderRadius: 10, background: t.elevated, color: t.text, fontSize: 13, fontWeight: 600, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: "inherit" }}>Add to Plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeScreen({ t, nav }) {
  const [tab, setTab] = useState("ingredients");
  const [cookMode, setCookMode] = useState(false);
  const r = RECIPE;

  if (cookMode) return <CookScreen t={t} recipe={r} onExit={() => setCookMode(false)} />;

  return (
    <div>
      <div style={{ height: 180, background: `linear-gradient(135deg, ${t.accent}12, ${t.accent}30)`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {IC.utensils(t.accent, 48)}
        <div onClick={() => nav("feed")} style={{ position: "absolute", top: 12, left: 14, width: 32, height: 32, borderRadius: 10, background: t.elevated, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{IC.chevLeft(t.text, 16)}</div>
        <div style={{ position: "absolute", top: 12, right: 14, display: "flex", gap: 6 }}>
          {[IC.bookmark, IC.share].map((ic, i) => <div key={i} style={{ width: 32, height: 32, borderRadius: 10, background: t.elevated, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{ic(t.text, 15)}</div>)}
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 14 }}><SourceBadge source={r.src} t={t} /></div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={{ padding: "14px 0 8px" }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>{r.title}</div>
          <div style={{ fontSize: 12, color: t.sub, marginTop: 3 }}>{r.creator} · {r.desc}</div>
        </div>

        <div style={{ display: "flex", gap: 12, padding: "10px 0 14px", borderBottom: `1px solid ${t.border}` }}>
          {[[r.time, "Prep", IC.clock], [r.cook, "Cook", IC.timer], [`${r.servings}`, "Servings", IC.users], [`${r.confidence}%`, "Confidence", IC.check]].map(([v, l, ic], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {ic(t.dim, 14)}<div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{v}</div><div style={{ fontSize: 9, color: t.dim }}>{l}</div></div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
          <MacroCard label="Protein" cur={r.p} tgt={r.p} color={t.protein} t={t} />
          <MacroCard label="Carbs" cur={r.c} tgt={r.c} color={t.carbs} t={t} />
          <MacroCard label="Fat" cur={r.f} tgt={r.f} color={t.fat} t={t} />
          <div style={{ display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 12, background: t.greenSoft, border: `1px solid ${t.green}22` }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.green, fontVariantNumeric: "tabular-nums" }}>{r.cal}</span><span style={{ fontSize: 9, color: t.green, marginLeft: 2 }}>kcal</span>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
          {["ingredients", "steps", "nutrition"].map((tb) => (
            <div key={tb} onClick={() => setTab(tb)} style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", color: tab === tb ? t.accent : t.dim, borderBottom: tab === tb ? `2px solid ${t.accent}` : "2px solid transparent", textTransform: "capitalize" }}>{tb}</div>
          ))}
        </div>

        {tab === "ingredients" && r.ingredients.map((ing, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${t.border}08` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot level={ing.conf} t={t} /><span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{ing.name}</span></div>
              <span style={{ fontSize: 12, color: t.sub, fontVariantNumeric: "tabular-nums" }}>{ing.cal} kcal</span>
            </div>
            <div style={{ fontSize: 11, color: t.dim, marginTop: 2, marginLeft: 12 }}>{ing.qty}</div>
            <div style={{ display: "flex", gap: 2, marginTop: 4, height: 3, borderRadius: 2, overflow: "hidden" }}>
              {[[ing.p, t.protein], [ing.c, t.carbs], [ing.f, t.fat]].map(([v, c], j) => (
                <div key={j} style={{ width: `${Math.max((v / Math.max(ing.p + ing.c + ing.f, 1)) * 100, 3)}%`, background: c, borderRadius: 2, minWidth: 2 }} />
              ))}
            </div>
          </div>
        ))}

        {tab === "steps" && r.steps.map((s, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${t.border}08`, display: "flex", gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, paddingTop: 2 }}>{s}</div>
          </div>
        ))}

        {tab === "nutrition" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[["Calories", r.cal, "kcal", t.green], ["Protein", r.p, "g", t.protein], ["Carbs", r.c, "g", t.carbs], ["Fat", r.f, "g", t.fat]].map(([l, v, u, c], i) => (
                <div key={i} style={{ padding: "12px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}<span style={{ fontSize: 11, fontWeight: 400 }}>{u}</span></div>
                  <div style={{ fontSize: 10, color: t.dim, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <Section t={t}>Micronutrients</Section>
            {[["Fiber", "4.2g", 0.3], ["Iron", "3.1mg", 0.4], ["Calcium", "180mg", 0.18], ["Vitamin A", "2400 IU", 0.48], ["Vitamin C", "15mg", 0.17]].map(([n, v, pct], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ fontSize: 12, color: t.text, width: 75 }}>{n}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: t.ringBg }}><div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 2, background: pct > 0.3 ? t.green : t.amber }} /></div>
                <span style={{ fontSize: 11, color: t.sub, fontVariantNumeric: "tabular-nums", width: 50, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, paddingBottom: 16 }}>
          <button onClick={() => setCookMode(true)} style={{ flex: 1, padding: "13px", borderRadius: 10, background: t.accent, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{IC.utensils("#fff", 15)} Start Cooking</button>
          <button style={{ flex: 1, padding: "13px", borderRadius: 10, background: t.elevated, color: t.text, fontSize: 13, fontWeight: 600, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: "inherit" }}>I Made This</button>
        </div>
      </div>
    </div>
  );
}

function CookScreen({ t, recipe, onExit }) {
  const [step, setStep] = useState(0);
  const [timer, setTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef();
  useEffect(() => { if (timer !== null) { ref.current = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(ref.current); } else clearInterval(ref.current); }, [timer]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}` }}>
        <div onClick={onExit} style={{ fontSize: 13, fontWeight: 500, color: t.red, cursor: "pointer" }}>Exit</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.dim }}>Step {step + 1} of {recipe.steps.length}</div>
        <div style={{ width: 30 }} />
      </div>
      <div style={{ height: 3, background: t.ringBg }}><div style={{ width: `${((step + 1) / recipe.steps.length) * 100}%`, height: "100%", background: t.accent, transition: "width 0.3s" }} /></div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 28px", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: t.accent, margin: "0 auto 20px" }}>{step + 1}</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: t.text, lineHeight: 1.6 }}>{recipe.steps[step]}</div>
        {timer !== null ? (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 38, fontWeight: 700, color: t.accent, fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</div>
            <button onClick={() => { setTimer(null); setElapsed(0); }} style={{ marginTop: 8, padding: "6px 16px", borderRadius: 8, background: t.redSoft, color: t.red, border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Stop</button>
          </div>
        ) : (
          <button onClick={() => setTimer(1)} style={{ margin: "24px auto 0", padding: "10px 20px", borderRadius: 10, background: t.elevated, border: `1px solid ${t.border}`, color: t.sub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>{IC.timer(t.sub, 15)} Start Timer</button>
        )}
      </div>
      <div style={{ padding: "14px 20px", display: "flex", gap: 8, borderTop: `1px solid ${t.border}` }}>
        <button onClick={() => step > 0 && setStep(step - 1)} style={{ flex: 1, padding: "13px", borderRadius: 10, background: t.elevated, color: step > 0 ? t.text : t.dim, fontSize: 13, fontWeight: 600, border: `1px solid ${t.border}`, cursor: step > 0 ? "pointer" : "default", fontFamily: "inherit", opacity: step === 0 ? 0.4 : 1 }}>Previous</button>
        <button onClick={() => step < recipe.steps.length - 1 ? setStep(step + 1) : onExit()} style={{ flex: 1, padding: "13px", borderRadius: 10, background: t.accent, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{step < recipe.steps.length - 1 ? "Next Step" : "Done!"}</button>
      </div>
    </div>
  );
}

function PlanScreen({ t }) {
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>Meal Plan</div><div style={{ fontSize: 12, color: t.dim, marginTop: 1 }}>Apr 7 – Apr 13</div></div>
        <button style={{ padding: "8px 12px", borderRadius: 8, background: t.accentSoft, color: t.accent, fontSize: 11, fontWeight: 600, border: `1px solid ${t.accent}22`, cursor: "pointer", fontFamily: "inherit" }}>AI Auto-fill</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 0 16px" }}>
        {PLAN.map((d, i) => {
          const pct = d.total / 2100;
          const isToday = d.day === "Sun";
          return (
            <div key={i} style={{ minWidth: 96, flex: "0 0 auto", borderRadius: 12, padding: "10px", background: isToday ? t.accentSoft : t.elevated, border: `1px solid ${isToday ? t.accent + "33" : t.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? t.accent : t.dim, textAlign: "center", marginBottom: 6 }}>{d.day}</div>
              {d.meals.length > 0 ? d.meals.map((m, j) => (
                <div key={j} style={{ padding: "3px 0", fontSize: 10, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.n}</div>
              )) : <div style={{ padding: "10px 0", textAlign: "center", fontSize: 10, color: t.dim }}>Empty</div>}
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: t.ringBg }}><div style={{ width: `${Math.min(pct, 1) * 100}%`, height: "100%", borderRadius: 2, background: pct > 0.9 ? t.green : pct > 0.5 ? t.amber : t.dim }} /></div>
              <div style={{ fontSize: 9, color: t.dim, textAlign: "center", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{d.total} / 2100</div>
            </div>
          );
        })}
      </div>
      <Section t={t}>Sunday's plan</Section>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
          <IconBox icon={IC.utensils} color={t.green} size={40} iconSize={18} radius={12} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Avocado Toast</div><div style={{ fontSize: 11, color: t.dim }}>Breakfast · 380 kcal</div></div>
        </div>
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "12px 14px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: t.accent, fontWeight: 500, cursor: "pointer" }}>+ Add meal</span>
        </div>
      </div>
      <div style={{ padding: "14px", borderRadius: 14, background: t.elevated, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <IconBox icon={IC.cart} color={t.amber} size={36} iconSize={18} radius={10} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Shopping List</div><div style={{ fontSize: 11, color: t.dim }}>23 items from this week</div></div>
        {IC.chevRight(t.dim, 16)}
      </div>
    </div>
  );
}

function ProgressScreen({ t }) {
  const week = [1850, 2050, 1980, 2200, 1750, 2100, 1105];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 14px" }}><div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>Progress</div><div style={{ fontSize: 12, color: t.dim, marginTop: 1 }}>Weekly report</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[["Avg Calories", "1,862", "vs 2,100 target", t.amber, IC.flame], ["Protein Hit", "5/7", "days on target", t.green, IC.check], ["Streak", "5 days", "protein goal", t.green, IC.award], ["Trend", "-0.4 kg", "on track", t.accent, IC.barChart]].map(([title, val, sub, color, icon], i) => (
          <div key={i} style={{ padding: "14px", borderRadius: 14, background: t.elevated, border: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><IconBox icon={icon} color={color} size={24} iconSize={12} radius={6} /><span style={{ fontSize: 10, color: t.dim, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{val}</div>
            <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Daily Calories</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
          {week.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: t.dim, fontVariantNumeric: "tabular-nums" }}>{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</span>
              <div style={{ width: "100%", height: `${(v / 2400) * 70}px`, borderRadius: 5, background: v <= 2100 ? t.green : t.amber, opacity: i === 6 ? 0.4 : 0.75, transition: "height 0.6s" }} />
              <span style={{ fontSize: 10, color: t.dim, fontWeight: 500 }}>{days[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Macro Adherence</div>
        {[["Protein", 82, t.protein], ["Carbs", 91, t.carbs], ["Fat", 78, t.fat]].map(([n, pct, c], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} /><span style={{ fontSize: 12, color: t.sub, width: 50 }}>{n}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.ringBg }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: c }} /></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: c, width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px", borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}22` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><IconBox icon={IC.star} color={t.accent} size={24} iconSize={12} radius={6} /><span style={{ fontSize: 10, fontWeight: 600, color: t.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>Weekly insight</span></div>
        <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>Protein consistency is strong — 5 of 7 days on target. Fat dipped below target on Thursday and Saturday. Consider adding nuts as snacks.</div>
      </div>
    </div>
  );
}

function ProfileScreen({ t }) {
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ padding: "18px 0 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: t.accent }}>G</div>
        <div><div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Grace Turner</div><div style={{ fontSize: 12, color: t.dim }}>Pro · Joined Jan 2026</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["42", "Recipes", t.accent], ["12", "Published", t.green], ["238", "Followers", t.amber]].map(([v, l, c], i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 10, color: t.dim, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <Section t={t}>Settings</Section>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
        {[["Daily Targets", "2,100 kcal · 150P / 250C / 65F", IC.flame], ["Preferences", "No restrictions", IC.utensils], ["Connected", "Apple Health, Instagram", IC.link], ["Notifications", "Daily reminder at 7 PM", IC.clock], ["Export Data", "CSV download", IC.download]].map(([title, sub, icon], i, arr) => (
          <div key={i} style={{ padding: "13px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <IconBox icon={icon} color={t.accent} size={30} iconSize={14} radius={8} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{title}</div><div style={{ fontSize: 11, color: t.dim, marginTop: 1 }}>{sub}</div></div>
            {IC.chevRight(t.dim, 14)}
          </div>
        ))}
      </div>
      <Section t={t}>Creator tools</Section>
      <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        {[["Published Recipes", "12 recipes · 891 total makes", IC.edit], ["Analytics", "Views, saves, engagement", IC.barChart], ["Publish New", "Share with the community", IC.plus]].map(([title, sub, icon], i, arr) => (
          <div key={i} style={{ padding: "13px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <IconBox icon={icon} color={t.green} size={30} iconSize={14} radius={8} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{title}</div><div style={{ fontSize: 11, color: t.dim, marginTop: 1 }}>{sub}</div></div>
            {IC.chevRight(t.dim, 14)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN SHELL
   ═══════════════════════════════════════════ */
export default function Suppr() {
  const [isDark, setIsDark] = useState(false);
  const [screen, setScreen] = useState("today");
  const [recipe, setRecipe] = useState(null);
  const t = isDark ? DARK : LIGHT;

  const tabs = [
    { id: "today", label: "Today", icon: IC.plate },
    { id: "feed", label: "Discover", icon: IC.compass },
    { id: "plan", label: "Plan", icon: IC.calendar },
    { id: "progress", label: "Progress", icon: IC.flame },
    { id: "profile", label: "Profile", icon: IC.users },
  ];

  const render = () => {
    switch (screen) {
      case "today": return <TodayScreen t={t} nav={setScreen} />;
      case "feed": return <FeedScreen t={t} nav={setScreen} setRecipe={setRecipe} />;
      case "import": return <ImportScreen t={t} nav={setScreen} />;
      case "recipe": return <RecipeScreen t={t} nav={setScreen} />;
      case "plan": return <PlanScreen t={t} />;
      case "progress": return <ProgressScreen t={t} />;
      case "profile": return <ProfileScreen t={t} />;
      default: return <TodayScreen t={t} nav={setScreen} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: isDark ? "#080808" : "#e0e0e6", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setIsDark(!isDark)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#18181c" : "#fff", color: isDark ? "#e4e4e8" : "#111", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          {isDark ? IC.moon(isDark ? "#e4e4e8" : "#111", 12) : IC.sun(isDark ? "#e4e4e8" : "#111", 12)} {isDark ? "Dark" : "Light"}
        </button>
        {["today", "feed", "import", "recipe", "plan", "progress", "profile"].map((s) => (
          <button key={s} onClick={() => setScreen(s)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${screen === s ? t.accent : isDark ? "#333" : "#ccc"}`, background: screen === s ? t.accentSoft : isDark ? "#18181c" : "#fff", color: screen === s ? t.accent : isDark ? "#e4e4e8" : "#111", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {s === "feed" ? "Discover" : s}
          </button>
        ))}
      </div>

      <div style={{
        width: 375, maxHeight: 812, background: t.bg, borderRadius: 40, overflow: "hidden",
        display: "flex", flexDirection: "column",
        border: `1px solid ${isDark ? "#222" : "#d0d0d4"}`,
        boxShadow: isDark ? "0 24px 60px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.1)",
      }}>
        <div style={{ padding: "12px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>9:41</span>
          <div style={{ display: "flex", gap: 4 }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill={t.text}><rect x="0" y="4" width="3" height="8" rx="0.5" opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" opacity="0.6"/><rect x="9" y="1" width="3" height="11" rx="0.5" opacity="0.8"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={t.text} strokeOpacity="0.35"/><rect x="2" y="2" width="14" height="8" rx="1" fill={t.green}/></svg>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>{render()}</div>

        {!["import", "recipe"].includes(screen) && (
          <div style={{ display: "flex", borderTop: `1px solid ${t.border}`, background: t.elevated, padding: "6px 0 2px", flexShrink: 0 }}>
            {tabs.map((tab) => (
              <div key={tab.id} onClick={() => setScreen(tab.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "3px 0", cursor: "pointer" }}>
                {tab.icon(screen === tab.id ? t.accent : t.dim, 20)}
                <span style={{ fontSize: 9, fontWeight: screen === tab.id ? 600 : 400, color: screen === tab.id ? t.accent : t.dim }}>{tab.label}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0", flexShrink: 0 }}>
          <div style={{ width: 134, height: 5, borderRadius: 3, background: t.dim, opacity: 0.3 }} />
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: isDark ? "#444" : "#999" }}>Suppr · Icon-driven & Structured</div>
      </div>
    </div>
  );
}
