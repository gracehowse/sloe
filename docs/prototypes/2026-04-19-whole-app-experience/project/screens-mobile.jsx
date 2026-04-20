/* Suppr — mobile screens: Today, Discover, Plan, Progress, More */

// ─── Household bar — per-member chips ────────────────────────
function HouseholdBar({ persona, active, onSelect }) {
  const [sel, setSel] = React.useState(active || "all");
  const pick = (id) => { setSel(id); onSelect && onSelect(id); };
  return (
    <div style={{ marginBottom: 14, padding: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="overline">Household</div>
        <button style={{ background: "transparent", border: 0, color: "var(--primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Manage</button>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, margin: "0 -4px" }}>
        <button onClick={() => pick("all")} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          background: sel === "all" ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "var(--muted)",
          color: sel === "all" ? "var(--primary)" : "var(--fg-secondary)",
          border: 0, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <Icon name="users" size={12} /> All {persona.members.length}
        </button>
        {persona.members.map(m => (
          <button key={m.id} onClick={() => pick(m.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px",
            background: sel === m.id ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "var(--muted)",
            color: sel === m.id ? "var(--primary)" : "var(--fg-secondary)",
            border: 0, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%", background: m.color, color: "#fff",
              display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700,
            }}>{m.initials}</span>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Status bar + home indicator ─────────────────────────────
function StatusBar() {
  return (
    <>
      <div className="island" />
      <div className="status-bar">
        <span>9:41</span>
        <div className="dots">
          <Icon name="signal" size={15} />
          <Icon name="wifi" size={15} />
          <Icon name="battery-full" size={22} />
        </div>
      </div>
    </>
  );
}

// ─── Today screen ────────────────────────────────────────────
function TodayScreen({ persona, onOpenMeal, onOpenLog, onOpenRecipe, heroVariant = "ring" }) {
  const pct = persona.loggedKcal / persona.targetKcal;
  const remaining = persona.targetKcal - persona.loggedKcal;
  const net = persona.loggedKcal - persona.burnedKcal;

  // User-level hero choice — overrides the Tweak default, persists locally
  const [userHero, setUserHero] = React.useState(() => {
    try { return localStorage.getItem("suppr.hero") || null; } catch { return null; }
  });
  const [pickOpen, setPickOpen] = React.useState(false);
  const activeHero = userHero || heroVariant;
  const setHero = (v) => { setUserHero(v); try { localStorage.setItem("suppr.hero", v); } catch {} setPickOpen(false); };

  const Hero = () => {
    if (activeHero === "bar") return <HeroBar persona={persona} pct={pct} remaining={remaining} net={net} />;
    if (activeHero === "number") return <HeroNumber persona={persona} pct={pct} remaining={remaining} net={net} />;
    return <HeroRing persona={persona} pct={pct} remaining={remaining} net={net} />;
  };

  return (
    <div className="screen-scroll" style={{ paddingBottom: 140 }}>
      <div className="phone-top">
        <div>
          <div className="date">Wed, 14 May</div>
          <div className="title">Today</div>
        </div>
        <button className="avatar">{persona.initials}</button>
      </div>
      <div style={{ padding: "0 20px" }}>
        {persona.isHousehold && <HouseholdBar persona={persona} />}
        <div style={{ position: "relative" }}>
          <Hero />
          <button onClick={() => setPickOpen(o => !o)} title="Change hero style" style={{
            position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 8,
            background: "color-mix(in oklab, var(--fg) 8%, transparent)", border: 0, color: "var(--fg-secondary)",
            cursor: "pointer", display: "grid", placeItems: "center",
          }}>
            <Icon name="layout-grid" size={13} />
          </button>
          {pickOpen && (
            <>
              <div onClick={() => setPickOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div style={{
                position: "absolute", top: 44, right: 10, zIndex: 11,
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
                padding: 4, boxShadow: "0 12px 32px rgba(0,0,0,0.25)", minWidth: 160,
              }}>
                {[
                  { id: "ring", label: "Ring", sub: "Macros on hold", icon: "circle-dashed" },
                  { id: "bar",  label: "Bar",  sub: "Linear progress", icon: "rectangle-horizontal" },
                  { id: "number", label: "Number", sub: "Big & plain", icon: "hash" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setHero(opt.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 10px",
                    background: activeHero === opt.id ? "color-mix(in oklab, var(--primary) 12%, transparent)" : "transparent",
                    color: activeHero === opt.id ? "var(--primary)" : "var(--fg)",
                    border: 0, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}>
                    <Icon name={opt.icon} size={14} />
                    <span style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 1 }}>{opt.sub}</div>
                    </span>
                    {activeHero === opt.id && <Icon name="check" size={12} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <MacroTile name="Protein" value={persona.loggedProtein} target={persona.targetProtein} unit="g" color="var(--macro-protein)" icon="beef" />
          <MacroTile name="Carbs"   value={persona.loggedCarbs}   target={persona.targetCarbs}   unit="g" color="var(--macro-carbs)"   icon="wheat" />
          <MacroTile name="Fat"     value={persona.loggedFat}     target={persona.targetFat}     unit="g" color="var(--macro-fat)"     icon="droplets" />
          <MacroTile name="Fiber"   value={persona.loggedFiber}   target={persona.targetFiber}   unit="g" color="var(--macro-fiber)"   icon="leaf" />
        </div>

        <div className="section-h"><h3>Today's meals</h3><button onClick={onOpenLog}>Log meal</button></div>
        <div className="card" style={{ padding: 0 }}>
          {persona.meals.map(m => (
            <button key={m.id} className="meal-row" onClick={() => onOpenMeal(m)}>
              <span className="icon-box" style={{ background: `color-mix(in oklab, ${m.color} 18%, transparent)`, color: m.color }}>
                <Icon name={m.icon} size={18} />
              </span>
              <span>
                <span className="t1" style={{ display: "block" }}>{m.title}</span>
                <span className="t2" style={{ display: "block" }}>{m.meta}</span>
              </span>
              <span className="trail">
                <span className="kc">{m.kcal}</span>
                {m.p} P · {m.c} C
              </span>
            </button>
          ))}
        </div>

        {/* Weekly insight */}
        <div className="section-h"><h3>Insight</h3></div>
        <div className="card">
          <div className="overline" style={{ color: "var(--primary-light)", marginBottom: 8 }}>Weekly insight</div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 6 }}>{persona.insight.title}</div>
          <p style={{ fontSize: 13, color: "var(--fg-secondary)", margin: "0 0 14px", lineHeight: 1.55 }}>{persona.insight.body}</p>
          <div className="spark">
            {[30, 42, 38, 55, 62, 72, 80].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-tertiary)", marginTop: 6 }}>
            <span>Apr 28</span><span>May 14</span>
          </div>
        </div>

        {/* Plan suggestion */}
        <div className="section-h"><h3>Dinner could hit your target</h3></div>
        <button
          className="card"
          onClick={() => onOpenRecipe(recipes[1])}
          style={{
            background: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 14%, var(--card)) 0%, color-mix(in oklab, var(--macro-fat) 10%, var(--card)) 100%)",
            border: "1px solid color-mix(in oklab, var(--primary) 25%, var(--border))",
            textAlign: "left", width: "100%", cursor: "pointer", color: "var(--fg)", fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 10 }}>With {remaining} kcal and {persona.targetProtein - persona.loggedProtein} g protein to go</div>
          <div className="photo-ph" style={{ aspectRatio: "16/9", marginBottom: 12 }}>salmon</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Salmon with lentils & greens</div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)" }}>From your library · <b style={{ color: "var(--fg)" }}>460 kcal</b> · <b style={{ color: "var(--fg)" }}>42 g P</b></div>
        </button>

        {/* Disclaimer */}
        <div style={{ fontSize: 11, color: "var(--fg-tertiary)", lineHeight: 1.5, marginTop: 20, padding: "0 4px" }}>
          Values are estimates. Actual values vary by preparation method, brand, and portion size. Suppr is a personal tracking tool, not a medical device.
        </div>
      </div>
    </div>
  );
}

function HeroRing({ persona, pct, remaining, net }) {
  // Gestures:
  //   hold (long-press) → toggle kcal view: remaining ↔ logged
  //   tap              → show macros (per-macro remaining/logged, follows kcal view)
  const [kcalMode, setKcalMode] = React.useState(() => {
    try { return localStorage.getItem("suppr.ring.kcal") || "remaining"; } catch { return "remaining"; }
  });
  const [showMacros, setShowMacros] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const holdTimer = React.useRef(null);
  const didLong = React.useRef(false);

  const setKcalModeP = (m) => { setKcalMode(m); try { localStorage.setItem("suppr.ring.kcal", m); } catch {} };
  const toggleKcal = () => setKcalModeP(kcalMode === "remaining" ? "logged" : "remaining");

  const start = () => {
    didLong.current = false; setPressed(true);
    holdTimer.current = setTimeout(() => { didLong.current = true; toggleKcal(); }, 420);
  };
  const end = () => {
    setPressed(false); clearTimeout(holdTimer.current);
    if (!didLong.current) setShowMacros(m => !m);
  };
  const cancel = () => { setPressed(false); clearTimeout(holdTimer.current); };

  const protPct = Math.min(1, persona.loggedProtein / persona.targetProtein);
  const carbPct = Math.min(1, persona.loggedCarbs / persona.targetCarbs);
  const fatPct  = Math.min(1, persona.loggedFat  / persona.targetFat);
  const kcalShown = kcalMode === "remaining" ? remaining : persona.loggedKcal;
  const kcalLabel = kcalMode === "remaining" ? "Remaining" : "Logged";

  // For macros, mirror the kcal view — show remaining OR logged per macro
  const macroRow = (label, logged, target, color) => {
    const val = kcalMode === "remaining" ? Math.max(0, target - logged) : logged;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, color: "var(--fg-secondary)" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{val}<span style={{ color: "var(--fg-tertiary)", fontWeight: 500, fontSize: 11 }}> g</span></span>
      </div>
    );
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div
        onMouseDown={start} onMouseUp={end} onMouseLeave={cancel}
        onTouchStart={start} onTouchEnd={end} onTouchCancel={cancel}
        role="button" aria-label="Tap for macros, hold to toggle remaining/logged"
        style={{ position: "relative", width: 180, height: 180, cursor: "pointer", transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 140ms var(--ease)", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
      >
        {showMacros ? (
          <>
            <DailyRing size={180} stroke={10} progress={pct}     color="var(--macro-calories)" trackColor="var(--ring-bg)" />
            <div style={{ position: "absolute", inset: 14 }}><DailyRing size={152} stroke={10} progress={protPct} color="var(--macro-protein)"  trackColor="var(--ring-bg)" /></div>
            <div style={{ position: "absolute", inset: 28 }}><DailyRing size={124} stroke={10} progress={carbPct} color="var(--macro-carbs)"    trackColor="var(--ring-bg)" /></div>
            <div style={{ position: "absolute", inset: 42 }}><DailyRing size={96}  stroke={10} progress={fatPct}  color="var(--macro-fat)"      trackColor="var(--ring-bg)" /></div>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <div className="overline">{kcalLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{kcalShown.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 3 }}>kcal</div>
            </div>
          </>
        ) : (
          <>
            <DailyRing size={180} stroke={14} progress={pct} color="var(--macro-calories)" trackColor="var(--ring-bg)" />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <div className="overline">{kcalLabel}</div>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {kcalShown.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 4 }}>of {persona.targetKcal.toLocaleString()} kcal</div>
            </div>
          </>
        )}
      </div>
      {showMacros && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: "6px 4px 0" }}>
          {macroRow("Protein", persona.loggedProtein, persona.targetProtein, "var(--macro-protein)")}
          {macroRow("Carbs",   persona.loggedCarbs,   persona.targetCarbs,   "var(--macro-carbs)")}
          {macroRow("Fat",     persona.loggedFat,     persona.targetFat,     "var(--macro-fat)")}
          {macroRow("Fiber",   persona.loggedFiber,   persona.targetFiber,   "var(--macro-fiber)")}
        </div>
      )}
      {!showMacros && (
        <div style={{ display: "flex", gap: 24, marginTop: 6 }}>
          <MiniStat v={persona.loggedKcal.toLocaleString()} l="logged" />
          <MiniStat v={persona.burnedKcal.toLocaleString()} l="burned" />
          <MiniStat v={(net > 0 ? "+" : "") + net.toLocaleString()} l="net" />
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 2, textAlign: "center" }}>
        Tap for macros · hold to switch {kcalMode === "remaining" ? "to logged" : "to remaining"}
      </div>
    </div>
  );
}

function HeroBar({ persona, pct, remaining, net }) {
  return (
    <div className="card">
      <div className="overline" style={{ marginBottom: 6 }}>Remaining</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "var(--macro-calories)" }}>{remaining}</div>
        <div style={{ fontSize: 14, color: "var(--fg-secondary)" }}>of {persona.targetKcal.toLocaleString()} kcal</div>
      </div>
      <div style={{ height: 10, background: "var(--muted)", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct * 100)}%`, background: "var(--macro-calories)", borderRadius: 999, transition: "width 700ms var(--ease)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-tertiary)", marginTop: 6 }}>
        <span>{persona.loggedKcal.toLocaleString()} logged</span>
        <span>{persona.targetKcal.toLocaleString()} target</span>
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 16, justifyContent: "center" }}>
        <MiniStat v={persona.burnedKcal.toLocaleString()} l="burned" />
        <MiniStat v={(net > 0 ? "+" : "") + net.toLocaleString()} l="net" />
        <MiniStat v={persona.meals.length} l="meals" />
      </div>
    </div>
  );
}

function HeroNumber({ persona, pct, remaining, net }) {
  return (
    <div className="card" style={{ padding: "28px 20px" }}>
      <div className="overline">Remaining today</div>
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9, fontVariantNumeric: "tabular-nums", marginTop: 8, color: "var(--fg)" }}>
        {remaining}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginTop: 6 }}>of {persona.targetKcal.toLocaleString()} kcal · {Math.round(pct * 100)}% eaten</div>
      <div style={{ display: "flex", gap: 20, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <MiniStat v={persona.loggedKcal.toLocaleString()} l="logged" />
        <MiniStat v={persona.burnedKcal.toLocaleString()} l="burned" />
        <MiniStat v={(net > 0 ? "+" : "") + net.toLocaleString()} l="net" />
      </div>
    </div>
  );
}

function MiniStat({ v, l }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div className="overline" style={{ marginTop: 2 }}>{l}</div>
    </div>
  );
}

// ─── Discover screen ─────────────────────────────────────────
function DiscoverScreen({ onOpenRecipe }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "high-protein", "quick", "vegetarian", "one-pan"];
  const filtered = filter === "all" ? recipes : recipes.filter(r => (r.tags || []).includes(filter));
  return (
    <div className="screen-scroll" style={{ paddingBottom: 140 }}>
      <div className="phone-top">
        <div>
          <div className="date">Browse</div>
          <div className="title">Discover</div>
        </div>
        <button className="avatar" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }}>
          <Icon name="search" size={16} />
        </button>
      </div>
      <div style={{ padding: "0 20px" }}>
        {/* Search */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--fg-tertiary)", fontSize: 14 }}>
          <Icon name="search" size={16} />
          Search 48,000+ recipes & foods
        </div>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 14px", borderRadius: 999, border: "1px solid var(--border)",
                background: filter === f ? "var(--primary)" : "transparent",
                color: filter === f ? "var(--primary-foreground)" : "var(--fg-secondary)",
                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", textTransform: "capitalize"
              }}
            >{f === "all" ? "All" : f}</button>
          ))}
        </div>

        {/* Hero card */}
        <div className="section-h"><h3>Matches your day</h3></div>
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.slice(0, 2).map(r => (
            <button key={r.id} onClick={() => onOpenRecipe(r)} className="card" style={{ padding: 0, overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)", width: "100%" }}>
              <div className="photo-ph" style={{ aspectRatio: "16/10", borderRadius: 0, border: 0 }}>{r.title.toLowerCase()}</div>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.title}</div>
                  <Badge variant="primary">{r.confidence}%</Badge>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4 }}>{r.source}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--fg-secondary)" }}>
                  <span><Icon name="flame" size={11} color="var(--macro-calories)" /> {r.kcal} kcal</span>
                  <span><Icon name="beef" size={11} color="var(--macro-protein)" /> {r.p} g</span>
                  <span><Icon name="clock" size={11} /> {r.time} min</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="section-h"><h3>More ideas</h3></div>
        <div className="card" style={{ padding: 0 }}>
          {filtered.slice(2).map(r => (
            <button key={r.id} className="meal-row" onClick={() => onOpenRecipe(r)}>
              <span className="icon-box" style={{ width: 40, height: 40, background: "var(--muted)", color: "var(--fg-secondary)" }}>
                <Icon name="chef-hat" size={18} />
              </span>
              <span>
                <span className="t1" style={{ display: "block" }}>{r.title}</span>
                <span className="t2" style={{ display: "block" }}>{r.source} · {r.time} min</span>
              </span>
              <span className="trail">
                <span className="kc">{r.kcal}</span>{r.p} P · {r.c} C
              </span>
            </button>
          ))}
        </div>

        {/* Import CTA */}
        <div className="section-h"><h3>From your sources</h3></div>
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="icon-box" style={{ width: 44, height: 44, background: "color-mix(in oklab, var(--primary) 18%, transparent)", color: "var(--primary)" }}>
            <Icon name="link" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Paste a recipe link</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Instagram, TikTok, blogs — we'll parse ingredients and macros.</div>
          </div>
          <Icon name="chevron-right" size={18} color="var(--fg-tertiary)" />
        </div>
      </div>
    </div>
  );
}

// ─── Plan screen ─────────────────────────────────────────────
function PlanScreen({ onOpenRecipe, persona }) {
  const getR = id => recipes.find(x => x.id === id);
  const [swapFor, setSwapFor] = React.useState(null); // { dayIdx, slot }
  const [overrides, setOverrides] = React.useState({}); // { "dayIdx:slot": recipeId }
  const keyFor = (dayIdx, slot) => `${dayIdx}:${slot}`;
  const pickSwap = (rid) => {
    if (!swapFor) return;
    setOverrides(o => ({ ...o, [keyFor(swapFor.dayIdx, swapFor.slot)]: rid }));
    setSwapFor(null);
  };
  return (
    <div className="screen-scroll" style={{ paddingBottom: 140 }}>
      <div className="phone-top">
        <div>
          <div className="date">Week of May 12</div>
          <div className="title">Meal plan</div>
        </div>
        <button className="avatar" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }}>
          <Icon name="sliders-horizontal" size={16} />
        </button>
      </div>
      <div style={{ padding: "0 20px" }}>
        {persona?.isHousehold && <HouseholdBar persona={persona} />}
        <div className="card" style={{
          background: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 12%, var(--card)) 0%, color-mix(in oklab, var(--macro-fat) 8%, var(--card)) 100%)",
          border: "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
        }}>
          <div className="overline" style={{ color: "var(--primary-light)", marginBottom: 6 }}>This week</div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>Hits your targets 6 of 7 days</div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14, lineHeight: 1.55 }}>Saturday is ~180 kcal short. Add a snack or swap the dinner.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: "9px 14px" }}>
              <Icon name="shopping-cart" size={14} /> Shopping list
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: "9px 14px" }}>Regenerate</button>
          </div>
        </div>

        {weekPlan.map((day, dayIdx) => (
          <div key={day.day}>
            <div className="section-h">
              <h3>{day.day} {day.today && <span style={{ fontSize: 10, color: "var(--primary)", marginLeft: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>today</span>}</h3>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {["breakfast", "lunch", "dinner"].map((slot) => {
                const rid = overrides[keyFor(dayIdx, slot)] || day[slot];
                const r = getR(rid);
                return (
                  <div key={slot} className="meal-row" style={{ cursor: "default" }}>
                    <span className="icon-box" style={{ background: "var(--muted)", color: "var(--fg-secondary)" }}>
                      <Icon name={slot === "breakfast" ? "sun" : slot === "lunch" ? "utensils" : "moon"} size={16} />
                    </span>
                    <button onClick={() => onOpenRecipe(r)} style={{ background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
                      <span className="t2" style={{ textTransform: "capitalize", display: "block" }}>{slot}</span>
                      <span className="t1" style={{ display: "block" }}>{r.title}</span>
                    </button>
                    <button onClick={() => setSwapFor({ dayIdx, slot })} title="Swap" style={{
                      marginLeft: "auto", background: "var(--muted)", border: 0, color: "var(--fg-secondary)",
                      width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center",
                    }}>
                      <Icon name="refresh-cw" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {swapFor && (
        <>
          <div className="sheet-backdrop" onClick={() => setSwapFor(null)} />
          <div className="sheet" style={{ height: "72vh" }}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h2>Swap {swapFor.slot}</h2>
              <button className="sheet-close" onClick={() => setSwapFor(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="sheet-body">
              <div className="overline" style={{ marginBottom: 8 }}>Suggestions that match your targets</div>
              <div className="card" style={{ padding: 0 }}>
                {recipes.map(r => (
                  <button key={r.id} className="meal-row" onClick={() => pickSwap(r.id)}>
                    <span className="icon-box" style={{ background: "var(--muted)", color: "var(--fg-secondary)" }}>
                      <Icon name="utensils" size={16} />
                    </span>
                    <span>
                      <span className="t1" style={{ display: "block" }}>{r.title}</span>
                      <span className="t2" style={{ display: "block" }}>{r.time} min · {r.servings} servings</span>
                    </span>
                    <span className="trail">
                      <span className="kc">{r.kcal}</span>{r.p} P · {r.c} C
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 14, lineHeight: 1.5 }}>
                Swaps update your shopping list automatically.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Progress screen ─────────────────────────────────────────
function ProgressScreen({ persona }) {
  const [range, setRange] = React.useState("7d");
  const [calOpen, setCalOpen] = React.useState(false);
  const { weight: weight7, kcal: kcal7, protein: protein7 } = progressSeries;
  // derive datasets for other ranges
  const rand = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  const makeSeries = (n, base, spread, seedBase) => Array.from({ length: n }, (_, i) => base + (rand(seedBase + i) - 0.5) * spread);
  const datasets = {
    "7d": { weight: weight7, kcal: kcal7, protein: protein7, days: ["Thu","Fri","Sat","Sun","Mon","Tue","Wed"], label: "Last 7 days" },
    "30d": { weight: makeSeries(30, persona.weight + 0.6, 0.8, 7), kcal: makeSeries(30, persona.targetKcal - 80, 600, 17).map(v => Math.round(v)), protein: makeSeries(30, persona.targetProtein - 8, 50, 27).map(v => Math.round(v)), days: Array.from({length:30},(_,i)=>i%5===0?`${i+1}`:""), label: "Last 30 days" },
    "90d": { weight: makeSeries(12, persona.weight + 1.4, 1.2, 37), kcal: makeSeries(12, persona.targetKcal - 50, 400, 47).map(v => Math.round(v)), protein: makeSeries(12, persona.targetProtein - 6, 30, 57).map(v => Math.round(v)), days: ["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"], label: "Last 90 days" },
    "all": { weight: makeSeries(12, persona.weight + 2.2, 2.0, 67), kcal: makeSeries(12, persona.targetKcal, 300, 77).map(v => Math.round(v)), protein: makeSeries(12, persona.targetProtein - 2, 25, 87).map(v => Math.round(v)), days: ["Jan","","Mar","","May","","Jul","","Sep","","Nov",""], label: "All time" },
  };
  const ds = datasets[range];
  const weight = ds.weight, kcal = ds.kcal, protein = ds.protein, days = ds.days;
  const maxW = Math.max(...weight) + 0.2;
  const minW = Math.min(...weight) - 0.2;
  const wRange = maxW - minW;

  return (
    <div className="screen-scroll" style={{ paddingBottom: 140 }}>
      <div className="phone-top">
        <div>
          <div className="date">{ds.label}</div>
          <div className="title">Progress</div>
        </div>
        <button className="avatar" onClick={() => setCalOpen(true)} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }}>
          <Icon name="calendar-days" size={16} />
        </button>
      </div>
      <div style={{ padding: "0 20px" }}>
        {persona.isHousehold && <HouseholdBar persona={persona} />}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "var(--muted)", borderRadius: 10, padding: 4 }}>
          {[["7d","7d"],["30d","30d"],["90d","90d"],["all","All"]].map(([id, label]) => (
            <button key={id} onClick={() => setRange(id)} style={{
              flex: 1, padding: "8px 4px", border: 0,
              background: range === id ? "var(--card)" : "transparent",
              color: range === id ? "var(--fg)" : "var(--fg-secondary)",
              borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              boxShadow: range === id ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}>{label}</button>
          ))}
        </div>
        {/* Weight card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div className="overline">Weight</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{persona.weight}</div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>kg</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 2 }}>
                <Icon name="trending-down" size={12} /> −0.8 kg this week
              </div>
            </div>
            <Badge variant="success">On track</Badge>
          </div>
          {/* Weight chart */}
          <svg viewBox="0 0 280 90" style={{ width: "100%", height: 90 }}>
            <defs>
              <linearGradient id="wGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const pts = weight.map((w, i) => {
                const x = (i / (weight.length - 1)) * 260 + 10;
                const y = 80 - ((w - minW) / wRange) * 70;
                return [x, y];
              });
              const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
              const area = path + ` L${pts[pts.length - 1][0]},85 L${pts[0][0]},85 Z`;
              return (
                <>
                  <path d={area} fill="url(#wGrad)" />
                  <path d={path} stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill="var(--primary)" stroke="var(--bg)" strokeWidth={i === pts.length - 1 ? 2 : 0} />)}
                </>
              );
            })()}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-tertiary)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {days.map(d => <span key={d}>{d}</span>)}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 10, lineHeight: 1.5 }}>
            You could reach {persona.goalWeight} kg by approximately 14 July at this rate. Projections use a 14-day moving average.
          </div>
        </div>

        {/* Calories card */}
        <div className="section-h"><h3>Calories</h3></div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>1,747 <span style={{ fontSize: 13, color: "var(--fg-secondary)", fontWeight: 500 }}>avg/day</span></div>
              <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Target {persona.targetKcal.toLocaleString()} · {Math.round((1747/persona.targetKcal)*100)}% avg</div>
            </div>
            <Badge variant="primary">−294 vs target</Badge>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80, marginTop: 18 }}>
            {kcal.map((k, i) => {
              const h = (k / 2200) * 100;
              const over = k > persona.targetKcal;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: "100%", height: `${h}%`,
                    background: over ? "var(--warning)" : "var(--macro-calories)",
                    borderRadius: "4px 4px 0 0", opacity: i === kcal.length - 1 ? 1 : 0.7
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--fg-tertiary)", marginTop: 6 }}>
            {days.map(d => <span key={d} style={{ flex: 1, textAlign: "center" }}>{d}</span>)}
          </div>
        </div>

        {/* Protein card */}
        <div className="section-h"><h3>Protein</h3></div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>120 <span style={{ fontSize: 13, color: "var(--fg-secondary)", fontWeight: 500 }}>g avg/day</span></div>
              <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Target {persona.targetProtein} g · hit on 4 of 7 days</div>
            </div>
            <Badge variant="warn">20 g short</Badge>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70, marginTop: 18 }}>
            {protein.map((p, i) => {
              const h = (p / persona.targetProtein) * 100;
              return <div key={i} style={{ flex: 1, height: `${Math.min(100, h)}%`, background: "var(--macro-protein)", borderRadius: "4px 4px 0 0", opacity: i === protein.length - 1 ? 1 : 0.7 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--fg-tertiary)", marginTop: 6 }}>
            {days.map(d => <span key={d} style={{ flex: 1, textAlign: "center" }}>{d}</span>)}
          </div>
        </div>

        {/* Apple Health sync */}
        <div className="section-h"><h3>Apple Health</h3></div>
        <div className="card">
          {[
            { icon: "footprints", color: "var(--fg-secondary)", label: "Steps", v: persona.steps.toLocaleString() },
            { icon: "flame", color: "var(--warning)", label: "Active energy", v: `${persona.activeBurn} kcal` },
            { icon: "heart-pulse", color: "var(--macro-fat)", label: "Resting burn", v: `${persona.restingBurn.toLocaleString()} kcal` },
            { icon: "scale", color: "var(--macro-protein)", label: "Weight", v: `${persona.weight} kg` },
          ].map((r, i) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--fg-secondary)", fontSize: 13 }}>
                <Icon name={r.icon} size={16} color={r.color} />
                {r.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.v}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 10, lineHeight: 1.5 }}>
            Based on your resting rate so far today. Activity bonus may be added if your total burn exceeds the TDEE estimate.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── More screen ─────────────────────────────────────────────
function MoreScreen({ persona, onNavigate }) {
  const items = [
    { icon: "book-open", label: "Library", badge: "128", dest: "library" },
    { icon: "link", label: "Import recipe", dest: "import" },
    { icon: "shopping-cart", label: "Shopping list", dest: "shopping" },
    ...(persona.isHousehold ? [{ icon: "users", label: "Household", sub: `${persona.members.length} people · ${persona.sharing?.preset || "custom"} sharing`, dest: "household" }] : []),
    { icon: "target", label: "Targets", sub: "1,800 kcal · 140 P · 180 C · 60 F", dest: "targets" },
    { icon: "heart-pulse", label: "Apple Health", sub: "Connected · syncing", dest: "health" },
    { icon: "sparkles", label: "Upgrade to Base", sub: "Meal plans, shopping list, cook mode", dest: "paywall", hl: true },
    { icon: "settings", label: "Settings", dest: "settings" },
  ];
  return (
    <div className="screen-scroll" style={{ paddingBottom: 140 }}>
      <div className="phone-top">
        <div>
          <div className="date">Account</div>
          <div className="title">More</div>
        </div>
        <button className="avatar">{persona.initials}</button>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: "linear-gradient(135deg,#4c6ce0,#e04888)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>{persona.initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Grace Howse</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Free tier · goal: {persona.name.toLowerCase()}</div>
          </div>
          <Badge variant="neutral">Free</Badge>
        </div>

        <div className="section-h"><h3>Everything else</h3></div>
        <div className="card" style={{ padding: 0 }}>
          {items.map((it, i) => (
            <button key={it.label} className="meal-row" onClick={() => onNavigate(it.dest)} style={{ gridTemplateColumns: "36px 1fr auto" }}>
              <span className="icon-box" style={{ background: it.hl ? "linear-gradient(135deg, rgba(76,108,224,0.18), rgba(224,72,136,0.18))" : "var(--muted)", color: it.hl ? "var(--primary)" : "var(--fg-secondary)" }}>
                <Icon name={it.icon} size={18} />
              </span>
              <span>
                <span className="t1" style={{ display: "block" }}>{it.label}</span>
                {it.sub && <span className="t2" style={{ display: "block" }}>{it.sub}</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {it.badge && <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{it.badge}</span>}
                <Icon name="chevron-right" size={16} color="var(--fg-tertiary)" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StatusBar, TodayScreen, DiscoverScreen, PlanScreen, ProgressScreen, MoreScreen });
