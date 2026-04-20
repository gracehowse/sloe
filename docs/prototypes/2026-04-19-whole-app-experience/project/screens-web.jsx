/* Suppr — web companion layout (sidebar + screens) */

function WebApp({ persona, route, setRoute, onOpenRecipe, onOpenPaywall, heroVariant, modal, setModal, closeModal, onLogMeal }) {
  const navItems = [
    { section: "Track", items: [
      { id: "today", icon: "home", label: "Today" },
      { id: "plan", icon: "calendar-days", label: "Meal plan" },
      { id: "progress", icon: "trending-up", label: "Progress" },
    ]},
    { section: "Recipes", items: [
      { id: "library", icon: "book-open", label: "Library", count: "128" },
      { id: "discover", icon: "compass", label: "Discover" },
      { id: "import", icon: "link", label: "Import" },
      { id: "shopping", icon: "shopping-cart", label: "Shopping list" },
    ]},
    { section: "Account", items: [
      { id: "targets", icon: "target", label: "Targets" },
      { id: "health", icon: "heart-pulse", label: "Apple Health" },
      { id: "settings", icon: "settings", label: "Settings" },
    ]},
  ];

  return (
    <div className="web-layout">
      <aside className="web-sidebar">
        <div className="brand-row"><div className="mk">S</div><div className="name">Suppr</div></div>
        {navItems.map(sec => (
          <Fragment key={sec.section}>
            <div className="nav-label">{sec.section}</div>
            <nav>
              {sec.items.map(it => (
                <button key={it.id} className={route === it.id ? "active" : ""} onClick={() => setRoute(it.id)}>
                  <Icon name={it.icon} size={18} />
                  {it.label}
                  {it.count && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-tertiary)" }}>{it.count}</span>}
                </button>
              ))}
            </nav>
          </Fragment>
        ))}
        <div style={{
          marginTop: "auto", padding: 16, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(108,140,255,0.18), rgba(224,72,136,0.18))",
          border: "1px solid rgba(108,140,255,0.30)"
        }}>
          <div className="overline" style={{ color: "var(--primary-light)", marginBottom: 6 }}>Free tier</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Plan the week, not the meal</div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.5, marginBottom: 10 }}>Meal plans, shopping lists, cook mode.</div>
          <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 12, width: "100%" }} onClick={onOpenPaywall}>Upgrade · $5/mo</button>
        </div>
      </aside>
      <main>
        <div className="web-topbar">
          <div className="crumb">{navItems.find(s => s.items.find(i => i.id === route))?.section} &middot; <b>{navItems.flatMap(s => s.items).find(i => i.id === route)?.label}</b> &middot; <span className="tabular">Wed, 14 May</span></div>
          <div className="actions">
            <div className="search"><Icon name="search" size={14} /> Search recipes &amp; foods</div>
            <div className="icon-btn"><Icon name="bell" size={16} /></div>
            <button className="icon-btn" onClick={() => setModal && setModal({type:"log"})} style={{ cursor: "pointer" }}><Icon name="plus" size={16} /></button>
            <button className="avatar-btn">{persona.initials}</button>
          </div>
        </div>
        <div className="web-page">
          {route === "today" && <WebToday persona={persona} onOpenRecipe={onOpenRecipe} heroVariant={heroVariant} onLog={() => setModal && setModal({type:"log"})} />}
          {route === "plan" && <WebPlan onOpenRecipe={onOpenRecipe} />}
          {route === "progress" && <WebProgress persona={persona} />}
          {route === "library" && <WebLibrary onOpenRecipe={onOpenRecipe} />}
          {route === "discover" && <WebLibrary onOpenRecipe={onOpenRecipe} title="Discover" />}
          {route === "import" && <WebImport />}
          {route === "shopping" && <WebShopping />}
          {route === "targets" && <WebTargets persona={persona} />}
          {route === "health" && <WebHealth persona={persona} />}
          {route === "settings" && <WebSettings />}
        </div>
        {/* Modals rendered above web page */}
        {modal?.type === "log" && <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={closeModal}>
          <div onClick={e=>e.stopPropagation()} style={{ width: 440, maxWidth: "100%", maxHeight: "86vh", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
            <LogMealSheet onClose={closeModal} onPick={(f, s) => { onLogMeal && onLogMeal(f, s); closeModal(); }} onPickMany={(m) => { onLogMeal && onLogMeal(m, 1); closeModal(); }} />
          </div>
        </div>}
        {modal?.type === "recipe" && <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={closeModal}>
          <div onClick={e=>e.stopPropagation()} style={{ width: 520, maxWidth: "100%", height: "90vh", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <RecipeDetail recipe={modal.data} onClose={closeModal} onCook={()=>setModal({type:"cook",data:modal.data})} onLog={() => { onLogMeal && onLogMeal({ title: modal.data.title, kcal: modal.data.kcal, p: modal.data.p, c: modal.data.c, f: modal.data.f }); closeModal(); }} />
          </div>
        </div>}
        {modal?.type === "cook" && <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={closeModal}>
          <div onClick={e=>e.stopPropagation()} style={{ width: 520, maxWidth: "100%", height: "90vh", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <CookMode recipe={modal.data} onClose={() => { onLogMeal && onLogMeal({ title: modal.data.title, kcal: modal.data.kcal, p: modal.data.p, c: modal.data.c, f: modal.data.f }); closeModal(); }} />
          </div>
        </div>}
        {modal?.type === "paywall" && <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={closeModal}>
          <div onClick={e=>e.stopPropagation()} style={{ width: 480, maxWidth: "100%", height: "86vh", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <Paywall onClose={closeModal} />
          </div>
        </div>}
      </main>
    </div>
  );
}

function WebToday({ persona, onOpenRecipe, heroVariant, onLog }) {
  const pct = persona.loggedKcal / persona.targetKcal;
  const remaining = persona.targetKcal - persona.loggedKcal;
  const net = persona.loggedKcal - persona.burnedKcal;

  // Ring interactivity: tap to cycle · hold for macros
  const modes = ["remaining", "logged", "macros"];
  const [ringMode, setRingMode] = React.useState(() => { try { return localStorage.getItem("suppr.ring.mode") || "remaining"; } catch { return "remaining"; } });
  const setRingModeP = (m) => { setRingMode(m); try { localStorage.setItem("suppr.ring.mode", m); } catch {} };
  const [pressed, setPressed] = React.useState(false);
  const holdRef = React.useRef(null), didLong = React.useRef(false);
  const cycle = () => setRingModeP(modes[(modes.indexOf(ringMode) + 1) % modes.length]);
  const start = () => { didLong.current = false; setPressed(true); holdRef.current = setTimeout(() => { didLong.current = true; setRingModeP("macros"); }, 450); };
  const end = () => { setPressed(false); clearTimeout(holdRef.current); if (!didLong.current) cycle(); };
  const cancel = () => { setPressed(false); clearTimeout(holdRef.current); };
  const protPct = Math.min(1, persona.loggedProtein / persona.targetProtein);
  const carbPct = Math.min(1, persona.loggedCarbs / persona.targetCarbs);
  const fatPct  = Math.min(1, persona.loggedFat  / persona.targetFat);

  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Today</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Estimated TDEE {persona.targetKcal.toLocaleString()} kcal based on Mifflin-St Jeor · moderate activity</div>
      {persona.isHousehold && <WebHouseholdBar persona={persona} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        <div>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 28, alignItems: "center" }}>
              <div
                onMouseDown={start} onMouseUp={end} onMouseLeave={cancel}
                onTouchStart={start} onTouchEnd={end} onTouchCancel={cancel}
                role="button" aria-label="Tap to cycle, hold for macros"
                style={{ position: "relative", width: 200, height: 200, cursor: "pointer", transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 140ms var(--ease)", userSelect: "none" }}
              >
                {ringMode === "macros" ? (
                  <>
                    <DailyRing size={200} stroke={10} progress={pct}     color="var(--macro-calories)" trackColor="var(--ring-bg)" />
                    <div style={{ position: "absolute", inset: 14 }}><DailyRing size={172} stroke={10} progress={protPct} color="var(--macro-protein)" trackColor="var(--ring-bg)" /></div>
                    <div style={{ position: "absolute", inset: 28 }}><DailyRing size={144} stroke={10} progress={carbPct} color="var(--macro-carbs)"   trackColor="var(--ring-bg)" /></div>
                    <div style={{ position: "absolute", inset: 42 }}><DailyRing size={116} stroke={10} progress={fatPct}  color="var(--macro-fat)"     trackColor="var(--ring-bg)" /></div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <div className="overline">Macros</div>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct * 100)}%</div>
                    </div>
                  </>
                ) : (
                  <>
                    <DailyRing size={200} stroke={14} progress={pct} color="var(--macro-calories)" trackColor="var(--ring-bg)" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <div className="overline">{ringMode === "logged" ? "Logged" : "Remaining"}</div>
                      <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
                        {ringMode === "logged" ? persona.loggedKcal.toLocaleString() : remaining.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4 }}>of {persona.targetKcal.toLocaleString()} kcal</div>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { l: "Logged", v: persona.loggedKcal.toLocaleString(), d: `across ${persona.meals.length} meals` },
                    { l: "Target", v: persona.targetKcal.toLocaleString(), d: "Mifflin-St Jeor" },
                    { l: "Burned today", v: persona.burnedKcal.toLocaleString(), d: "est. so far · Apple Health" },
                    { l: "Net", v: (net > 0 ? "+" : "") + net.toLocaleString(), d: net < 0 ? "below maintenance" : "above maintenance" },
                  ].map(m => (
                    <div key={m.l} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <div className="overline">{m.l}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{m.v}</div>
                      <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>{m.d}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <Badge variant="success" icon="check">On track</Badge>
                  <Badge variant="primary">Adaptive TDEE learning · 4 of 7 days</Badge>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
              <MacroTile name="Protein" value={persona.loggedProtein} target={persona.targetProtein} unit="g" color="var(--macro-protein)" icon="beef" />
              <MacroTile name="Carbs" value={persona.loggedCarbs} target={persona.targetCarbs} unit="g" color="var(--macro-carbs)" icon="wheat" />
              <MacroTile name="Fat" value={persona.loggedFat} target={persona.targetFat} unit="g" color="var(--macro-fat)" icon="droplets" />
              <MacroTile name="Fiber" value={persona.loggedFiber} target={persona.targetFiber} unit="g" color="var(--macro-fiber)" icon="leaf" />
            </div>
          </div>

          <div className="section-h"><h3>Today's meals</h3><button className="btn btn-ghost" onClick={onLog} style={{ fontSize: 12, padding: "4px 10px" }}><Icon name="plus" size={12} /> Log meal</button></div>
          <div className="card" style={{ padding: 0 }}>
            {persona.meals.map(m => (
              <button key={m.id} className="meal-row" style={{ gridTemplateColumns: "40px 1fr auto", padding: "14px 16px" }}>
                <span className="icon-box" style={{ width: 40, height: 40, background: `color-mix(in oklab, ${m.color} 18%, transparent)`, color: m.color }}><Icon name={m.icon} size={20} /></span>
                <span>
                  <span className="t1" style={{ display: "block" }}>{m.title}</span>
                  <span className="t2" style={{ display: "block" }}>{m.meta}</span>
                </span>
                <span className="trail"><span className="kc">{m.kcal} kcal</span>{m.p} P · {m.c} C · {m.f} F</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", lineHeight: 1.5, marginTop: 20 }}>
            Values are estimates. Actual values vary by preparation method, brand, and portion size. Suppr is a personal tracking tool, not a medical device.
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="overline" style={{ color: "var(--primary-light)", marginBottom: 8 }}>Weekly insight</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{persona.insight.title}</div>
            <p style={{ fontSize: 13, color: "var(--fg-secondary)", margin: "0 0 14px", lineHeight: 1.55 }}>{persona.insight.body}</p>
            <div className="spark">
              {[30, 42, 38, 55, 62, 72, 80].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
            </div>
          </div>
          <div className="card">
            <div className="overline" style={{ marginBottom: 10 }}>Apple Health · today</div>
            {[
              { icon: "footprints", c: "var(--fg-secondary)", l: "Steps", v: persona.steps.toLocaleString() },
              { icon: "flame", c: "var(--warning)", l: "Active energy", v: `${persona.activeBurn} kcal` },
              { icon: "heart-pulse", c: "var(--macro-fat)", l: "Resting burn", v: `${persona.restingBurn.toLocaleString()} kcal` },
              { icon: "scale", c: "var(--macro-protein)", l: "Weight", v: `${persona.weight} kg` },
            ].map((r, i) => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg-secondary)" }}>
                  <Icon name={r.icon} size={16} color={r.c} />{r.l}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.v}</div>
              </div>
            ))}
          </div>
          <button className="card" onClick={() => onOpenRecipe(recipes[1])} style={{
            background: "linear-gradient(135deg, rgba(76,108,224,0.18), rgba(224,72,136,0.18))",
            border: "1px solid rgba(108,140,255,0.25)",
            textAlign: "left", cursor: "pointer", color: "var(--fg)", fontFamily: "inherit",
          }}>
            <div className="overline" style={{ color: "var(--primary-light)", marginBottom: 6 }}>Suggestion</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Dinner could hit your target</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 10 }}>With {remaining} kcal and {persona.targetProtein - persona.loggedProtein} g protein to go</div>
            <div className="photo-ph" style={{ aspectRatio: "4/3", marginBottom: 10 }}>salmon</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Salmon with lentils & greens</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)" }}>From library · <b style={{ color: "var(--fg)" }}>460 kcal</b> · <b style={{ color: "var(--fg)" }}>42 g P</b></div>
          </button>
        </div>
      </div>
    </>
  );
}

function WebPlan({ onOpenRecipe }) {
  const getR = id => recipes.find(x => x.id === id);
  const [swapFor, setSwapFor] = React.useState(null);
  const [overrides, setOverrides] = React.useState({});
  const keyFor = (di, s) => `${di}:${s}`;
  const pickSwap = (rid) => { if (!swapFor) return; setOverrides(o => ({ ...o, [keyFor(swapFor.di, swapFor.slot)]: rid })); setSwapFor(null); };
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Meal plan</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Week of May 12 · hits targets 6 of 7 days</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
        {weekPlan.map((d, di) => (
          <div key={d.day} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, background: d.today ? "color-mix(in oklab, var(--primary) 10%, var(--card))" : "var(--card)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{d.day}</div>
              {d.today && <Badge variant="primary">Today</Badge>}
            </div>
            {["breakfast", "lunch", "dinner"].map(slot => {
              const rid = overrides[keyFor(di, slot)] || d[slot];
              const r = getR(rid);
              return (
                <div key={slot} style={{ background: "var(--muted)", borderRadius: 10, padding: 10, position: "relative" }}>
                  <button onClick={() => onOpenRecipe(r)} style={{ background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)", width: "100%" }}>
                    <div className="overline" style={{ marginBottom: 4 }}>{slot}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, paddingRight: 20 }}>{r.title}</div>
                    <div style={{ fontSize: 10, color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>{r.kcal} kcal · {r.p} P</div>
                  </button>
                  <button onClick={() => setSwapFor({ di, slot })} title="Swap" style={{
                    position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 6,
                    background: "var(--card)", border: "1px solid var(--border)", color: "var(--fg-secondary)",
                    cursor: "pointer", display: "grid", placeItems: "center",
                  }}>
                    <Icon name="refresh-cw" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button className="btn btn-primary"><Icon name="shopping-cart" size={14} /> Shopping list</button>
        <button className="btn btn-secondary">Regenerate week</button>
      </div>
      {swapFor && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={() => setSwapFor(null)}>
          <div onClick={e=>e.stopPropagation()} className="card" style={{ width: 440, maxWidth: "100%", maxHeight: "80vh", overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div className="overline">Swap</div>
                <h3 style={{ margin: "4px 0 0", fontSize: 16, textTransform: "capitalize" }}>{weekPlan[swapFor.di].day} · {swapFor.slot}</h3>
              </div>
              <button onClick={() => setSwapFor(null)} style={{ background: "var(--muted)", border: 0, width: 30, height: 30, borderRadius: 8, cursor: "pointer", color: "var(--fg)" }}><Icon name="x" size={14} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recipes.map(r => (
                <button key={r.id} onClick={() => pickSwap(r.id)} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "12px 14px", background: "var(--muted)", border: 0, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--fg)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>{r.time} min · {r.servings} servings</div>
                  </div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.kcal}</div>
                    <div style={{ fontSize: 10, color: "var(--fg-tertiary)" }}>{r.p} P · {r.c} C</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WebLibrary({ onOpenRecipe, title = "Library" }) {
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{title}</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>{recipes.length * 21} recipes · sorted by recent</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {recipes.concat(recipes).map((r, i) => (
          <button key={i} onClick={() => onOpenRecipe(r)} className="card" style={{ padding: 0, overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)" }}>
            <div className="photo-ph" style={{ aspectRatio: "4/3", borderRadius: 0, border: 0 }}>{r.title.toLowerCase().split(" ")[0]}</div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 3 }}>{r.source}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11, color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>
                <span>{r.kcal} kcal</span><span>{r.p} P</span><span>{r.time} min</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function WebHouseholdBar({ persona }) {
  const [sel, setSel] = React.useState("all");
  return (
    <div className="card" style={{ padding: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div className="overline" style={{ marginRight: 4 }}>Household</div>
      <button onClick={() => setSel("all")} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
        background: sel === "all" ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "var(--muted)",
        color: sel === "all" ? "var(--primary)" : "var(--fg-secondary)",
        border: 0, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
      }}>
        <Icon name="users" size={12} /> All {persona.members.length}
      </button>
      {persona.members.map(m => (
        <button key={m.id} onClick={() => setSel(m.id)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px",
          background: sel === m.id ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "var(--muted)",
          color: sel === m.id ? "var(--primary)" : "var(--fg-secondary)",
          border: 0, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
        }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: m.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{m.initials}</span>
          {m.name}
          <span style={{ color: "var(--fg-tertiary)", fontWeight: 500, fontSize: 11 }}>{m.role}</span>
        </button>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }}><Icon name="user-plus" size={12} /> Add member</button>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }}><Icon name="settings" size={12} /> Manage</button>
      </div>
    </div>
  );
}

function WebProgress({ persona }) {
  const [range, setRange] = React.useState("7d");
  const { weight: weight7, kcal: kcal7, protein: protein7 } = progressSeries;
  const rand = s => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
  const mk = (n, base, spr, sb) => Array.from({ length: n }, (_, i) => base + (rand(sb + i) - 0.5) * spr);
  const datasets = {
    "7d":  { weight: weight7, kcal: kcal7, protein: protein7, days: ["Thu","Fri","Sat","Sun","Mon","Tue","Wed"], label: "Last 7 days" },
    "30d": { weight: mk(30, persona.weight + 0.6, 0.8, 7), kcal: mk(30, persona.targetKcal - 80, 600, 17).map(Math.round), protein: mk(30, persona.targetProtein - 8, 50, 27).map(Math.round), days: Array.from({length:30},(_,i)=>i%5===0?`${i+1}`:""), label: "Last 30 days" },
    "90d": { weight: mk(12, persona.weight + 1.4, 1.2, 37), kcal: mk(12, persona.targetKcal - 50, 400, 47).map(Math.round), protein: mk(12, persona.targetProtein - 6, 30, 57).map(Math.round), days: ["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"], label: "Last 90 days" },
    "all": { weight: mk(12, persona.weight + 2.2, 2.0, 67), kcal: mk(12, persona.targetKcal, 300, 77).map(Math.round), protein: mk(12, persona.targetProtein - 2, 25, 87).map(Math.round), days: ["Jan","","Mar","","May","","Jul","","Sep","","Nov",""], label: "All time" },
  };
  const ds = datasets[range];
  const weight = ds.weight, kcal = ds.kcal, protein = ds.protein, days = ds.days;
  const maxW = Math.max(...weight) + 0.2, minW = Math.min(...weight) - 0.2;
  const kcalMax = Math.max(...kcal) * 1.1;
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Progress</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>{ds.label}</div>
      {persona.isHousehold && <WebHouseholdBar persona={persona} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--muted)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[["7d","7d"],["30d","30d"],["90d","90d"],["all","All"]].map(([id, label]) => (
          <button key={id} onClick={() => setRange(id)} style={{
            padding: "8px 16px", border: 0,
            background: range === id ? "var(--card)" : "transparent",
            color: range === id ? "var(--fg)" : "var(--fg-secondary)",
            borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            boxShadow: range === id ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div className="overline">Weight</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{persona.weight}</div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>kg</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 2 }}><Icon name="trending-down" size={12} /> −0.8 kg this week</div>
            </div>
            <Badge variant="success">On track</Badge>
          </div>
          <svg viewBox="0 0 400 120" style={{ width: "100%", height: 120 }}>
            <defs>
              <linearGradient id="wg2" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const pts = weight.map((w, i) => [
                (i / (weight.length - 1)) * 380 + 10,
                110 - ((w - minW) / (maxW - minW)) * 95
              ]);
              const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
              return (
                <>
                  <path d={path + ` L${pts[pts.length-1][0]},115 L${pts[0][0]},115 Z`} fill="url(#wg2)" />
                  <path d={path} stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
                  {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} fill="var(--primary)" stroke="var(--bg)" strokeWidth={i === pts.length - 1 ? 2 : 0} />)}
                </>
              );
            })()}
          </svg>
        </div>
        <div className="card">
          <div className="overline">Calories (avg/day)</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", marginTop: 8 }}>
            {Math.round(kcal.reduce((a,b)=>a+b,0) / kcal.length).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14 }}>Target {persona.targetKcal.toLocaleString()}</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 90 }}>
            {kcal.map((k, i) => (
              <div key={i} style={{ flex: 1, height: `${(k/kcalMax)*100}%`, background: "var(--macro-calories)", borderRadius: "3px 3px 0 0", opacity: i === kcal.length-1 ? 1 : 0.7, minHeight: 2 }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, fontSize: 10, color: "var(--fg-tertiary)", marginTop: 6 }}>
            {days.map((d, i) => <span key={i} style={{ flex: 1, textAlign: "center" }}>{d}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="overline">Protein (avg/day)</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", marginTop: 8 }}>
            {Math.round(protein.reduce((a,b)=>a+b,0) / protein.length)}<span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: 500 }}> g</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14 }}>Target {persona.targetProtein} g</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 70 }}>
            {protein.map((p, i) => (
              <div key={i} style={{ flex: 1, height: `${Math.min(100, (p/persona.targetProtein)*100)}%`, background: "var(--macro-protein)", borderRadius: "3px 3px 0 0", opacity: i === protein.length-1 ? 1 : 0.7, minHeight: 2 }} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="overline">Trend summary</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--fg-secondary)" }}>Days hit calorie target</span>
              <b>5 of 7</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--fg-secondary)" }}>Days hit protein target</span>
              <b>4 of 7</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--fg-secondary)" }}>Weigh-ins</span>
              <b>6 of 7</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--fg-secondary)" }}>Projected {persona.goalWeight} kg by</span>
              <b>14 July</b>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function WebImport() {
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Import recipe</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Paste a link. We parse ingredients and match macros against USDA + Open Food Facts.</div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="overline" style={{ marginBottom: 8 }}>Recipe URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", background: "var(--muted)", borderRadius: 12 }}>
          <Icon name="link" size={16} color="var(--fg-tertiary)" />
          <input placeholder="instagram.com/... · tiktok.com/... · blog" style={{ flex: 1, background: "transparent", border: 0, outline: "none", fontFamily: "inherit", fontSize: 14, color: "var(--fg)" }} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 14 }}>Parse recipe</button>
      </div>
    </>
  );
}

function WebShopping() {
  const sections = [
    { name: "Produce", items: ["Broccoli (2 heads)", "Red pepper (3)", "Spinach (200g)", "Avocado (2)", "Banana (6)"] },
    { name: "Protein", items: ["Chicken thighs (800g)", "Salmon fillet (400g)", "Greek yogurt 2% (1kg)"] },
    { name: "Pantry", items: ["Jasmine rice (500g)", "Lentils (250g)", "Olive oil", "Paprika"] },
  ];
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Shopping list</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>12 items · from this week's plan</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 900 }}>
        {sections.map(s => (
          <div key={s.name} className="card">
            <div className="overline" style={{ marginBottom: 10 }}>{s.name}</div>
            {s.items.map(it => (
              <div key={it} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, border: "1.5px solid var(--border)" }} />
                {it}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function WebTargets({ persona }) {
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Targets</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Estimated TDEE based on Mifflin-St Jeor · moderate activity</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900 }}>
        <div className="card">
          <div className="overline">Daily calorie target</div>
          <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginTop: 8 }}>{persona.targetKcal.toLocaleString()}</div>
          <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>kcal / day · 500 kcal deficit</div>
        </div>
        <div className="card">
          <div className="overline">Goal</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Reach {persona.goalWeight} kg</div>
          <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginTop: 4 }}>Currently {persona.weight} kg · could reach by ≈ 14 July</div>
        </div>
      </div>
      <div className="section-h"><h3>Macros</h3></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 900 }}>
        <MacroTile name="Protein" value={persona.targetProtein} target={persona.targetProtein} unit="g" color="var(--macro-protein)" icon="beef" />
        <MacroTile name="Carbs" value={persona.targetCarbs} target={persona.targetCarbs} unit="g" color="var(--macro-carbs)" icon="wheat" />
        <MacroTile name="Fat" value={persona.targetFat} target={persona.targetFat} unit="g" color="var(--macro-fat)" icon="droplets" />
        <MacroTile name="Fiber" value={persona.targetFiber} target={persona.targetFiber} unit="g" color="var(--macro-fiber)" icon="leaf" />
      </div>
    </>
  );
}

function WebHealth({ persona }) {
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Apple Health</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Connected · last synced 4 minutes ago</div>
      <div className="card" style={{ maxWidth: 600 }}>
        {[
          { label: "Active energy", v: `${persona.activeBurn} kcal`, icon: "flame" },
          { label: "Resting energy", v: `${persona.restingBurn.toLocaleString()} kcal`, icon: "heart-pulse" },
          { label: "Steps", v: persona.steps.toLocaleString(), icon: "footprints" },
          { label: "Body weight", v: `${persona.weight} kg`, icon: "scale" },
        ].map((r, i) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Icon name={r.icon} size={18} color="var(--fg-secondary)" />
              <div style={{ fontSize: 14 }}>{r.label}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.v}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function WebSettings() {
  return (
    <>
      <h1 style={{ fontSize: 24, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Settings</h1>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 20 }}>Account, notifications, privacy.</div>
      <div className="card" style={{ maxWidth: 600, padding: 0 }}>
        {[
          { icon: "user", label: "Account", sub: "grace@suppr.app" },
          { icon: "bell", label: "Notifications", sub: "Meal reminders on" },
          { icon: "moon", label: "Appearance", sub: "System" },
          { icon: "shield", label: "Privacy", sub: "Export or delete your data" },
          { icon: "log-out", label: "Sign out" },
        ].map((it, i) => (
          <div key={it.label} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", padding: "14px 16px", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
            <Icon name={it.icon} size={18} color="var(--fg-secondary)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.label}</div>
              {it.sub && <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>{it.sub}</div>}
            </div>
            <Icon name="chevron-right" size={16} color="var(--fg-tertiary)" />
          </div>
        ))}
      </div>
    </>
  );
}

Object.assign(window, { WebApp });
