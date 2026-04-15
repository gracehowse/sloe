import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   THREE DESIGN VARIATIONS — same data, different aesthetics
   A: Minimal & Typographic (Linear/Stripe)
   B: Photo-forward & Editorial (Bon Appétit meets tracking)
   C: Icon-driven & Structured (systematic, refined)
   ═══════════════════════════════════════════════════════════ */

// ── SHARED DATA ──
const MEALS_DATA = [
  { name: "Breakfast", time: "8:15 AM", cal: 485, items: [
    { name: "Greek Yogurt", portion: "200g", cal: 130, conf: "high" },
    { name: "Granola", portion: "45g", cal: 195, conf: "high" },
    { name: "Blueberries", portion: "1 cup", cal: 85, conf: "high" },
    { name: "Honey", portion: "1 tbsp", cal: 75, conf: "med" },
  ]},
  { name: "Lunch", time: "12:30 PM", cal: 620, items: [
    { name: "Chicken Breast", portion: "150g", cal: 248, conf: "high" },
    { name: "Brown Rice", portion: "1 cup", cal: 216, conf: "high" },
    { name: "Mixed Greens", portion: "2 cups", cal: 18, conf: "high" },
    { name: "Olive Oil Dressing", portion: "2 tbsp", cal: 138, conf: "med" },
  ]},
];

const FEED_DATA = [
  { id: 1, title: "Creamy Tuscan Chicken Pasta", creator: "Sarah Cooks", source: "tiktok", time: "25 min", cal: 520, p: 38, c: 52, f: 16, fit: "good", fitLabel: "Fits your dinner", saves: 2340, made: 891, hue: 30 },
  { id: 2, title: "High Protein Overnight Oats", creator: "FitMeals", source: "instagram", time: "5 min", cal: 385, p: 32, c: 45, f: 8, fit: "great", fitLabel: "Perfect for breakfast", saves: 5120, made: 3200, hue: 45 },
  { id: 3, title: "Korean Beef Bibimbap Bowl", creator: "Chef Min", source: "youtube", time: "35 min", cal: 610, p: 42, c: 65, f: 18, fit: "warn", fitLabel: "High carb for targets", saves: 1890, made: 720, hue: 15 },
  { id: 4, title: "Mediterranean Chicken Bowl", creator: "HealthyEats", source: "suppr", time: "20 min", cal: 485, p: 44, c: 38, f: 14, fit: "great", fitLabel: "Macro balanced", saves: 3400, made: 1560, hue: 120 },
];

// ── SHARED ICONS (SVG paths, no emojis anywhere) ──
const I = {
  chevDown: (c, s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  chevRight: (c, s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  plus: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  camera: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  mic: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
  scan: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  star: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  bookmark: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  download: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  flame: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  utensils: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  clock: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  users: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  check: (c, s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  sun: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  coffee: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  plate: (c, s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,
};

const SRC_LABEL = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", suppr: "Suppr" };

// ── RING COMPONENT (shared, style-agnostic) ──
function Ring({ size, sw, progress, mainColor, bgColor, expanded, macroColors, onToggle, remainingText, textColor, subColor, font }) {
  const [a, setA] = useState({ cal: 0, p: 0, c: 0, f: 0 });
  useEffect(() => { const t = setTimeout(() => setA(progress), 250); return () => clearTimeout(t); }, [progress]);
  const cx = size / 2, r = (size - sw) / 2 - 2, msw = Math.max(sw - 3, 4);
  const mr = [r - (sw + 4), r - (sw * 2 + 4), r - (sw * 3 + 4)];
  const arc = (rad, pct) => { const an = Math.min(pct, 0.999) * 360, rd = ((an - 90) * Math.PI) / 180; return `M ${cx} ${cx - rad} A ${rad} ${rad} 0 ${an > 180 ? 1 : 0} 1 ${cx + rad * Math.cos(rd)} ${cx + rad * Math.sin(rd)}`; };
  const rem = Math.max(0, 2100 - Math.round(2100 * a.cal));
  return (
    <div onClick={onToggle} style={{ cursor: "pointer", userSelect: "none" }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={bgColor} strokeWidth={sw} />
        <path d={arc(r, a.cal)} fill="none" stroke={mainColor} strokeWidth={sw} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1)" }} />
        {expanded && [[mr[0], a.p, macroColors[0]], [mr[1], a.c, macroColors[1]], [mr[2], a.f, macroColors[2]]].map(([rad, v, col], i) => (
          <g key={i}><circle cx={cx} cy={cx} r={rad} fill="none" stroke={bgColor} strokeWidth={msw} opacity={0.4} />
          <path d={arc(rad, v)} fill="none" stroke={col} strokeWidth={msw} strokeLinecap="round" style={{ transition: `all 1s cubic-bezier(0.22,1,0.36,1) ${0.08*(i+1)}s` }} /></g>
        ))}
        <text x={cx} y={cx - 2} textAnchor="middle" fill={textColor} fontSize={expanded ? size*0.14 : size*0.18} fontWeight="700" fontFamily={font} style={{ fontVariantNumeric: "tabular-nums" }}>{rem}</text>
        <text x={cx} y={cx + (expanded ? 12 : 15)} textAnchor="middle" fill={subColor} fontSize={size*0.055} fontWeight="500" fontFamily={font} letterSpacing="0.06em">{remainingText}</text>
      </svg>
    </div>
  );
}

// ── CONFIDENCE DOT ──
const Dot = ({ level, colors }) => {
  const c = colors || { high: "#3a9a5c", med: "#c8903a", low: "#c44a4a" };
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: c[level] || c.high, flexShrink: 0 }} />;
};


/* ╔═══════════════════════════════════════════════════════════╗
   ║  VARIATION A — MINIMAL & TYPOGRAPHIC                     ║
   ║  No emojis. Typography and spacing do all the work.       ║
   ║  Monospace numbers. Lots of whitespace. Linear/Stripe.    ║
   ╚═══════════════════════════════════════════════════════════╝ */
function VariationA({ isDark }) {
  const t = isDark ? {
    bg: "#0c0c0e", surface: "#141416", elevated: "#1c1c20", text: "#e8e8e8", sub: "#777", dim: "#444", border: "#222", accent: "#e8e8e8", accentSoft: "#e8e8e815", green: "#4ade80", greenSoft: "#4ade8015", amber: "#fbbf24", red: "#f87171", protein: "#60a5fa", carbs: "#fbbf24", fat: "#f472b6",
  } : {
    bg: "#fafafa", surface: "#ffffff", elevated: "#ffffff", text: "#0a0a0a", sub: "#666", dim: "#bbb", border: "#eee", accent: "#0a0a0a", accentSoft: "#0a0a0a08", green: "#16a34a", greenSoft: "#16a34a10", amber: "#d97706", red: "#dc2626", protein: "#2563eb", carbs: "#d97706", fat: "#db2777",
  };

  const [expanded, setExpanded] = useState(false);
  const [openMeal, setOpenMeal] = useState(0);
  const progress = { cal: 0.53, p: 0.30, c: 0.48, f: 0.46 };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header — pure type */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: t.dim, letterSpacing: "0.12em", textTransform: "uppercase" }}>Sunday, April 13</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-0.04em", marginTop: 2 }}>Good morning</div>
      </div>

      {/* Ring — minimal stroke */}
      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0 8px" }}>
        <Ring size={160} sw={6} progress={progress} mainColor={t.text} bgColor={isDark ? "#222" : "#eee"} expanded={expanded} macroColors={[t.protein, t.carbs, t.fat]} onToggle={() => setExpanded(!expanded)} remainingText="REMAINING" textColor={t.text} subColor={t.dim} font="'Inter', monospace" />
      </div>

      {/* Macro row — ultra-minimal */}
      <div style={{ display: "flex", gap: 1, margin: "0 20px 18px", background: t.border, borderRadius: 8, overflow: "hidden" }}>
        {[["P", 45, 150, t.protein], ["C", 120, 250, t.carbs], ["F", 30, 65, t.fat]].map(([label, cur, tgt, color], i) => (
          <div key={i} style={{ flex: 1, padding: "10px 12px", background: t.surface }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: "0.1em" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{cur}<span style={{ fontWeight: 400, color: t.dim }}>/{tgt}</span></span>
            </div>
            <div style={{ marginTop: 6, height: 2, borderRadius: 1, background: isDark ? "#222" : "#eee" }}>
              <div style={{ width: `${(cur/tgt)*100}%`, height: "100%", borderRadius: 1, background: color, transition: "width 0.8s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions — text-only pills */}
      <div style={{ display: "flex", gap: 6, padding: "0 20px", marginBottom: 20 }}>
        {[["Photo", I.camera], ["Voice", I.mic], ["Search", I.search], ["Scan", I.scan]].map(([label, icon], i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 4px", borderRadius: 6, border: `1px solid ${t.border}`, cursor: "pointer", background: "transparent" }}>
            {icon(t.sub, 13)}
            <span style={{ fontSize: 11, fontWeight: 500, color: t.sub }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Meals — clean list, no cards */}
      <div style={{ padding: "0 20px" }}>
        {MEALS_DATA.map((meal, mi) => (
          <div key={mi} style={{ borderTop: `1px solid ${t.border}` }}>
            <div onClick={() => setOpenMeal(openMeal === mi ? -1 : mi)} style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{meal.name}</span>
                <span style={{ fontSize: 12, color: t.dim, marginLeft: 8 }}>{meal.time}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{meal.cal}</span>
            </div>
            {openMeal === mi && meal.items.map((item, ii) => (
              <div key={ii} style={{ padding: "8px 0 8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${isDark ? "#1a1a1a" : "#f5f5f5"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Dot level={item.conf} colors={{ high: t.green, med: t.amber, low: t.red }} />
                  <span style={{ fontSize: 12, color: t.text }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: t.dim }}>{item.portion}</span>
                </div>
                <span style={{ fontSize: 12, color: t.sub, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>{item.cal}</span>
              </div>
            ))}
          </div>
        ))}
        {/* Ghost meals */}
        {["Dinner", "Snacks"].map((name) => (
          <div key={name} style={{ borderTop: `1px solid ${t.border}`, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: t.dim }}>{name}</span>
            {I.plus(t.dim, 14)}
          </div>
        ))}
      </div>

      {/* Feed preview — editorial typographic cards */}
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: t.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Discover</div>
        {FEED_DATA.slice(0, 3).map((r) => (
          <div key={r.id} style={{ padding: "14px 0", borderTop: `1px solid ${t.border}`, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: t.dim, marginTop: 3 }}>{r.creator} · {SRC_LABEL[r.source]} · {r.time}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  {[["P", r.p, t.protein], ["C", r.c, t.carbs], ["F", r.f, t.fat]].map(([l, v, c], i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, color: c, fontFamily: "monospace" }}>{l}{v}</span>
                  ))}
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{r.cal}kcal</span>
                </div>
              </div>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: `hsl(${r.hue}, 30%, ${isDark ? 20 : 85}%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {I.utensils(isDark ? `hsl(${r.hue}, 30%, 45%)` : `hsl(${r.hue}, 30%, 55%)`, 22)}
              </div>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: r.fit === "great" ? t.greenSoft : r.fit === "warn" ? t.amber + "15" : t.accentSoft, color: r.fit === "great" ? t.green : r.fit === "warn" ? t.amber : t.sub }}>{r.fitLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Insight — borderless, type-only */}
      <div style={{ padding: "20px 20px 24px" }}>
        <div style={{ padding: "16px", borderRadius: 8, background: t.greenSoft, borderLeft: `3px solid ${t.green}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.green, marginBottom: 2 }}>5-day protein streak</div>
          <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.4 }}>You've hit your target 5 days in a row. Keep it going.</div>
        </div>
      </div>
    </div>
  );
}


/* ╔═══════════════════════════════════════════════════════════╗
   ║  VARIATION B — PHOTO-FORWARD & EDITORIAL                 ║
   ║  Rich colour gradients as photo stand-ins. Warm tones.    ║
   ║  Magazine-like cards. Bon Appétit meets nutrition.        ║
   ╚═══════════════════════════════════════════════════════════╝ */
function VariationB({ isDark }) {
  const t = isDark ? {
    bg: "#0f0e0c", surface: "#1a1815", elevated: "#242118", text: "#f0ece6", sub: "#9a9186", dim: "#5c5650", border: "#2a2620", accent: "#d4a574", accentSoft: "#d4a57418", green: "#7ab87a", greenSoft: "#7ab87a18", amber: "#d4a574", red: "#c46a5a", protein: "#7aaccc", carbs: "#d4a574", fat: "#cc7a9a",
  } : {
    bg: "#f8f5f0", surface: "#ffffff", elevated: "#ffffff", text: "#1a1512", sub: "#7a7268", dim: "#c4bdb4", border: "#e8e2da", accent: "#8a6840", accentSoft: "#8a684012", green: "#4a8a4a", greenSoft: "#4a8a4a12", amber: "#a07030", red: "#a05040", protein: "#4a7aaa", carbs: "#a07030", fat: "#aa4a6a",
  };

  const [expanded, setExpanded] = useState(false);
  const progress = { cal: 0.53, p: 0.30, c: 0.48, f: 0.46 };
  const photos = [
    "linear-gradient(135deg, #e8d5c0 0%, #c4956a 40%, #8a6a45 100%)",
    "linear-gradient(135deg, #f0e6d0 0%, #d4ba8a 40%, #a08050 100%)",
    "linear-gradient(135deg, #e0c8a8 0%, #c09a6a 40%, #806040 100%)",
    "linear-gradient(135deg, #d8e8d0 0%, #8aaa7a 40%, #5a7a4a 100%)",
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      {/* Editorial header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 400, color: t.dim, fontStyle: "italic" }}>Sunday, April 13</div>
        <div style={{ fontSize: 28, fontWeight: 400, color: t.text, letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 2, fontStyle: "italic" }}>Good morning, Grace</div>
      </div>

      {/* Ring — warm tones */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 6px" }}>
        <Ring size={160} sw={8} progress={progress} mainColor={t.accent} bgColor={isDark ? "#2a2620" : "#e8e2da"} expanded={expanded} macroColors={[t.protein, t.carbs, t.fat]} onToggle={() => setExpanded(!expanded)} remainingText="KCAL REMAINING" textColor={t.text} subColor={t.dim} font="'Georgia', serif" />
      </div>

      {/* Macro row — warm rounded pills */}
      <div style={{ display: "flex", gap: 8, padding: "8px 20px 16px" }}>
        {[["Protein", 45, 150, t.protein], ["Carbs", 120, 250, t.carbs], ["Fat", 30, 65, t.fat]].map(([label, cur, tgt, color], i) => (
          <div key={i} style={{ flex: 1, padding: "10px", borderRadius: 14, background: color + "12", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: isDark ? "#222" : "#ddd", borderRadius: 2 }}>
              <div style={{ width: `${(cur/tgt)*100}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s" }} />
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>{cur}g <span style={{ fontSize: 11, fontWeight: 400, color: t.dim }}>/ {tgt}g</span></div>
          </div>
        ))}
      </div>

      {/* Quick actions — warm rounded */}
      <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 20 }}>
        {[["Photo", I.camera], ["Voice", I.mic], ["Search", I.search], ["Scan", I.scan]].map(([label, icon], i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", borderRadius: 14, background: t.accentSoft, cursor: "pointer" }}>
            {icon(t.accent, 18)}
            <span style={{ fontSize: 10, fontWeight: 500, color: t.sub, fontFamily: "'Inter', sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Meals — card-based with warm styling */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>Today's meals</div>
        {MEALS_DATA.map((meal, mi) => (
          <div key={mi} style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: "'Inter', sans-serif" }}>{meal.name}</div>
                <div style={{ fontSize: 11, color: t.dim, marginTop: 1, fontFamily: "'Inter', sans-serif" }}>{meal.time} · {meal.items.length} items</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.accent, fontFamily: "'Georgia', serif" }}>{meal.cal}</div>
            </div>
          </div>
        ))}
        {["Dinner", "Snacks"].map((name) => (
          <div key={name} style={{ borderRadius: 14, border: `1px dashed ${t.border}`, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: t.dim, fontFamily: "'Inter', sans-serif" }}>{name}</span>
            {I.plus(t.dim, 16)}
          </div>
        ))}
      </div>

      {/* Feed — large photo cards, editorial style */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>From the kitchen</div>
        {FEED_DATA.slice(0, 3).map((r, ri) => (
          <div key={r.id} style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, border: `1px solid ${t.border}`, cursor: "pointer" }}>
            <div style={{ height: 150, background: photos[ri % photos.length], position: "relative" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "28px 16px 14px" }}>
                <div style={{ fontSize: 17, fontWeight: 400, color: "#fff", fontStyle: "italic", lineHeight: 1.2 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{r.creator} · {SRC_LABEL[r.source]}</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", background: t.elevated, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, fontFamily: "'Inter', sans-serif" }}>
                {[["P", r.p, t.protein], ["C", r.c, t.carbs], ["F", r.f, t.fat]].map(([l, v, c], i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: c }}>{l} {v}g</span>
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: r.fit === "great" ? t.greenSoft : r.fit === "warn" ? t.amber + "15" : t.accentSoft, color: r.fit === "great" ? t.green : r.fit === "warn" ? t.amber : t.sub, fontFamily: "'Inter', sans-serif" }}>{r.fitLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Insight — warm editorial */}
      <div style={{ padding: "8px 20px 24px" }}>
        <div style={{ padding: "16px", borderRadius: 14, background: t.greenSoft, border: `1px solid ${t.green}22` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {I.flame(t.green, 16)}
            <span style={{ fontSize: 13, fontWeight: 600, color: t.green, fontFamily: "'Inter', sans-serif" }}>5-day protein streak</span>
          </div>
          <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.5, fontStyle: "italic" }}>Consistently hitting your protein target. Beautiful consistency.</div>
        </div>
      </div>
    </div>
  );
}


/* ╔═══════════════════════════════════════════════════════════╗
   ║  VARIATION C — ICON-DRIVEN & STRUCTURED                  ║
   ║  Consistent icon system. Grid-based. Precise. Refined.   ║
   ║  Think Figma/Notion — systematic, every pixel intentional ║
   ╚═══════════════════════════════════════════════════════════╝ */
function VariationC({ isDark }) {
  const t = isDark ? {
    bg: "#101014", surface: "#18181c", elevated: "#202028", text: "#e4e4e8", sub: "#8888", dim: "#4a4a55", border: "#282830", accent: "#6c8cff", accentSoft: "#6c8cff15", green: "#4cd080", greenSoft: "#4cd08015", amber: "#ffc04c", red: "#ff6b6b", protein: "#6c8cff", carbs: "#ffc04c", fat: "#ff7eb3",
  } : {
    bg: "#f4f5f7", surface: "#ffffff", elevated: "#ffffff", text: "#111118", sub: "#6b6b78", dim: "#c4c4cc", border: "#e4e4ec", accent: "#4c6ce0", accentSoft: "#4c6ce010", green: "#22a860", greenSoft: "#22a86010", amber: "#e8a020", red: "#e04848", protein: "#4c6ce0", carbs: "#e8a020", fat: "#e04888",
  };

  const [expanded, setExpanded] = useState(false);
  const [openMeal, setOpenMeal] = useState(0);
  const progress = { cal: 0.53, p: 0.30, c: 0.48, f: 0.46 };

  const MealIcon = ({ type, color }) => {
    const icons = { Breakfast: I.coffee, Lunch: I.sun, Dinner: I.plate, Snacks: I.star };
    const Ic = icons[type] || I.plate;
    return <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic(color, 16)}</div>;
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header — structured with icon */}
      <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Apr 13 · Sunday</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: "-0.02em", marginTop: 2 }}>Today</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>G</span>
        </div>
      </div>

      {/* Ring — accent-colored */}
      <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 4px" }}>
        <Ring size={160} sw={8} progress={progress} mainColor={t.green} bgColor={isDark ? "#28283040" : "#e4e4ec"} expanded={expanded} macroColors={[t.protein, t.carbs, t.fat]} onToggle={() => setExpanded(!expanded)} remainingText="KCAL LEFT" textColor={t.text} subColor={t.dim} font="'Inter', sans-serif" />
      </div>

      {/* Macros — structured grid cards */}
      <div style={{ display: "flex", gap: 8, padding: "10px 20px 16px" }}>
        {[["Protein", "P", 45, 150, t.protein], ["Carbs", "C", 120, 250, t.carbs], ["Fat", "F", 30, 65, t.fat]].map(([label, short, cur, tgt, color], i) => (
          <div key={i} style={{ flex: 1, padding: "10px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: t.sub, letterSpacing: "0.05em" }}>{label}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{cur}g</div>
            <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: isDark ? "#28283060" : "#e8e8f0" }}>
              <div style={{ width: `${(cur/tgt)*100}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.8s" }} />
            </div>
            <div style={{ fontSize: 10, color: t.dim, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>of {tgt}g</div>
          </div>
        ))}
      </div>

      {/* Quick actions — icon grid */}
      <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 20 }}>
        {[["Photo", I.camera, t.accent], ["Voice", I.mic, t.green], ["Search", I.search, t.amber], ["Scan", I.scan, t.fat]].map(([label, icon, color], i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px", borderRadius: 12, background: t.elevated, border: `1px solid ${t.border}`, cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {icon(color, 14)}
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, color: t.sub }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Meals — structured with icons */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Meals</div>
        <div style={{ background: t.elevated, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
          {MEALS_DATA.map((meal, mi) => {
            const mealColors = { Breakfast: t.amber, Lunch: t.green };
            const color = mealColors[meal.name] || t.accent;
            return (
              <div key={mi}>
                <div onClick={() => setOpenMeal(openMeal === mi ? -1 : mi)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
                  <MealIcon type={meal.name} color={color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{meal.name}</div>
                    <div style={{ fontSize: 11, color: t.dim }}>{meal.time} · {meal.items.length} items</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{meal.cal}</span>
                  <span style={{ fontSize: 10, color: t.dim }}>kcal</span>
                </div>
                {openMeal === mi && meal.items.map((item, ii) => (
                  <div key={ii} style={{ padding: "9px 14px 9px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${isDark ? "#1c1c22" : "#f4f4f8"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Dot level={item.conf} colors={{ high: t.green, med: t.amber, low: t.red }} />
                      <span style={{ fontSize: 12, color: t.text }}>{item.name}</span>
                      <span style={{ fontSize: 10, color: t.dim }}>{item.portion}</span>
                    </div>
                    <span style={{ fontSize: 12, color: t.sub, fontVariantNumeric: "tabular-nums" }}>{item.cal}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {/* Ghost meals inside same container */}
          {["Dinner", "Snacks"].map((name) => {
            const mealColors = { Dinner: t.accent, Snacks: t.fat };
            return (
              <div key={name} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${t.border}`, cursor: "pointer", opacity: 0.5 }}>
                <MealIcon type={name} color={mealColors[name]} />
                <span style={{ flex: 1, fontSize: 13, color: t.dim }}>{name}</span>
                {I.plus(t.dim, 14)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feed — grid cards with icon accent */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Discover</div>
          <span style={{ fontSize: 11, fontWeight: 500, color: t.accent, cursor: "pointer" }}>See all</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FEED_DATA.slice(0, 4).map((r) => {
            const fitColors = { great: t.green, good: t.accent, warn: t.amber };
            return (
              <div key={r.id} style={{ borderRadius: 14, background: t.elevated, border: `1px solid ${t.border}`, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ height: 80, background: `linear-gradient(135deg, ${fitColors[r.fit]}10, ${fitColors[r.fit]}25)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {I.utensils(fitColors[r.fit], 28)}
                </div>
                <div style={{ padding: "10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.3, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: t.dim, marginBottom: 6 }}>{r.creator}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{r.cal}<span style={{ fontSize: 9, fontWeight: 400, color: t.dim }}> kcal</span></span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: (fitColors[r.fit] || t.accent) + "18", color: fitColors[r.fit] || t.accent }}>{r.fit === "great" ? "Great fit" : r.fit === "warn" ? "High carb" : "Good fit"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight — structured card */}
      <div style={{ padding: "16px 20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderRadius: 14, background: t.greenSoft, border: `1px solid ${t.green}22` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.green + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {I.flame(t.green, 18)}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.green }}>5-day protein streak</div>
            <div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Consistently on target. Keep it going.</div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   MAIN — VARIATION SWITCHER
   ═══════════════════════════════════════════════════════════ */
export default function SupprVariations() {
  const [variation, setVariation] = useState("A");
  const [isDark, setIsDark] = useState(false);

  const variations = {
    A: { name: "Minimal & Typographic", desc: "No emojis. Type and space do the work. Linear/Stripe energy.", component: VariationA },
    B: { name: "Photo-forward & Editorial", desc: "Warm tones. Serif headlines. Bon Appétit meets tracking.", component: VariationB },
    C: { name: "Icon-driven & Structured", desc: "Systematic icons. Grid layouts. Figma/Notion precision.", component: VariationC },
  };

  const v = variations[variation];
  const Component = v.component;

  const bgOuter = isDark ? "#080808" : "#e4e0dc";
  const phoneBg = isDark
    ? (variation === "A" ? "#0c0c0e" : variation === "B" ? "#0f0e0c" : "#101014")
    : (variation === "A" ? "#fafafa" : variation === "B" ? "#f8f5f0" : "#f4f5f7");

  return (
    <div style={{ minHeight: "100vh", background: bgOuter, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: isDark ? "#555" : "#999" }}>Suppr · Design Exploration</div>
      </div>

      {/* Variation selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {Object.entries(variations).map(([key, val]) => (
          <button key={key} onClick={() => setVariation(key)} style={{
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${variation === key ? (isDark ? "#fff" : "#000") : isDark ? "#333" : "#ccc"}`,
            background: variation === key ? (isDark ? "#fff" : "#000") : "transparent",
            color: variation === key ? (isDark ? "#000" : "#fff") : (isDark ? "#aaa" : "#555"),
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}>
            {key}: {val.name}
          </button>
        ))}
      </div>

      {/* Dark mode toggle */}
      <button onClick={() => setIsDark(!isDark)} style={{
        padding: "6px 14px", borderRadius: 6, border: `1px solid ${isDark ? "#333" : "#ccc"}`,
        background: "transparent", color: isDark ? "#888" : "#666",
        fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {isDark ? I.moon(isDark ? "#888" : "#666", 13) : I.sun(isDark ? "#888" : "#666", 13)}
        {isDark ? "Dark" : "Light"}
      </button>

      {/* Description */}
      <div style={{ textAlign: "center", marginBottom: 14, maxWidth: 340 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#ddd" : "#222" }}>{v.name}</div>
        <div style={{ fontSize: 12, color: isDark ? "#666" : "#888", marginTop: 3 }}>{v.desc}</div>
      </div>

      {/* Phone frame */}
      <div style={{
        width: 375, height: 780, background: phoneBg, borderRadius: 40, overflow: "hidden",
        display: "flex", flexDirection: "column",
        border: `1px solid ${isDark ? "#222" : "#d0d0d0"}`,
        boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.1)",
      }}>
        {/* Status bar */}
        <div style={{ padding: "12px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#e8e8e8" : "#000" }}>9:41</span>
          <div style={{ display: "flex", gap: 4 }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill={isDark ? "#e8e8e8" : "#000"}><rect x="0" y="4" width="3" height="8" rx="0.5" opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" opacity="0.6"/><rect x="9" y="1" width="3" height="11" rx="0.5" opacity="0.8"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={isDark ? "#e8e8e8" : "#000"} strokeOpacity="0.35"/><rect x="2" y="2" width="14" height="8" rx="1" fill={variation === "A" ? (isDark ? "#e8e8e8" : "#000") : variation === "B" ? "#8a6840" : "#4cd080"}/></svg>
          </div>
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <Component isDark={isDark} />
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", borderTop: `1px solid ${isDark ? "#222" : "#e4e4e4"}`, background: isDark ? (variation === "A" ? "#0c0c0e" : variation === "B" ? "#1a1815" : "#18181c") : (variation === "A" ? "#fff" : variation === "B" ? "#fff" : "#fff"), padding: "6px 0 2px", flexShrink: 0 }}>
          {[["Today", I.plate], ["Discover", I.search], ["Plan", I.clock], ["Progress", I.flame], ["Profile", I.users]].map(([label, icon], i) => {
            const active = i === 0;
            const accentCol = variation === "A" ? (isDark ? "#e8e8e8" : "#000") : variation === "B" ? (isDark ? "#d4a574" : "#8a6840") : (isDark ? "#6c8cff" : "#4c6ce0");
            const dimCol = isDark ? "#444" : "#bbb";
            return (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "3px 0", cursor: "pointer" }}>
                {icon(active ? accentCol : dimCol, 19)}
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? accentCol : dimCol }}>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0", flexShrink: 0 }}>
          <div style={{ width: 134, height: 5, borderRadius: 3, background: isDark ? "#333" : "#ccc", opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}
