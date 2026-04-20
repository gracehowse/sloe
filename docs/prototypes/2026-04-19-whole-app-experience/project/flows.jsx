/* Suppr — modals & flows: Log meal sheet, Recipe detail, Cook mode, Import, Paywall, Meal detail */

// ─── Log meal sheet ──────────────────────────────────────────
function LogMealSheet({ onClose, onPick, onPickMany }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("search");
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const [cart, setCart] = useState([]); // [{title, kcal, p, c, f, servings, source}]
  const [mealName, setMealName] = useState("");
  const methods = [
    { id: "search", icon: "search", label: "Search", sub: "USDA + Open Food Facts" },
    { id: "scan", icon: "scan-line", label: "Scan", sub: "Barcode" },
    { id: "photo", icon: "camera", label: "Photo", sub: "Pro" },
    { id: "voice", icon: "mic", label: "Voice", sub: "Pro" },
    { id: "recent", icon: "history", label: "Recents", sub: "Last 7 days" },
  ];
  const results = [
    { title: "Chicken breast, grilled", sub: "100 g · USDA", kcal: 165, p: 31, c: 0, f: 3.6, source: "search" },
    { title: "Greek yogurt, plain 2%", sub: "170 g · USDA", kcal: 120, p: 17, c: 7, f: 3, source: "search" },
    { title: "Oatmeal, cooked with water", sub: "1 cup · USDA", kcal: 158, p: 6, c: 27, f: 3, source: "search" },
    { title: "Banana, medium", sub: "118 g · USDA", kcal: 105, p: 1.3, c: 27, f: 0.4, source: "search" },
    { title: "Strawberries, fresh", sub: "100 g · USDA", kcal: 32, p: 0.7, c: 7.7, f: 0.3, source: "search" },
    { title: "Almonds, raw", sub: "28 g · USDA", kcal: 164, p: 6, c: 6, f: 14, source: "search" },
    { title: "Eggs, scrambled (2)", sub: "100 g · USDA", kcal: 182, p: 12, c: 1, f: 14, source: "search" },
    { title: "Brown rice, cooked", sub: "1 cup · USDA", kcal: 216, p: 5, c: 45, f: 1.8, source: "search" },
  ];
  const scanResults = [
    { title: "Chobani Greek Yogurt — Vanilla", sub: "150 g · scanned 0-894700010045", kcal: 140, p: 12, c: 17, f: 3, source: "scan" },
    { title: "KIND Protein Bar", sub: "50 g · scanned", kcal: 250, p: 12, c: 17, f: 18, source: "scan" },
    { title: "Oatly Barista", sub: "240 ml · scanned", kcal: 140, p: 3, c: 16, f: 7, source: "scan" },
  ];
  const photoResults = [
    { title: "Sourdough toast", sub: "est · 1 slice", kcal: 120, p: 4, c: 22, f: 1, source: "photo" },
    { title: "Avocado", sub: "est · ½ medium", kcal: 120, p: 1.5, c: 6, f: 11, source: "photo" },
    { title: "Poached egg", sub: "est · 1 large", kcal: 71, p: 6, c: 0.4, f: 5, source: "photo" },
  ];
  const voiceResults = [
    { title: "Bowl of oatmeal with berries", sub: "transcribed", kcal: 220, p: 7, c: 42, f: 4, source: "voice" },
    { title: "Coffee with milk", sub: "transcribed", kcal: 30, p: 2, c: 3, f: 1, source: "voice" },
  ];
  const recentResults = [
    { title: "Greek yogurt & berries", sub: "logged Tue · breakfast", kcal: 280, p: 24, c: 18, f: 12, source: "recent" },
    { title: "Sheet-pan chicken bowl", sub: "logged Mon · lunch", kcal: 620, p: 48, c: 52, f: 22, source: "recent" },
    { title: "Apple & peanut butter", sub: "logged Mon · snack", kcal: 220, p: 6, c: 28, f: 10, source: "recent" },
  ];
  const sourceData = { search: results, scan: scanResults, photo: photoResults, voice: voiceResults, recent: recentResults };
  const activeList = sourceData[tab] || [];
  const filtered = q && tab === "search" ? activeList.filter(r => r.title.toLowerCase().includes(q.toLowerCase())) : activeList;

  const cartTotals = cart.reduce((a, x) => ({
    kcal: a.kcal + x.kcal * x.servings,
    p: a.p + x.p * x.servings, c: a.c + x.c * x.servings, f: a.f + x.f * x.servings,
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  const addToCart = () => {
    if (!selected) return;
    setCart(c => [...c, { ...selected, servings, id: "c" + Date.now() }]);
    setSelected(null); setServings(1);
  };

  const logAll = () => {
    const name = mealName || (cart.length === 1 ? cart[0].title : `${cart.length}-item meal`);
    const combined = {
      title: name,
      kcal: Math.round(cartTotals.kcal),
      p: +cartTotals.p.toFixed(1),
      c: +cartTotals.c.toFixed(1),
      f: +cartTotals.f.toFixed(1),
      items: cart,
    };
    if (onPickMany) onPickMany(combined);
    else onPick(combined, 1);
  };

  const sourceIcon = (s) => ({ search: "search", scan: "scan-line", photo: "camera", voice: "mic", recent: "history" }[s] || "utensils");

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{cart.length > 0 ? `Build meal · ${cart.length} item${cart.length>1?"s":""}` : "Log meal"}</h2>
          <button className="sheet-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: "0 20px 12px" }}>
          {cart.length > 0 && (
            <div style={{ background: "var(--muted)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <input value={mealName} onChange={e=>setMealName(e.target.value)} placeholder={cart.length === 1 ? cart[0].title : "Name this meal (optional)"}
                style={{ width: "100%", background: "transparent", border: 0, outline: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }} />
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                  <Icon name={sourceIcon(item.source)} size={12} color="var(--fg-tertiary)" />
                  <span style={{ flex: 1, fontSize: 12, color: "var(--fg)" }}>
                    {item.title}{item.servings !== 1 && <span style={{ color: "var(--fg-tertiary)" }}> · ×{item.servings}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>{Math.round(item.kcal*item.servings)} kcal</span>
                  <button onClick={() => setCart(c=>c.filter(x=>x.id!==item.id))} style={{ background: "transparent", border: 0, color: "var(--fg-tertiary)", cursor: "pointer", padding: 2 }}><Icon name="x" size={12} /></button>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 6, borderTop: "1px solid var(--border)", fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: "var(--fg-secondary)" }}>Total</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(cartTotals.kcal)} kcal · {cartTotals.p.toFixed(0)} P · {cartTotals.c.toFixed(0)} C · {cartTotals.f.toFixed(0)} F</span>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 14 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => { setTab(m.id); setSelected(null); }} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "12px 4px", borderRadius: 12,
                background: tab === m.id ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "var(--muted)",
                color: tab === m.id ? "var(--primary)" : "var(--fg-secondary)",
                border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 10, fontWeight: 600,
              }}>
                <Icon name={m.icon} size={18} />
                <span style={{ textAlign: "center", lineHeight: 1.2 }}>{m.label}</span>
              </button>
            ))}
          </div>
          {tab === "search" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", background: "var(--muted)", borderRadius: 12, marginBottom: 14 }}>
              <Icon name="search" size={16} color="var(--fg-tertiary)" />
              <input
                autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search foods"
                style={{ flex: 1, background: "transparent", border: 0, outline: "none", fontFamily: "inherit", fontSize: 14, color: "var(--fg)" }}
              />
            </div>
          )}
        </div>
        <div className="sheet-body">
          <div className="overline" style={{ marginBottom: 8 }}>
            {tab === "search" && (q ? "Results" : "Suggested for your day")}
            {tab === "scan" && "Recently scanned"}
            {tab === "photo" && "Detected in your photo"}
            {tab === "voice" && "Heard"}
            {tab === "recent" && "Your recent foods"}
          </div>
          <div className="card" style={{ padding: 0 }}>
            {filtered.map((r, i) => (
              <button key={i} className="meal-row" onClick={() => { setSelected(r); setServings(1); }}>
                <span className="icon-box" style={{ background: "var(--muted)", color: "var(--fg-secondary)" }}>
                  <Icon name={sourceIcon(r.source)} size={16} />
                </span>
                <span>
                  <span className="t1" style={{ display: "block" }}>{r.title}</span>
                  <span className="t2" style={{ display: "block" }}>{r.sub}</span>
                </span>
                <span className="trail">
                  <span className="kc">{r.kcal}</span>{r.p} P · {r.c} C
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-tertiary)", fontSize: 13 }}>
                No matches.
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 14, lineHeight: 1.5 }}>
            Values are estimates. Mix methods — search one, scan another — and combine them into a single meal.
          </div>
        </div>
        {selected && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 20px 24px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>{Math.round(selected.kcal * servings)} kcal · {(selected.p*servings).toFixed(1)} P · {(selected.c*servings).toFixed(1)} C · {(selected.f*servings).toFixed(1)} F</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--muted)", borderRadius: 10, padding: "4px 6px" }}>
                <button onClick={() => setServings(Math.max(0.5, servings - 0.5))} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: "var(--bg)", color: "var(--fg)", cursor: "pointer" }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{servings}</span>
                <button onClick={() => setServings(servings + 0.5)} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: "var(--bg)", color: "var(--fg)", cursor: "pointer" }}>+</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn btn-secondary" onClick={addToCart}><Icon name="plus" size={14} /> Add & keep adding</button>
              <button className="btn btn-primary" onClick={() => { addToCart(); setTimeout(logAll, 0); }}>Add & log</button>
            </div>
          </div>
        )}
        {!selected && cart.length > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 20px 24px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
            <button className="btn btn-primary btn-lg" onClick={logAll}>Log meal · {Math.round(cartTotals.kcal)} kcal</button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Meal detail sheet (tap on logged meal) ──────────────────
function MealDetailSheet({ meal, onClose, onDelete }) {
  if (!meal) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{meal.title}</h2>
          <button className="sheet-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="sheet-body">
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14 }}>{meal.meta}</div>
          <div className="photo-ph" style={{ aspectRatio: "16/10", marginBottom: 16 }}>photo</div>
          <div className="card">
            <div className="overline" style={{ marginBottom: 8 }}>Macros</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{meal.kcal}</div>
              <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>kcal</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { n: "Protein", v: meal.p, c: "var(--macro-protein)" },
                { n: "Carbs",   v: meal.c, c: "var(--macro-carbs)" },
                { n: "Fat",     v: meal.f, c: "var(--macro-fat)" },
              ].map(m => (
                <div key={m.n} style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.1em", color: "var(--fg-tertiary)" }}>{m.n}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.c, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{m.v} g</div>
                </div>
              ))}
            </div>
          </div>
          {meal.confidence && (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Parsed from instagram.com</div>
                  <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>Matched against USDA + Open Food Facts</div>
                </div>
                <Badge variant="primary">{meal.confidence}%</Badge>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <button className="btn btn-secondary">Edit</button>
            <button className="btn btn-secondary" style={{ color: "var(--destructive)" }} onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Recipe detail screen ────────────────────────────────────
function RecipeDetail({ recipe, onClose, onCook, onLog }) {
  const app = useApp();
  const isBookmarked = app?.bookmarks?.has(recipe?.id);
  if (!recipe) return null;
  const steps = recipe.steps || [];
  const ingredients = recipe.ingredients || [];
  return (
    <div className="fullscreen slide-right">
      <div className="fullscreen-head">
        <button className="back" onClick={onClose}><Icon name="chevron-left" size={20} /></button>
        <h1>{recipe.title}</h1>
        <button className="right-btn" onClick={() => app.toggleBookmark(recipe.id)} style={{ color: isBookmarked ? "var(--primary)" : "var(--fg)" }}>
          <Icon name={isBookmarked ? "bookmark-check" : "bookmark"} size={18} />
        </button>
        <button className="right-btn" onClick={() => app.showToast("Link copied", "copy")}><Icon name="share" size={18} /></button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="photo-ph" style={{ aspectRatio: "4/3", borderRadius: 0, border: 0 }}>{recipe.title.toLowerCase()}</div>
        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(recipe.tags || []).map(t => <Badge key={t} variant="neutral">{t}</Badge>)}
            <Badge variant="primary">{recipe.confidence}%</Badge>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14 }}>Source · {recipe.source}</div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { l: "kcal", v: recipe.kcal, c: "var(--macro-calories)" },
              { l: "P",    v: recipe.p + "g", c: "var(--macro-protein)" },
              { l: "C",    v: recipe.c + "g", c: "var(--macro-carbs)" },
              { l: "F",    v: recipe.f + "g", c: "var(--macro-fat)" },
            ].map(s => (
              <div key={s.l} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 4px", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--fg-secondary)", marginBottom: 20 }}>
            <span><Icon name="clock" size={12} /> {recipe.time} min</span>
            <span><Icon name="users" size={12} /> {recipe.servings} servings</span>
          </div>

          {recipe.intro && <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg)", marginTop: 0 }}>{recipe.intro}</p>}

          {ingredients.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 10 }}>Ingredients</h3>
              <div className="card" style={{ padding: 0 }}>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: i === 0 ? 0 : "1px solid var(--border)", fontSize: 13 }}>
                    <span>{ing.name}</span>
                    <span style={{ color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>{ing.qty}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {steps.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 10 }}>Method</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {steps.map((s, i) => (
                  <div key={i} className="card" style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: "color-mix(in oklab, var(--primary) 15%, transparent)", color: "var(--primary)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{s.body}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 20, lineHeight: 1.5 }}>
            Values are estimates. Actual values vary by preparation method, brand, and portion size.
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 20px 28px", borderTop: "1px solid var(--border)", background: "var(--bg)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button className="btn btn-secondary" onClick={onLog}>Log meal</button>
        <button className="btn btn-primary" onClick={onCook} disabled={steps.length === 0} style={steps.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}>
          <Icon name="chef-hat" size={16} /> Cook
        </button>
      </div>
    </div>
  );
}

// ─── Cook mode ───────────────────────────────────────────────
function CookMode({ recipe, onClose }) {
  const [step, setStep] = useState(0);
  const [timerSec, setTimerSec] = useState(null);
  const [paused, setPaused] = useState(false);
  const steps = recipe?.steps || [];
  const cur = steps[step];

  useEffect(() => {
    if (cur?.timer) setTimerSec(cur.timer.minutes * 60);
    else setTimerSec(null);
    setPaused(false);
  }, [step]);

  useEffect(() => {
    if (timerSec === null || paused) return;
    if (timerSec <= 0) return;
    const id = setTimeout(() => setTimerSec(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerSec, paused]);

  if (!recipe) return null;

  const fmt = s => {
    if (s === null) return "—";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fullscreen">
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, var(--card)) 0%, var(--card) 100%)", padding: "54px 20px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button style={{ width: 36, height: 36, borderRadius: 18, background: "var(--muted)", border: 0, color: "var(--fg)", display: "grid", placeItems: "center", cursor: "pointer" }} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
          <div className="overline">Cook mode</div>
          <button style={{ width: 36, height: 36, borderRadius: 18, background: "var(--muted)", border: 0, color: "var(--fg)", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icon name="volume-2" size={16} />
          </button>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{recipe.title}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: "var(--fg-secondary)" }}>
          <span><Icon name="clock" size={12} /> {recipe.time} min</span>
          <span><Icon name="users" size={12} /> {recipe.servings} servings</span>
          <span><Icon name="flame" size={12} color="var(--macro-calories)" /> {recipe.kcal} kcal</span>
        </div>
      </div>

      {/* Step head */}
      <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="overline">Step {step + 1} of {steps.length}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {steps.map((_, i) => (
            <span key={i} style={{
              width: 22, height: 4, borderRadius: 2,
              background: i < step ? "var(--success)" : i === step ? "var(--primary)" : "var(--muted)"
            }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
        <p style={{ fontSize: 17, lineHeight: 1.5, margin: "0 0 16px" }}>{cur?.body}</p>

        {cur?.ingredients?.length > 0 && (
          <div className="card">
            <div className="overline" style={{ marginBottom: 8 }}>This step uses</div>
            {cur.ingredients.map((name, i) => {
              const ing = recipe.ingredients.find(x => x.name === name);
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i === 0 ? 0 : "1px solid var(--border)", fontSize: 13 }}>
                  <span>{name}</span>
                  <span style={{ color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>{ing?.qty}</span>
                </div>
              );
            })}
          </div>
        )}

        {cur?.timer && (
          <div className="card" style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: "color-mix(in oklab, var(--warning) 18%, transparent)", color: "var(--warning)", display: "grid", placeItems: "center" }}>
              <Icon name="timer" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(timerSec)}</div>
              <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>{cur.timer.name} · {cur.timer.minutes} min</div>
            </div>
            <button onClick={() => setPaused(p => !p)} style={{ width: 40, height: 40, borderRadius: 20, background: "var(--muted)", border: 0, color: "var(--fg)", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Icon name={paused ? "play" : "pause"} size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 28px", display: "grid", gridTemplateColumns: "56px 1fr 56px", gap: 10, borderTop: "1px solid var(--border)" }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ height: 52, borderRadius: 14, background: "var(--muted)", border: 0, color: "var(--fg)", display: "grid", placeItems: "center", cursor: step === 0 ? "not-allowed" : "pointer", opacity: step === 0 ? 0.4 : 1 }}>
          <Icon name="chevron-left" size={20} />
        </button>
        {step === steps.length - 1
          ? <button className="btn btn-primary" style={{ height: 52, fontSize: 15 }} onClick={onClose}>Finish & log meal</button>
          : <button className="btn btn-primary" style={{ height: 52, fontSize: 15 }} onClick={() => setStep(step + 1)}>Next step</button>
        }
        <button style={{ height: 52, borderRadius: 14, background: "var(--muted)", border: 0, color: "var(--fg)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <Icon name="check" size={20} />
        </button>
      </div>
    </div>
  );
}

// ─── Import flow ─────────────────────────────────────────────
function ImportFlow({ onClose, onImported }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("input"); // input | parsing | result
  const parse = () => {
    setPhase("parsing");
    setTimeout(() => setPhase("result"), 1600);
  };
  return (
    <div className="fullscreen">
      <div className="fullscreen-head">
        <button className="back" onClick={onClose}><Icon name="chevron-left" size={20} /></button>
        <h1>Import recipe</h1>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {phase === "input" && (
          <>
            <div className="overline" style={{ marginBottom: 8 }}>Paste a link</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <Icon name="link" size={16} color="var(--fg-tertiary)" />
              <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="instagram.com/... · tiktok.com/... · blog"
                style={{ flex: 1, background: "transparent", border: 0, outline: "none", fontFamily: "inherit", fontSize: 14, color: "var(--fg)" }} />
            </div>
            <button className="btn btn-primary btn-lg" style={{ marginTop: 12 }} onClick={parse} disabled={!url}>Parse recipe</button>

            <div className="section-h"><h3>Or pick a source</h3></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { icon: "instagram", label: "Instagram" },
                { icon: "music", label: "TikTok" },
                { icon: "globe", label: "Recipe blog" },
                { icon: "book-open", label: "From library" },
              ].map(s => (
                <button key={s.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--fg)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in oklab, var(--primary) 15%, transparent)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                    <Icon name={s.icon} size={18} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 16, lineHeight: 1.5 }}>
              Results are estimates and should be reviewed before saving.
            </div>
          </>
        )}
        {phase === "parsing" && (
          <div style={{ display: "grid", placeItems: "center", minHeight: 400 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, border: "3px solid var(--muted)", borderTopColor: "var(--primary)", margin: "0 auto 14px", animation: "spin 800ms linear infinite" }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>Parsing ingredients…</div>
              <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4 }}>Matching against USDA + Open Food Facts</div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {phase === "result" && (
          <>
            <div className="photo-ph" style={{ aspectRatio: "16/10", marginBottom: 16 }}>sheet-pan chicken</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Sheet-pan chicken bowl</div>
              <Badge variant="primary">94%</Badge>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 16 }}>Parsed from {url || "instagram.com"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              {[["620","kcal","var(--macro-calories)"],["48g","P","var(--macro-protein)"],["52g","C","var(--macro-carbs)"],["22g","F","var(--macro-fat)"]].map(([v,l,c],i) => (
                <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div className="overline" style={{ marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="overline" style={{ marginBottom: 8 }}>7 ingredients found</div>
              <div style={{ fontSize: 13, color: "var(--fg-secondary)", lineHeight: 1.6 }}>Chicken thighs · Broccoli · Red pepper · Olive oil · Paprika · Garlic · Jasmine rice</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 14, lineHeight: 1.5 }}>
              Results are estimates and should be reviewed before saving.
            </div>
          </>
        )}
      </div>
      {phase === "result" && (
        <div style={{ padding: "12px 20px 28px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Discard</button>
          <button className="btn btn-primary" onClick={onImported}>Save to library</button>
        </div>
      )}
    </div>
  );
}

// ─── Paywall ─────────────────────────────────────────────────
function Paywall({ onClose }) {
  const [tier, setTier] = useState("base");
  return (
    <div className="fullscreen">
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #4c6ce0 0%, #e04888 100%)", padding: "54px 20px 32px", color: "#fff", position: "relative" }}>
        <button style={{ position: "absolute", top: 54, right: 16, width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.2)", border: 0, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 16 }}>
          <Icon name="sparkles" size={11} /> SUPPR BASE
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>The full meal planning loop</div>
        <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>Plans that hit your macros, one-tap shopping lists, cook mode with timers.</div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {/* Features */}
        {[
          { icon: "calendar-days", t: "Meal plans matched to your macros", s: "A week of meals tailored to your targets. Regenerate any day." },
          { icon: "shopping-cart", t: "Shopping list from your plan", s: "Aisle-sorted, quantities combined across recipes." },
          { icon: "chef-hat", t: "Cook mode with timers", s: "Step-by-step with inline timers and per-step ingredients." },
          { icon: "link", t: "Import from any source", s: "Instagram, TikTok, blogs. 7-second parse, USDA-verified." },
          { icon: "infinity", t: "Unlimited saved recipes", s: "Free tier caps at 10. Base is uncapped." },
        ].map(f => (
          <div key={f.t} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in oklab, var(--primary) 15%, transparent)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={f.icon} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{f.t}</div>
              <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2, lineHeight: 1.5 }}>{f.s}</div>
            </div>
          </div>
        ))}

        {/* Tier picker */}
        <div style={{ marginTop: 24, display: "grid", gap: 10 }}>
          {[
            { id: "base", name: "Base", price: "$5", per: "/month", desc: "The full meal planning loop", best: true },
            { id: "pro", name: "Pro", price: "$12", per: "/month", desc: "AI photo, voice log, adaptive TDEE" },
          ].map(t => (
            <button key={t.id} onClick={() => setTier(t.id)} style={{
              background: "var(--card)",
              border: tier === t.id ? "2px solid var(--primary)" : "1px solid var(--border)",
              borderRadius: 14, padding: 16, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
            }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                  {t.best && <Badge variant="primary">Most popular</Badge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-secondary)" }}>{t.desc}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{t.price}</div>
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{t.per}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 16, lineHeight: 1.5 }}>
          Cancel anytime. No countdown timers, no weekly billing tricks. Annual saves 20%.
        </div>
      </div>

      <div style={{ padding: "12px 20px 28px", borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-primary btn-lg">Continue with {tier === "base" ? "Base" : "Pro"} · {tier === "base" ? "$5" : "$12"}/mo</button>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 4 }} onClick={onClose}>Continue for free</button>
      </div>
    </div>
  );
}

// ─── Settings / simple list page ────────────────────────────
function SimplePage({ title, onClose, children }) {
  return (
    <div className="fullscreen slide-right">
      <div className="fullscreen-head">
        <button className="back" onClick={onClose}><Icon name="chevron-left" size={20} /></button>
        <h1>{title}</h1>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20, paddingBottom: 40 }}>{children}</div>
    </div>
  );
}

function SettingsPage({ onClose, persona }) {
  return (
    <SimplePage title="Settings" onClose={onClose}>
      <div className="card" style={{ padding: 0 }}>
        {[
          { icon: "user", label: "Account", sub: "grace@suppr.app" },
          { icon: "target", label: "Targets", sub: `${persona.targetKcal.toLocaleString()} kcal · goal: ${persona.name.toLowerCase()}` },
          { icon: "heart-pulse", label: "Apple Health", sub: "Connected · 6 data types" },
          { icon: "bell", label: "Notifications", sub: "Meal reminders on" },
          { icon: "moon", label: "Appearance", sub: "System" },
          { icon: "shield", label: "Privacy", sub: "Export or delete your data" },
          { icon: "circle-help", label: "Help & support" },
          { icon: "log-out", label: "Sign out" },
        ].map((it, i) => (
          <button key={it.label} className="meal-row">
            <span className="icon-box" style={{ background: "var(--muted)", color: "var(--fg-secondary)" }}>
              <Icon name={it.icon} size={16} />
            </span>
            <span>
              <span className="t1" style={{ display: "block" }}>{it.label}</span>
              {it.sub && <span className="t2" style={{ display: "block" }}>{it.sub}</span>}
            </span>
            <Icon name="chevron-right" size={16} color="var(--fg-tertiary)" />
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--fg-tertiary)", marginTop: 24, lineHeight: 1.6 }}>
        Suppr v2.4.1 · Build 2026.4<br/>
        Suppr is a personal tracking tool, not a medical device.
      </div>
    </SimplePage>
  );
}

// ─── Household settings — shared meals config ────────────────
function HouseholdSettings({ onClose, persona }) {
  const [sharing, setSharing] = useState(persona.sharing || { preset: "custom", grid: {} });
  const app = useApp();
  const days = [
    { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
    { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
  ];
  const slots = [
    { id: "breakfast", label: "B", full: "Breakfast", icon: "coffee" },
    { id: "lunch",     label: "L", full: "Lunch",     icon: "utensils" },
    { id: "dinner",    label: "D", full: "Dinner",    icon: "moon" },
    { id: "snack",     label: "S", full: "Snack",     icon: "apple" },
  ];

  const buildGrid = (preset) => {
    const all = persona.members.map(m => m.id);
    const g = {};
    days.forEach(d => {
      g[d.id] = {};
      slots.forEach(s => {
        if (preset === "all") g[d.id][s.id] = [...all];
        else if (preset === "none") g[d.id][s.id] = "solo";
        else if (preset === "dinners") g[d.id][s.id] = s.id === "dinner" ? [...all] : "solo";
        else if (preset === "weekends") g[d.id][s.id] = (d.id === "sat" || d.id === "sun") ? [...all] : (s.id === "dinner" ? [...all] : "solo");
      });
    });
    return g;
  };
  const setPreset = (p) => {
    if (p === "custom") { setSharing(s => ({ ...s, preset: "custom" })); return; }
    setSharing({ preset: p, grid: buildGrid(p) });
  };

  // Cycle a cell: solo → all → back to solo. For finer control, long-press opens member picker.
  const [editing, setEditing] = useState(null); // {day, slot}
  const cellMembers = (day, slot) => {
    const v = sharing.grid?.[day]?.[slot];
    if (v === "solo" || !v) return [];
    return v;
  };
  const cycle = (day, slot) => {
    const cur = cellMembers(day, slot);
    const all = persona.members.map(m => m.id);
    const isAll = cur.length === all.length;
    const next = isAll ? "solo" : [...all];
    setSharing(s => ({ preset: "custom", grid: { ...s.grid, [day]: { ...s.grid[day], [slot]: next } } }));
  };
  const toggleMember = (day, slot, memberId) => {
    const cur = cellMembers(day, slot);
    const has = cur.includes(memberId);
    const next = has ? cur.filter(x => x !== memberId) : [...cur, memberId];
    setSharing(s => ({ preset: "custom", grid: { ...s.grid, [day]: { ...s.grid[day], [slot]: next.length ? next : "solo" } } }));
  };

  const presets = [
    { id: "all",      label: "All meals",     sub: "Everyone eats together" },
    { id: "dinners",  label: "Dinners only",  sub: "Solo other meals" },
    { id: "weekends", label: "Dinners + weekends", sub: "Casual weekdays" },
    { id: "none",     label: "Individual",    sub: "Everyone separate" },
    { id: "custom",   label: "Custom",        sub: "Pick per slot below" },
  ];

  // Summary counts
  const totalCells = 7 * 4;
  const sharedCount = days.reduce((n, d) => n + slots.reduce((m, s) => m + (cellMembers(d.id, s.id).length > 1 ? 1 : 0), 0), 0);

  return (
    <SimplePage title="Household" onClose={onClose}>
      {/* Members */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="overline">Members</div>
          <button style={{ background: "transparent", border: 0, color: "var(--primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="plus" size={12} /> Add
          </button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {persona.members.map((m, i) => (
            <div key={m.id} className="meal-row" style={{ borderBottom: i < persona.members.length - 1 ? "1px solid var(--border)" : 0 }}>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: m.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{m.initials}</span>
              <span>
                <span className="t1" style={{ display: "block" }}>{m.name} <span style={{ fontWeight: 400, color: "var(--fg-tertiary)", fontSize: 11 }}>· {m.role}</span></span>
                <span className="t2" style={{ display: "block" }}>{m.kcal} kcal · {m.protein}g protein · {m.diet}</span>
              </span>
              <Icon name="chevron-right" size={16} color="var(--fg-tertiary)" />
            </div>
          ))}
        </div>
      </div>

      {/* Sharing presets */}
      <div style={{ marginBottom: 14 }}>
        <div className="overline" style={{ marginBottom: 10 }}>Which meals are shared?</div>
        <div className="card" style={{ padding: 0 }}>
          {presets.map((p, i) => (
            <button key={p.id} onClick={() => setPreset(p.id)} className="meal-row" style={{ borderBottom: i < presets.length - 1 ? "1px solid var(--border)" : 0, background: sharing.preset === p.id ? "color-mix(in oklab, var(--primary) 6%, transparent)" : "transparent" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sharing.preset === p.id ? "var(--primary)" : "var(--border)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                {sharing.preset === p.id && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)" }} />}
              </span>
              <span>
                <span className="t1" style={{ display: "block" }}>{p.label}</span>
                <span className="t2" style={{ display: "block" }}>{p.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Weekly grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div className="overline">Weekly plan</div>
          <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{sharedCount} of {totalCells} shared</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
            <div />
            {days.map(d => <div key={d.id} style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-tertiary)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.label}</div>)}
          </div>
          {slots.map(s => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
              <div style={{ display: "grid", placeItems: "center", color: "var(--fg-secondary)" }} title={s.full}>
                <Icon name={s.icon} size={14} />
              </div>
              {days.map(d => {
                const mem = cellMembers(d.id, s.id);
                const count = mem.length;
                const all = persona.members.length;
                const isAll = count === all;
                const isSome = count > 1 && count < all;
                const bg = isAll ? "color-mix(in oklab, var(--primary) 22%, transparent)"
                         : isSome ? "color-mix(in oklab, var(--primary) 10%, transparent)"
                         : "var(--muted)";
                const fg = isAll ? "var(--primary)" : isSome ? "var(--primary)" : "var(--fg-tertiary)";
                const border = isAll || isSome ? "1px solid color-mix(in oklab, var(--primary) 30%, transparent)" : "1px solid transparent";
                return (
                  <button key={d.id}
                    onClick={() => cycle(d.id, s.id)}
                    onContextMenu={(e) => { e.preventDefault(); setEditing({ day: d.id, slot: s.id }); }}
                    style={{
                      height: 34, borderRadius: 8, background: bg, border, color: fg,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      display: "grid", placeItems: "center",
                    }}
                    title={count === 0 ? "Solo" : count === all ? "Everyone" : `${count} people — long-press to customize`}
                  >
                    {count === 0 ? "·" : isAll ? "All" : count}
                  </button>
                );
              })}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 12, lineHeight: 1.5 }}>
            Tap a cell to toggle between solo and everyone. Long-press (or right-click) to pick specific members.
          </div>
        </div>

        {/* Per-member legend */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {persona.members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", background: "var(--muted)", borderRadius: 999 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: m.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 9 }}>{m.initials}</span>
              <span style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 600 }}>{m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 16, marginTop: 24, background: "linear-gradient(to top, var(--bg) 60%, transparent)" }}>
        <button onClick={() => { app.showToast && app.showToast("Household settings saved", "users"); onClose(); }}
          style={{ width: "100%", padding: "14px", background: "var(--primary)", color: "var(--on-primary)", border: 0, borderRadius: 14, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Save changes
        </button>
      </div>

      {/* Member picker modal */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", width: "100%", maxWidth: 420, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", border: "1px solid var(--border)" }}>
            <div style={{ width: 40, height: 4, background: "var(--fg-tertiary)", borderRadius: 2, margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Who's eating?</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 16 }}>
              {slots.find(s => s.id === editing.slot)?.full} · {days.find(d => d.id === editing.day)?.label}
            </div>
            {persona.members.map(m => {
              const on = cellMembers(editing.day, editing.slot).includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMember(editing.day, editing.slot, m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 4px", background: "transparent", border: 0, borderBottom: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 16, background: m.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11 }}>{m.initials}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: "block" }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{m.kcal} kcal · {m.diet}</span>
                  </span>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary)" : "transparent", display: "grid", placeItems: "center" }}>
                    {on && <Icon name="check" size={12} color="var(--on-primary)" />}
                  </span>
                </button>
              );
            })}
            <button onClick={() => setEditing(null)} style={{ width: "100%", marginTop: 16, padding: "12px", background: "var(--muted)", color: "var(--fg)", border: 0, borderRadius: 12, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Done
            </button>
          </div>
        </div>
      )}
    </SimplePage>
  );
}

function LibraryPage({ onClose, onOpenRecipe }) {
  const app = useApp();
  const [filter, setFilter] = useState("all");
  const filters = ["all", "saved", "high-protein", "quick", "vegetarian"];
  const filtered = recipes.filter(r => {
    if (filter === "all") return true;
    if (filter === "saved") return app.bookmarks.has(r.id);
    return (r.tags || []).includes(filter);
  });
  return (
    <SimplePage title="Library" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 12 }}>{recipes.length} recipes · {app.bookmarks.size} saved</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)",
            background: filter === f ? "var(--primary)" : "transparent",
            color: filter === f ? "var(--primary-foreground)" : "var(--fg-secondary)",
            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? "All" : f}</button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map(r => (
          <button key={r.id} className="card" onClick={() => onOpenRecipe(r)} style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "96px 1fr auto", gap: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)", alignItems: "center" }}>
            <div className="photo-ph" style={{ aspectRatio: "1/1", width: 96, borderRadius: 0, border: 0 }}>{r.title.toLowerCase().split(" ")[0]}</div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 3 }}>{r.source}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11, color: "var(--fg-secondary)", fontVariantNumeric: "tabular-nums" }}>
                <span>{r.kcal} kcal</span><span>{r.p} P</span><span>{r.time} min</span>
              </div>
            </div>
            {app.bookmarks.has(r.id) && <span style={{ paddingRight: 14, color: "var(--primary)" }}><Icon name="bookmark-check" size={16} /></span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-tertiary)", fontSize: 13 }}>No recipes match this filter.</div>
        )}
      </div>
    </SimplePage>
  );
}

function ShoppingPage({ onClose }) {
  const app = useApp();
  const sections = [
    { name: "Produce", items: ["Broccoli (2 heads)", "Red pepper (3)", "Spinach (200g)", "Avocado (2)", "Banana (6)"] },
    { name: "Protein", items: ["Chicken thighs (800g)", "Salmon fillet (400g)", "Greek yogurt 2% (1kg)"] },
    { name: "Pantry", items: ["Jasmine rice (500g)", "Lentils (250g)", "Olive oil", "Paprika"] },
  ];
  return (
    <SimplePage title="Shopping list" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 14 }}>12 items · from this week's plan</div>
      {sections.map(s => (
        <div key={s.name} style={{ marginBottom: 20 }}>
          <div className="overline" style={{ marginBottom: 8 }}>{s.name}</div>
          <div className="card" style={{ padding: 0 }}>
            {s.items.map((it) => {
              const key = s.name + it;
              const on = app.shopping[key];
              return (
                <button key={key} onClick={() => app.toggleShop(key)} className="meal-row" style={{ gridTemplateColumns: "28px 1fr" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, border: "1.5px solid " + (on ? "var(--primary)" : "var(--border)"), background: on ? "var(--primary)" : "transparent", display: "grid", placeItems: "center" }}>
                    {on && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: 13, color: on ? "var(--fg-tertiary)" : "var(--fg)", textDecoration: on ? "line-through" : "none" }}>{it}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </SimplePage>
  );
}

function TargetsPage({ onClose, persona }) {
  return (
    <SimplePage title="Targets" onClose={onClose}>
      <div className="card">
        <div className="overline" style={{ marginBottom: 6 }}>Daily calorie target</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{persona.targetKcal.toLocaleString()}</div>
          <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>kcal</div>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 6, lineHeight: 1.5 }}>Estimated TDEE based on Mifflin-St Jeor · moderate activity · 500 kcal deficit</div>
      </div>
      <div className="section-h"><h3>Macros</h3></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MacroTile name="Protein" value={persona.targetProtein} target={persona.targetProtein} unit="g" color="var(--macro-protein)" icon="beef" />
        <MacroTile name="Carbs" value={persona.targetCarbs} target={persona.targetCarbs} unit="g" color="var(--macro-carbs)" icon="wheat" />
        <MacroTile name="Fat" value={persona.targetFat} target={persona.targetFat} unit="g" color="var(--macro-fat)" icon="droplets" />
        <MacroTile name="Fiber" value={persona.targetFiber} target={persona.targetFiber} unit="g" color="var(--macro-fiber)" icon="leaf" />
      </div>
      <div className="section-h"><h3>Goal</h3></div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Reach {persona.goalWeight} kg</div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Currently {persona.weight} kg · could reach by ≈ 14 July</div>
          </div>
          <Badge variant="success">On track</Badge>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 14, lineHeight: 1.5 }}>
        Projections assume a 14-day moving average. Targets adapt weekly based on logged intake.
      </div>
    </SimplePage>
  );
}

function HealthPage({ onClose, persona }) {
  const [sync, setSync] = useState({ "Active energy": true, "Resting energy": true, "Steps": true, "Body weight": true, "Workouts": true, "Sleep": false });
  return (
    <SimplePage title="Apple Health" onClose={onClose}>
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: "color-mix(in oklab, var(--macro-fat) 18%, transparent)", color: "var(--macro-fat)", display: "grid", placeItems: "center" }}>
          <Icon name="heart-pulse" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Connected</div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>Last synced 4 minutes ago</div>
        </div>
        <Badge variant="success" icon="check">Active</Badge>
      </div>
      <div className="section-h"><h3>Syncing</h3></div>
      <div className="card" style={{ padding: 0 }}>
        {[
          { label: "Active energy", icon: "flame" },
          { label: "Resting energy", icon: "heart-pulse" },
          { label: "Steps", icon: "footprints" },
          { label: "Body weight", icon: "scale" },
          { label: "Workouts", icon: "dumbbell" },
          { label: "Sleep", icon: "moon" },
        ].map((r, i) => {
          const on = sync[r.label];
          return (
            <button key={r.label} onClick={() => setSync(s => ({ ...s, [r.label]: !s[r.label] }))} style={{ display: "grid", gridTemplateColumns: "36px 1fr 40px", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: i === 0 ? 0 : "1px solid var(--border)", background: "transparent", border: 0, borderLeft: 0, borderRight: 0, width: "100%", cursor: "pointer", color: "var(--fg)", fontFamily: "inherit" }}>
              <span className="icon-box" style={{ width: 36, height: 36, background: "var(--muted)", color: "var(--fg-secondary)" }}>
                <Icon name={r.icon} size={16} />
              </span>
              <span style={{ fontSize: 13, textAlign: "left" }}>{r.label}</span>
              <span style={{ width: 36, height: 22, borderRadius: 11, background: on ? "var(--primary)" : "var(--muted)", position: "relative", transition: "background 150ms var(--ease)" }}>
                <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 150ms var(--ease)" }} />
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 14, lineHeight: 1.5 }}>
        Activity bonus may be added to your calorie target if your total burn exceeds the TDEE estimate. Weight entries from the Health app are rounded to the nearest 0.1 kg.
      </div>
    </SimplePage>
  );
}

Object.assign(window, { LogMealSheet, MealDetailSheet, RecipeDetail, CookMode, ImportFlow, Paywall, SettingsPage, LibraryPage, ShoppingPage, TargetsPage, HealthPage });
