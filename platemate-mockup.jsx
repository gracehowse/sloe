import { useState, useEffect, useRef } from "react";

const LIGHT = {
  bg: "#faf9f7",
  surface: "#f5f3f0",
  surfaceElevated: "#ffffff",
  textPrimary: "#1a1714",
  textSecondary: "#6b6560",
  textTertiary: "#9a938c",
  border: "#e8e4df",
  shadow: "0 1px 3px rgba(26,23,20,0.06), 0 1px 2px rgba(26,23,20,0.04)",
  shadowLg: "0 8px 24px rgba(26,23,20,0.08)",
  ringBg: "#e8e4df",
  tabBg: "#eae6e1",
  chipBg: "#ffffff",
  chipBorder: "#e8e4df",
  mealGhost: "#f0ece8",
};

const DARK = {
  bg: "#111118",
  surface: "#1a1a22",
  surfaceElevated: "#23232e",
  textPrimary: "#ede9e3",
  textSecondary: "#8a847e",
  textTertiary: "#5c5751",
  border: "#2a2a35",
  shadow: "none",
  shadowLg: "none",
  ringBg: "#2a2a35",
  tabBg: "#1a1a22",
  chipBg: "#1a1a22",
  chipBorder: "#2a2a35",
  mealGhost: "#1a1a22",
};

const ACCENT = {
  green: "#3a9a5c",
  greenSoft: "#3a9a5c22",
  amber: "#c8903a",
  amberSoft: "#c8903a22",
  red: "#c44a4a",
  blue: "#4a7ec4",
  protein: "#5580cc",
  proteinSoft: "#5580cc20",
  carbs: "#cca040",
  carbsSoft: "#cca04020",
  fat: "#cc5588",
  fatSoft: "#cc558820",
};

// Animated ring component
function DailyRing({ theme, progress, expanded, onToggle }) {
  const [animProgress, setAnimProgress] = useState(0);
  const [proteinAnim, setProteinAnim] = useState(0);
  const [carbsAnim, setCarbsAnim] = useState(0);
  const [fatAnim, setFatAnim] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimProgress(progress.calories);
      setProteinAnim(progress.protein);
      setCarbsAnim(progress.carbs);
      setFatAnim(progress.fat);
    }, 300);
    return () => clearTimeout(timer);
  }, [progress]);

  const size = 200;
  const stroke = 10;
  const macroStroke = 7;
  const center = size / 2;
  const radius = (size - stroke) / 2 - 4;
  const macroR1 = radius - 16;
  const macroR2 = radius - 30;
  const macroR3 = radius - 44;

  const arc = (r, pct) => {
    const angle = Math.min(pct, 0.999) * 360;
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = center + r * Math.cos(rad);
    const y = center + r * Math.sin(rad);
    const large = angle > 180 ? 1 : 0;
    return `M ${center} ${center - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
  };

  const remaining = Math.max(0, 2100 - Math.round(2100 * animProgress));

  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Background ring */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={theme.ringBg} strokeWidth={stroke} />
        {/* Calorie progress */}
        <path
          d={arc(radius, animProgress)}
          fill="none"
          stroke={ACCENT.green}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "all 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
        {/* Macro rings (expanded) */}
        {expanded && (
          <>
            <circle cx={center} cy={center} r={macroR1} fill="none" stroke={theme.ringBg} strokeWidth={macroStroke} opacity={0.5} />
            <path d={arc(macroR1, proteinAnim)} fill="none" stroke={ACCENT.protein} strokeWidth={macroStroke} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1) 0.1s" }} />
            <circle cx={center} cy={center} r={macroR2} fill="none" stroke={theme.ringBg} strokeWidth={macroStroke} opacity={0.5} />
            <path d={arc(macroR2, carbsAnim)} fill="none" stroke={ACCENT.carbs} strokeWidth={macroStroke} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1) 0.2s" }} />
            <circle cx={center} cy={center} r={macroR3} fill="none" stroke={theme.ringBg} strokeWidth={macroStroke} opacity={0.5} />
            <path d={arc(macroR3, fatAnim)} fill="none" stroke={ACCENT.fat} strokeWidth={macroStroke} strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(0.22,1,0.36,1) 0.3s" }} />
          </>
        )}
        {/* Center text */}
        <text x={center} y={expanded ? center - 6 : center - 4} textAnchor="middle" fill={theme.textPrimary} fontSize={expanded ? "28" : "36"} fontWeight="700" fontFamily="Inter, system-ui, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
          {remaining}
        </text>
        <text x={center} y={expanded ? center + 14 : center + 18} textAnchor="middle" fill={theme.textTertiary} fontSize="11" fontWeight="500" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.06em">
          KCAL REMAINING
        </text>
      </svg>
    </div>
  );
}

function MacroPill({ label, current, target, color, softColor, theme }) {
  const pct = Math.min(current / target, 1);
  return (
    <div style={{
      flex: 1,
      position: "relative",
      overflow: "hidden",
      borderRadius: 10,
      padding: "10px 12px",
      background: theme.surface,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${pct * 100}%`,
        background: softColor,
        transition: "width 1s cubic-bezier(0.22,1,0.36,1)",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>
          {current}g <span style={{ color: theme.textTertiary, fontWeight: 400, fontSize: 12 }}>/ {target}g</span>
        </div>
      </div>
    </div>
  );
}

function ConfidenceDot({ level }) {
  const colors = { high: ACCENT.green, medium: ACCENT.amber, low: ACCENT.red };
  return (
    <span style={{
      display: "inline-block",
      width: 6, height: 6,
      borderRadius: "50%",
      background: colors[level] || colors.high,
      marginRight: 5,
      verticalAlign: "middle",
    }} />
  );
}

function MealCard({ meal, theme, defaultExpanded }) {
  const [open, setOpen] = useState(defaultExpanded || false);
  return (
    <div style={{
      background: theme.surfaceElevated,
      borderRadius: 12,
      border: `1px solid ${theme.border}`,
      boxShadow: theme.shadow,
      overflow: "hidden",
      transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{meal.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{meal.name}</div>
            <div style={{ fontSize: 12, color: theme.textTertiary }}>{meal.time} · {meal.items.length} items</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>{meal.calories}</span>
          <span style={{ fontSize: 11, color: theme.textTertiary }}>kcal</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
            <path d="M4 6l4 4 4-4" stroke={theme.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: "4px 0" }}>
          {meal.items.map((item, i) => (
            <div key={i} style={{
              padding: "10px 16px 10px 44px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <ConfidenceDot level={item.confidence} />
                <span style={{ fontSize: 13, color: theme.textPrimary }}>{item.name}</span>
                <span style={{ fontSize: 11, color: theme.textTertiary, marginLeft: 6 }}>{item.portion}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: theme.textSecondary, fontVariantNumeric: "tabular-nums" }}>{item.cal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GhostMealCard({ name, theme, suggestion }) {
  return (
    <div style={{
      background: theme.mealGhost,
      borderRadius: 12,
      border: `1px dashed ${theme.border}`,
      padding: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: theme.textTertiary }}>{name}</div>
        <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>{suggestion}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke={theme.textTertiary} strokeWidth="1.2" strokeDasharray="3 2" />
        <path d="M10 7v6M7 10h6" stroke={theme.textTertiary} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function QuickLogBar({ theme }) {
  const actions = [
    { icon: "📷", label: "Photo" },
    { icon: "🎤", label: "Voice" },
    { icon: "🔍", label: "Search" },
    { icon: "⬜", label: "Scan" },
    { icon: "⭐", label: "Favorites" },
  ];
  return (
    <div style={{
      display: "flex",
      gap: 8,
      padding: "12px 0",
    }}>
      {actions.map((a, i) => (
        <div key={i} style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "10px 4px",
          borderRadius: 12,
          background: theme.chipBg,
          border: `1px solid ${theme.chipBorder}`,
          cursor: "pointer",
          transition: "all 0.15s",
          boxShadow: theme.shadow,
        }}>
          <span style={{ fontSize: 18 }}>{a.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: theme.textSecondary, letterSpacing: "0.02em" }}>{a.label}</span>
        </div>
      ))}
    </div>
  );
}

function RecipeCard({ theme }) {
  return (
    <div style={{
      borderRadius: 12,
      overflow: "hidden",
      border: `1px solid ${theme.border}`,
      boxShadow: theme.shadow,
      cursor: "pointer",
      background: theme.surfaceElevated,
    }}>
      <div style={{
        height: 140,
        background: "linear-gradient(135deg, #e8d5b7 0%, #c9a87c 50%, #a67c52 100%)",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
      }}>
        {/* Simulated food image overlay */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 48, opacity: 0.6 }}>🥗</span>
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
          padding: "24px 14px 12px",
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Mediterranean Chicken Bowl</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>25 min · 4 servings</div>
        </div>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "P", val: "38g", color: ACCENT.protein },
            { label: "C", val: "45g", color: ACCENT.carbs },
            { label: "F", val: "18g", color: ACCENT.fat },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: m.color }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>{m.label} {m.val}</span>
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: ACCENT.green,
          background: ACCENT.greenSoft,
          padding: "3px 8px",
          borderRadius: 6,
        }}>
          485 kcal
        </div>
      </div>
    </div>
  );
}

function InsightCard({ theme }) {
  return (
    <div style={{
      background: ACCENT.greenSoft,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      border: `1px solid ${ACCENT.green}33`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: ACCENT.green,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>🔥</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>
          5-day protein streak!
        </div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
          You've hit your protein target 5 days running. Nice consistency.
        </div>
      </div>
    </div>
  );
}

function TabBar({ theme, active, setActive }) {
  const tabs = [
    { id: "today", label: "Today", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "recipes", label: "Recipes", icon: "M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" },
    { id: "plan", label: "Plan", icon: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" },
    { id: "progress", label: "Progress", icon: "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" },
    { id: "profile", label: "Profile", icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" },
  ];
  return (
    <div style={{
      display: "flex",
      borderTop: `1px solid ${theme.border}`,
      background: theme.surfaceElevated,
      padding: "6px 0 2px",
    }}>
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => setActive(t.id)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "4px 0",
            cursor: "pointer",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={active === t.id ? ACCENT.green : theme.textTertiary}>
            <path d={t.icon} />
          </svg>
          <span style={{
            fontSize: 10,
            fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? ACCENT.green : theme.textTertiary,
          }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklySparkline({ theme }) {
  const data = [1850, 2050, 1980, 2200, 1750, 2100, 1400];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const max = Math.max(...data);
  const target = 2100;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>This week</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%",
              height: `${(v / max) * 48}px`,
              borderRadius: 4,
              background: v <= target ? ACCENT.green : ACCENT.amber,
              opacity: i === 6 ? 0.4 : 0.8,
              transition: "height 0.6s cubic-bezier(0.22,1,0.36,1)",
            }} />
            <span style={{ fontSize: 9, color: theme.textTertiary, fontWeight: 500 }}>{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main app
export default function PlatemateRedesign() {
  const [isDark, setIsDark] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("today");
  const [view, setView] = useState("mobile");
  const theme = isDark ? DARK : LIGHT;

  const meals = [
    {
      name: "Breakfast",
      icon: "🌅",
      time: "8:15 AM",
      calories: 485,
      items: [
        { name: "Greek Yogurt", portion: "200g", cal: 130, confidence: "high" },
        { name: "Granola", portion: "45g", cal: 195, confidence: "high" },
        { name: "Blueberries", portion: "1 cup", cal: 85, confidence: "high" },
        { name: "Honey", portion: "1 tbsp", cal: 75, confidence: "medium" },
      ],
    },
    {
      name: "Lunch",
      icon: "☀️",
      time: "12:30 PM",
      calories: 620,
      items: [
        { name: "Chicken Breast", portion: "150g", cal: 248, confidence: "high" },
        { name: "Brown Rice", portion: "1 cup cooked", cal: 216, confidence: "high" },
        { name: "Mixed Greens", portion: "2 cups", cal: 18, confidence: "high" },
        { name: "Olive Oil Dressing", portion: "2 tbsp", cal: 138, confidence: "medium" },
      ],
    },
  ];

  const progress = { calories: 0.53, protein: 0.30, carbs: 0.48, fat: 0.46 };

  const mobileContent = (
    <div style={{
      width: 375,
      height: 812,
      background: theme.bg,
      borderRadius: 40,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
      border: `1px solid ${theme.border}`,
      boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)",
      position: "relative",
    }}>
      {/* Status bar */}
      <div style={{ padding: "14px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>9:41</span>
        <div style={{ display: "flex", gap: 5 }}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill={theme.textPrimary}><rect x="0" y="4" width="3" height="8" rx="0.5" opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" opacity="0.6"/><rect x="9" y="1" width="3" height="11" rx="0.5" opacity="0.8"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={theme.textPrimary} strokeOpacity="0.35"/><rect x="22.5" y="3.5" width="1.5" height="5" rx="0.5" fill={theme.textPrimary} fillOpacity="0.4"/><rect x="2" y="2" width="14" height="8" rx="1" fill={ACCENT.green}/></svg>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 20px" }}>
        {/* Greeting */}
        <div style={{ padding: "20px 0 4px" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Good morning, Grace</div>
          <div style={{ fontSize: 13, color: theme.textTertiary, marginTop: 2 }}>Sunday, April 13</div>
        </div>

        {/* Daily Ring */}
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px" }}>
          <DailyRing theme={theme} progress={progress} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: theme.textTertiary, marginBottom: 12 }}>
          {expanded ? "Tap ring to collapse" : "Tap ring for macro breakdown"}
        </div>

        {/* Macro Pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <MacroPill label="Protein" current={45} target={150} color={ACCENT.protein} softColor={ACCENT.proteinSoft} theme={theme} />
          <MacroPill label="Carbs" current={120} target={250} color={ACCENT.carbs} softColor={ACCENT.carbsSoft} theme={theme} />
          <MacroPill label="Fat" current={30} target={65} color={ACCENT.fat} softColor={ACCENT.fatSoft} theme={theme} />
        </div>

        {/* Quick Log Bar */}
        <QuickLogBar theme={theme} />

        {/* Meal Timeline */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Meals today</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <MealCard meal={meals[0]} theme={theme} defaultExpanded={true} />
            <MealCard meal={meals[1]} theme={theme} />
            <GhostMealCard name="Dinner" theme={theme} suggestion="Tap to log or browse recipes" />
            <GhostMealCard name="Snacks" theme={theme} suggestion="Add a snack" />
          </div>
        </div>

        {/* Today's Recipe */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Tonight's recipe</div>
          <RecipeCard theme={theme} />
        </div>

        {/* Insight */}
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <InsightCard theme={theme} />
        </div>
      </div>

      {/* Tab Bar */}
      <TabBar theme={theme} active={activeTab} setActive={setActiveTab} />
      {/* Home indicator */}
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
        <div style={{ width: 134, height: 5, borderRadius: 3, background: theme.textTertiary, opacity: 0.3 }} />
      </div>
    </div>
  );

  const desktopContent = (
    <div style={{
      width: 960,
      height: 640,
      background: theme.bg,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
      border: `1px solid ${theme.border}`,
      boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        background: theme.surface,
        borderRight: `1px solid ${theme.border}`,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT.green, padding: "0 8px 20px", letterSpacing: "-0.02em" }}>platemate</div>
        {[
          { label: "Today", id: "today", icon: "◉" },
          { label: "Recipes", id: "recipes", icon: "◈" },
          { label: "Meal Plan", id: "plan", icon: "▦" },
          { label: "Shopping List", id: "shop", icon: "☑" },
          { label: "Progress", id: "progress", icon: "◲" },
          { label: "Cook Mode", id: "cook", icon: "▶" },
        ].map((item) => (
          <div key={item.id} onClick={() => setActiveTab(item.id)} style={{
            padding: "9px 10px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            background: activeTab === item.id ? (isDark ? "rgba(58,154,92,0.12)" : "rgba(58,154,92,0.08)") : "transparent",
            color: activeTab === item.id ? ACCENT.green : theme.textSecondary,
            fontSize: 13,
            fontWeight: activeTab === item.id ? 600 : 400,
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 8 }}>
          <div style={{ padding: "8px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.textSecondary, cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: ACCENT.green }}>G</div>
            Grace Turner
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        <div style={{ maxWidth: 680 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Good morning, Grace</div>
              <div style={{ fontSize: 13, color: theme.textTertiary, marginTop: 2 }}>Sunday, April 13, 2026</div>
            </div>
            <QuickLogBar theme={theme} />
          </div>

          <div style={{ display: "flex", gap: 20 }}>
            {/* Left column */}
            <div style={{ flex: 1 }}>
              {/* Ring + macros */}
              <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, padding: 20, boxShadow: theme.shadow, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <DailyRing theme={theme} progress={progress} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <MacroPill label="Protein" current={45} target={150} color={ACCENT.protein} softColor={ACCENT.proteinSoft} theme={theme} />
                      <MacroPill label="Carbs" current={120} target={250} color={ACCENT.carbs} softColor={ACCENT.carbsSoft} theme={theme} />
                      <MacroPill label="Fat" current={30} target={65} color={ACCENT.fat} softColor={ACCENT.fatSoft} theme={theme} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Meals */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <MealCard meal={meals[0]} theme={theme} defaultExpanded={true} />
                <MealCard meal={meals[1]} theme={theme} />
                <GhostMealCard name="Dinner" theme={theme} suggestion="Tap to log or browse recipes" />
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ width: 220 }}>
              <div style={{ background: theme.surfaceElevated, borderRadius: 12, border: `1px solid ${theme.border}`, padding: 16, boxShadow: theme.shadow, marginBottom: 12 }}>
                <WeeklySparkline theme={theme} />
              </div>
              <RecipeCard theme={theme} />
              <div style={{ marginTop: 12 }}>
                <InsightCard theme={theme} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: isDark ? "#0a0a0f" : "#e8e4df",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
    }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => setIsDark(!isDark)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${isDark ? "#333" : "#ccc"}`,
            background: isDark ? "#1a1a22" : "#fff",
            color: isDark ? "#ede9e3" : "#1a1714",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {isDark ? "☾ Dark Mode" : "☀ Light Mode"}
        </button>
        <button
          onClick={() => setView(view === "mobile" ? "desktop" : "mobile")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${isDark ? "#333" : "#ccc"}`,
            background: isDark ? "#1a1a22" : "#fff",
            color: isDark ? "#ede9e3" : "#1a1714",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {view === "mobile" ? "📱 Mobile" : "🖥 Desktop"} — tap to switch
        </button>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT.green, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Platemate Redesign</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: isDark ? "#ede9e3" : "#1a1714", letterSpacing: "-0.02em" }}>
          {view === "mobile" ? "Today — Mobile" : "Today — Desktop"}
        </div>
      </div>

      {/* Device frame */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {view === "mobile" ? mobileContent : desktopContent}
      </div>
    </div>
  );
}
