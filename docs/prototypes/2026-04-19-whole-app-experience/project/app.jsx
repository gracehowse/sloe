/* Suppr — root app: routes, modals, Tweaks wiring */

const { useState: uS, useEffect: uE } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "platform": "mobile",
  "theme": "dark",
  "persona": "loss",
  "heroVariant": "ring",
  "density": "standard",
  "tab": "today"
}/*EDITMODE-END*/;

function App() {
  const [platform, setPlatform] = uS(TWEAK_DEFAULTS.platform);
  const [theme, setTheme] = uS(TWEAK_DEFAULTS.theme);
  const [personaKey, setPersonaKey] = uS(TWEAK_DEFAULTS.persona);
  const [heroVariant, setHeroVariant] = uS(TWEAK_DEFAULTS.heroVariant);
  const [density, setDensity] = uS(TWEAK_DEFAULTS.density);

  const [tab, setTab] = uS(TWEAK_DEFAULTS.tab || "today"); // mobile bottom tab
  const [webRoute, setWebRoute] = uS("today");
  const [modal, setModal] = uS(null); // {type, data}
  const [tweaksOpen, setTweaksOpen] = uS(false);
  const [tweaksVisible, setTweaksVisible] = uS(false);

  // persona is now derived inside AppProvider children via livePersona

  // Apply theme/platform to html + persist position
  uE(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  uE(() => { document.documentElement.dataset.platform = platform; }, [platform]);
  uE(() => { document.documentElement.dataset.density = density; }, [density]);
  uE(() => {
    try { localStorage.setItem("suppr.pos", JSON.stringify({ platform, theme, personaKey, heroVariant, density, tab, webRoute })); } catch {}
  }, [platform, theme, personaKey, heroVariant, density, tab, webRoute]);
  uE(() => {
    try {
      const s = JSON.parse(localStorage.getItem("suppr.pos") || "null");
      if (s) {
        setPlatform(s.platform); setTheme(s.theme); setPersonaKey(s.personaKey);
        setHeroVariant(s.heroVariant); setDensity(s.density); setTab(s.tab); setWebRoute(s.webRoute);
      }
    } catch {}
  }, []);

  // Tweaks host protocol
  uE(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") { setTweaksVisible(true); setTweaksOpen(true); }
      if (e.data.type === "__deactivate_edit_mode") { setTweaksVisible(false); setTweaksOpen(false); }
    };
    window.addEventListener("message", handler);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", handler);
  }, []);

  const persist = (key, val) => {
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*"); } catch {}
  };

  const closeModal = () => setModal(null);
  const openRecipe = (r) => setModal({ type: "recipe", data: r });
  const openMeal = (m) => setModal({ type: "meal", data: m });

  const handleMoreNav = (dest) => {
    if (["settings","library","shopping","targets","health","paywall","import","household"].includes(dest)) setModal({ type: dest });
  };

  return (
    <AppProvider personaKey={personaKey}>
      <AppBody
        platform={platform} theme={theme} personaKey={personaKey}
        heroVariant={heroVariant} density={density}
        tab={tab} setTab={setTab} webRoute={webRoute} setWebRoute={setWebRoute}
        modal={modal} setModal={setModal} closeModal={closeModal}
        openRecipe={openRecipe} openMeal={openMeal} handleMoreNav={handleMoreNav}
        tweaksVisible={tweaksVisible} tweaksOpen={tweaksOpen} setTweaksOpen={setTweaksOpen}
        setPlatform={setPlatform} setTheme={setTheme} setPersonaKey={setPersonaKey}
        setHeroVariant={setHeroVariant} setDensity={setDensity} persist={persist}
      />
    </AppProvider>
  );
}

function AppBody(p) {
  const { platform, personaKey, heroVariant, density, tab, setTab, webRoute, setWebRoute,
          modal, setModal, closeModal, openRecipe, openMeal, handleMoreNav,
          tweaksVisible, tweaksOpen, setTweaksOpen,
          setPlatform, setTheme, setPersonaKey, setHeroVariant, setDensity, persist, theme } = p;
  const app = useApp();
  const persona = livePersona(personaKey, app.mealsByPersona);

  return (
    <div className="shell">
      {platform === "mobile" ? (
        <div className="stage-mobile">
          <div className="iphone" data-screen-label="Phone">
            <StatusBar />
            <div className="screen" data-screen-label={
              tab === "today" ? "01 Today" :
              tab === "discover" ? "02 Discover" :
              tab === "plan" ? "03 Plan" :
              tab === "progress" ? "04 Progress" : "05 More"
            }>
              {tab === "today" && <TodayScreen persona={persona} onOpenMeal={openMeal} onOpenLog={() => setModal({type:"log"})} onOpenRecipe={openRecipe} heroVariant={heroVariant} />}
              {tab === "discover" && <DiscoverScreen onOpenRecipe={openRecipe} />}
              {tab === "plan" && <PlanScreen persona={persona} onOpenRecipe={openRecipe} />}
              {tab === "progress" && <ProgressScreen persona={persona} />}
              {tab === "more" && <MoreScreen persona={persona} onNavigate={handleMoreNav} />}

              {/* Modals live inside phone */}
              {modal?.type === "log" && <LogMealSheet onClose={closeModal} onPick={(f, s) => { app.logMeal(f, s); closeModal(); }} onPickMany={(m) => { app.logMeal(m, 1); closeModal(); }} />}
              {modal?.type === "meal" && <MealDetailSheet meal={modal.data} onClose={closeModal} onDelete={() => { app.deleteMeal(modal.data.id); closeModal(); }} />}
              {modal?.type === "recipe" && <RecipeDetail recipe={modal.data} onClose={closeModal} onCook={() => setModal({type:"cook", data: modal.data})} onLog={() => { app.logMeal({ title: modal.data.title, kcal: modal.data.kcal, p: modal.data.p, c: modal.data.c, f: modal.data.f }); closeModal(); }} />}
              {modal?.type === "cook" && <CookMode recipe={modal.data} onClose={() => { app.logMeal({ title: modal.data.title, kcal: modal.data.kcal, p: modal.data.p, c: modal.data.c, f: modal.data.f }); closeModal(); }} />}
              {modal?.type === "import" && <ImportFlow onClose={closeModal} onImported={() => { app.showToast("Saved to library", "bookmark-check"); closeModal(); }} />}
              {modal?.type === "paywall" && <Paywall onClose={closeModal} />}
              {modal?.type === "settings" && <SettingsPage onClose={closeModal} persona={persona} />}
              {modal?.type === "household" && <HouseholdSettings onClose={closeModal} persona={persona} />}
              {modal?.type === "library" && <LibraryPage onClose={closeModal} onOpenRecipe={(r)=>setModal({type:"recipe",data:r})} />}
              {modal?.type === "shopping" && <ShoppingPage onClose={closeModal} />}
              {modal?.type === "targets" && <TargetsPage onClose={closeModal} persona={persona} />}
              {modal?.type === "health" && <HealthPage onClose={closeModal} persona={persona} />}

              {/* FAB */}
              {tab !== "more" && (
                <button className="fab" onClick={() => setModal({type:"log"})} aria-label="Log meal"><Icon name="plus" size={26} /></button>
              )}

              {/* Tab bar */}
              <div className="tabbar">
                {[
                  { id: "today", icon: "flame", label: "Today" },
                  { id: "discover", icon: "compass", label: "Discover" },
                  { id: "plan", icon: "calendar-days", label: "Plan" },
                  { id: "progress", icon: "trending-up", label: "Progress" },
                  { id: "more", icon: "circle-user", label: "More" },
                ].map(t => (
                  <button key={t.id} className={`tab ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
                    <Icon name={t.icon} size={22} strokeWidth={tab===t.id?2.2:1.75} />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="home-indicator" />
            </div>
          </div>
        </div>
      ) : (
        <WebApp persona={persona} route={webRoute} setRoute={setWebRoute} onOpenRecipe={openRecipe} onOpenPaywall={() => setModal({type:"paywall"})} heroVariant={heroVariant} modal={modal} setModal={setModal} closeModal={closeModal} onLogMeal={(f)=>app.logMeal(f)} />
      )}

      {/* Toast */}
      {app.toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: platform === "mobile" ? 100 : 40,
          transform: "translateX(-50%)", zIndex: 10001,
          background: "#16161e", color: "#e4e4e8",
          border: "1px solid #282830", borderRadius: 12,
          padding: "10px 16px", display: "flex", gap: 10, alignItems: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          fontSize: 13, fontWeight: 600,
          animation: "fadeInUp 200ms var(--ease)",
        }}>
          <span style={{ color: "var(--success)" }}><Icon name={app.toast.icon} size={14} /></span>
          {app.toast.msg}
        </div>
      )}

      {/* Tweaks */}
      {tweaksVisible && !tweaksOpen && (
        <button className="tw-launcher" onClick={() => setTweaksOpen(true)} title="Tweaks">
          <Icon name="sliders-horizontal" size={18} />
        </button>
      )}
      {tweaksVisible && tweaksOpen && (
        <div className="tweaks-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4>Tweaks</h4>
            <button onClick={() => setTweaksOpen(false)} style={{ background: "transparent", border: 0, color: "#7a7a88", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} /></button>
          </div>
          <Seg label="Platform" val={platform} opts={["mobile","web"]} onChange={v=>{setPlatform(v); persist("platform",v);}} />
          <Seg label="Theme" val={theme} opts={["dark","light"]} onChange={v=>{setTheme(v); persist("theme",v);}} />
          <Seg label="Persona" val={personaKey} opts={["loss","maintain","recomp","household"]} onChange={v=>{setPersonaKey(v); persist("persona",v);}} />
          <Seg label="Hero (Today)" val={heroVariant} opts={["ring","bar","number"]} onChange={v=>{setHeroVariant(v); persist("heroVariant",v);}} />
          <Seg label="Density" val={density} opts={["compact","standard","comfortable"]} onChange={v=>{setDensity(v); persist("density",v);}} />
          {platform === "mobile" && (
            <Seg label="Tab" val={tab} opts={["today","discover","plan","progress","more"]} onChange={v=>{setTab(v); persist("tab",v);}} />
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" style={{ fontSize: 11, padding: "6px 10px", background: "#0a0a0f", color: "#e4e4e8", border: "1px solid #282830" }} onClick={() => setModal({type:"log"})}>Log meal</button>
            <button className="btn" style={{ fontSize: 11, padding: "6px 10px", background: "#0a0a0f", color: "#e4e4e8", border: "1px solid #282830" }} onClick={() => setModal({type:"recipe", data: recipes[0]})}>Recipe</button>
            <button className="btn" style={{ fontSize: 11, padding: "6px 10px", background: "#0a0a0f", color: "#e4e4e8", border: "1px solid #282830" }} onClick={() => setModal({type:"cook", data: recipes[0]})}>Cook</button>
            <button className="btn" style={{ fontSize: 11, padding: "6px 10px", background: "#0a0a0f", color: "#e4e4e8", border: "1px solid #282830" }} onClick={() => setModal({type:"import"})}>Import</button>
            <button className="btn" style={{ fontSize: 11, padding: "6px 10px", background: "#0a0a0f", color: "#e4e4e8", border: "1px solid #282830" }} onClick={() => setModal({type:"paywall"})}>Paywall</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Seg({ label, val, opts, onChange }) {
  return (
    <div className="tw-row">
      <label>{label}</label>
      <div className="seg">
        {opts.map(o => <button key={o} className={val===o?"on":""} onClick={()=>onChange(o)}>{o}</button>)}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
