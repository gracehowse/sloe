// Step content — the 12 onboarding steps, each a small component.
// Kept surface-agnostic: no frame chrome, just the card / stack that goes into
// the slot the mobile or web shell provides.

// ─────────────────────────────────────────────────────────────
// Step container — shared padding + header structure
// ─────────────────────────────────────────────────────────────
function StepHeader({ overline, title, subtitle, compact = false }) {
  return (
    <div style={{ marginBottom: compact ? 20 : 28 }}>
      {overline && (
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--primary)',
          marginBottom: 10,
        }}>{overline}</div>
      )}
      <h1 style={{
        fontSize: compact ? 24 : 28,
        fontWeight: 700, letterSpacing: '-0.025em',
        color: 'var(--text)', margin: 0, lineHeight: 1.15,
        textWrap: 'balance',
      }}>{title}</h1>
      {subtitle && (
        <p style={{
          fontSize: 14, color: 'var(--text-sec)', margin: '8px 0 0',
          lineHeight: 1.55, textWrap: 'pretty',
        }}>{subtitle}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 01 — Welcome
// ─────────────────────────────────────────────────────────────
function WelcomeStep({ compact = false }) {
  const { go } = useOnboarding();
  // The one place we use the brand gradient.
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between',
    }}>
      <div style={{
        position: 'relative', flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: compact ? '56px 24px 32px' : '64px 32px 32px',
        overflow: 'hidden',
      }}>
        {/* Gradient wash backdrop */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at top, rgba(108,140,255,0.28) 0%, rgba(224,72,136,0.12) 45%, transparent 80%)',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 80% 15%, rgba(224,72,136,0.22), transparent 55%)',
          pointerEvents: 'none',
        }}/>

        {/* Product hint — floating macro tile preview */}
        <div style={{ position: 'relative', marginBottom: compact ? 32 : 44 }}>
          <FloatingPreview compact={compact}/>
        </div>

        <div style={{ position: 'relative' }}>
          <SupprMark size={44}/>
          <h1 style={{
            fontSize: compact ? 36 : 42,
            fontWeight: 800, letterSpacing: '-0.035em',
            color: 'var(--text-strong)', margin: '24px 0 12px',
            lineHeight: 1.02,
            textWrap: 'balance',
          }}>
            Eat well,<br/>without<br/>overthinking it.
          </h1>
          <p style={{
            fontSize: compact ? 15 : 16, color: 'var(--text-sec)',
            margin: '0 0 8px', lineHeight: 1.5, maxWidth: 360,
          }}>
            Import recipes from the sites you already use. We'll break down the
            macros and help you hit targets that fit your life.
          </p>
        </div>
      </div>

      <div style={{ padding: compact ? '0 24px 28px' : '0 32px 32px', position: 'relative' }}>
        <Button full size="xl" onClick={() => go(1)}>Get started</Button>
        <div style={{
          textAlign: 'center', marginTop: 14,
          fontSize: 13, color: 'var(--text-sec)',
        }}>
          Have an account? <span style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Sign in</span>
        </div>
      </div>
    </div>
  );
}

// A little visual — mimics a recipe-import moment. Kept abstract to avoid slop.
function FloatingPreview({ compact }) {
  return (
    <div style={{
      position: 'relative',
      height: compact ? 140 : 160,
    }}>
      {/* Card 1 — "imported from" */}
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '35%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '12px 14px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        transform: 'rotate(-2.4deg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="link" size={13} color="var(--primary)"/>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>Imported</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Sheet-pan chicken
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>
          from instagram.com
        </div>
      </div>

      {/* Card 2 — macro ring snippet */}
      <div style={{
        position: 'absolute', top: 28, right: '4%', width: compact ? 170 : 190,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 14,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        transform: 'rotate(2deg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="5" fill="none"/>
            <circle cx="24" cy="24" r="20" stroke="var(--success)" strokeWidth="5" fill="none"
                    strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="34"/>
          </svg>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Today</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>1,420</div>
            <div style={{ fontSize: 10, color: 'var(--text-sec)' }}>of 1,800 kcal</div>
          </div>
        </div>
      </div>

      {/* Card 3 — confidence badge */}
      <div style={{
        position: 'absolute', bottom: 0, left: '20%',
        background: 'rgba(76,208,128,0.14)',
        border: '1px solid rgba(76,208,128,0.35)',
        borderRadius: 9999,
        padding: '6px 11px',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', gap: 6,
        transform: 'rotate(-1deg)',
      }}>
        <Icon name="check" size={12} color="var(--success)" strokeWidth={2.5}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', letterSpacing: '-0.005em' }}>
          Matched to USDA · 94%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 02 — Signup
// ─────────────────────────────────────────────────────────────
function SignupStep() {
  const { state, set, go } = useOnboarding();
  return (
    <StepBody>
      <StepHeader
        overline="Step 02 of 13"
        title="Create your account"
        subtitle="One account, same data on your phone and on the web."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        <Button full size="lg" variant="apple"
          onClick={() => { set({ authMethod: 'apple' }); go(1); }}
          icon={<AppleLogo/>}
        >Sign in with Apple</Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 18px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TextField
          label="First name"
          value={state.name}
          onChange={v => set({ name: v })}
          placeholder="Grace"
          autoFocus
        />
        <TextField
          label="Email"
          value={state.email}
          onChange={v => set({ email: v })}
          placeholder="you@example.com"
          type="email"
        />
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
        By continuing you agree to Suppr's <span style={{ color: 'var(--text-sec)', textDecoration: 'underline' }}>Terms</span> and <span style={{ color: 'var(--text-sec)', textDecoration: 'underline' }}>Privacy Policy</span>.
      </p>
    </StepBody>
  );
}

function AppleLogo() {
  return (
    <svg width="15" height="17" viewBox="0 0 814 1000" fill="#fff" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 03 — Goal
// ─────────────────────────────────────────────────────────────
function GoalStep() {
  const { state, set } = useOnboarding();
  const goals = [
    { k: 'lose',     t: 'Lose fat',       s: 'Gradual deficit, protein-first',  i: 'trending-down' },
    { k: 'maintain', t: 'Maintain',       s: 'Keep things steady',               i: 'equal' },
    { k: 'gain',     t: 'Gain muscle',    s: 'Small surplus, high protein',      i: 'trending-up' },
    { k: 'recomp',   t: 'Recomposition',  s: 'Slight cut, heavy training',       i: 'shuffle' },
  ];
  return (
    <StepBody>
      <StepHeader
        overline="Step 03 of 13"
        title="What's your goal?"
        subtitle="We'll tailor your calorie and macro targets to match. You can change this anytime."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {goals.map(g => (
          <OptionCard
            key={g.k}
            selected={state.goal === g.k}
            onClick={() => set({ goal: g.k })}
            icon={<Icon name={g.i} size={20}/>}
            title={g.t}
            subtitle={g.s}
          />
        ))}
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 04 — Pace (only for lose / gain / recomp; auto-skipped for maintain)
// ─────────────────────────────────────────────────────────────
function PaceStep() {
  const { state, set, targets } = useOnboarding();
  const goal = state.goal || 'lose';

  // Pace ranges & presets per goal
  const ranges = {
    lose:    { min: 0.1,  max: 0.9,  step: 0.05, default: 0.4,  color: 'var(--macro-fat)' },
    gain:    { min: 0.1,  max: 0.4,  step: 0.025, default: 0.25, color: 'var(--macro-protein)' },
    recomp:  { min: 0.05, max: 0.3,  step: 0.025, default: 0.15, color: 'var(--macro-carbs)' },
    maintain:{ min: 0,    max: 0,    step: 0,    default: 0,     color: 'var(--success)' },
  };
  const r = ranges[goal] || ranges.lose;
  const pace = state.paceKgPerWeek ?? r.default;

  const presets = goal === 'lose'
    ? [{ k: 0.2, t: 'Gentle',   d: '~0.2 kg / week' },
       { k: 0.4, t: 'Steady',   d: '~0.4 kg / week' },
       { k: 0.7, t: 'Ambitious',d: '~0.7 kg / week' }]
    : goal === 'gain'
    ? [{ k: 0.15, t: 'Lean',     d: '~0.15 kg / week' },
       { k: 0.25, t: 'Standard', d: '~0.25 kg / week' },
       { k: 0.35, t: 'Bulk',     d: '~0.35 kg / week' }]
    : [{ k: 0.1,  t: 'Subtle',    d: '~0.1 kg / week' },
       { k: 0.15, t: 'Standard',  d: '~0.15 kg / week' },
       { k: 0.25, t: 'Aggressive',d: '~0.25 kg / week' }];

  const kcalDaily = Math.round((pace * 7700) / 7);
  const sign = goal === 'lose' || goal === 'recomp' ? '−' : '+';

  // Real projected target (we have body stats now)
  const projectedTarget = targets ? targets.target : null;
  const tdee = targets ? targets.tdee : null;

  // ── Medical safety flags ────────────────────────────────────
  // Per NIH/NHS/Mayo: generally-accepted floors for unsupervised dieting
  const safeFloor = state.sex === 'female' ? 1200 : 1500;
  const weeklyLossPct = state.weightKg ? (pace / state.weightKg) * 100 : 0;

  let warning = null;
  if ((goal === 'lose' || goal === 'recomp') && projectedTarget != null) {
    if (projectedTarget < safeFloor) {
      warning = {
        level: 'danger',
        title: `Below the ${safeFloor.toLocaleString()} kcal safety floor`,
        body: `This pace would put your daily target at ~${projectedTarget.toLocaleString()} kcal. Most health authorities recommend no less than ${safeFloor.toLocaleString()} kcal/day without medical supervision. Please slow the pace, or check with your doctor first.`,
      };
    } else if (weeklyLossPct > 1) {
      warning = {
        level: 'warn',
        title: 'Faster than 1% of your bodyweight per week',
        body: `At ~${pace.toFixed(2)} kg/week that's ~${weeklyLossPct.toFixed(1)}% of your bodyweight. Rapid loss can cost muscle and is harder to sustain — consider a gentler pace, or check in with a clinician.`,
      };
    } else if (projectedTarget < safeFloor + 200) {
      warning = {
        level: 'info',
        title: 'Close to the minimum recommended intake',
        body: `Your target is approaching the general ${safeFloor.toLocaleString()} kcal/day floor for unsupervised dieting. This is fine for most healthy adults, but if you have any medical conditions please consult your doctor.`,
      };
    }
  }

  const warningColors = {
    danger: { bg: 'rgba(217,69,69,0.12)', border: 'rgba(217,69,69,0.45)', accent: '#d94545', icon: 'alert' },
    warn:   { bg: 'rgba(232,148,45,0.12)', border: 'rgba(232,148,45,0.45)', accent: '#e8942d', icon: 'alert' },
    info:   { bg: 'rgba(108,140,255,0.10)', border: 'rgba(108,140,255,0.35)', accent: 'var(--primary)', icon: 'info' },
  };

  return (
    <StepBody>
      <StepHeader
        overline="Step 09 of 13"
        title={goal === 'gain' ? 'How fast should we gain?' : goal === 'recomp' ? 'How fast should we recomp?' : 'How fast should we lose?'}
        subtitle="Slower is easier to sustain; faster asks more of you. You can change this anytime."
        compact
      />

      {/* Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {presets.map(p => {
          const active = Math.abs(pace - p.k) < r.step * 0.6;
          return (
            <button
              key={p.k}
              onClick={() => set({ paceKgPerWeek: p.k })}
              style={{
                padding: '10px 8px', borderRadius: 12,
                background: active ? r.color + '22' : 'var(--bg-input)',
                border: `1.5px solid ${active ? r.color : 'var(--border)'}`,
                color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{p.t}</span>
              <span style={{ fontSize: 10, color: 'var(--text-sec)', fontVariantNumeric: 'tabular-nums' }}>{p.d}</span>
            </button>
          );
        })}
      </div>

      {/* Fine-grained slider */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 18,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Rate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{pace.toFixed(pace < 0.1 ? 3 : 2)}</span>
          <span style={{ fontSize: 14, color: 'var(--text-sec)', fontWeight: 600 }}>kg / week</span>
        </div>
        <input
          type="range"
          min={r.min} max={r.max} step={r.step}
          value={pace}
          onChange={e => set({ paceKgPerWeek: parseFloat(e.target.value) })}
          style={{
            width: '100%', accentColor: r.color, height: 6,
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 6,
          fontSize: 10, color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{r.min} kg / wk</span>
          <span>{r.max} kg / wk</span>
        </div>
      </div>

      {/* Real projected target — now that we have body stats */}
      {projectedTarget != null && (
        <div style={{
          marginTop: 14, padding: '14px 16px',
          background: r.color + '14', border: '1px solid ' + r.color + '40',
          borderRadius: 14,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>Daily target</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {projectedTarget.toLocaleString()}
              <span style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 500, marginLeft: 4 }}>kcal</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>vs. your TDEE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: r.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {sign}{Math.abs(kcalDaily).toLocaleString()}
              <span style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 500, marginLeft: 4 }}>kcal / day</span>
            </div>
          </div>
        </div>
      )}

      {/* Medical safety flag */}
      {warning && (
        <div style={{
          marginTop: 12, padding: '12px 14px',
          background: warningColors[warning.level].bg,
          border: '1px solid ' + warningColors[warning.level].border,
          borderRadius: 12,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: warningColors[warning.level].accent + '28',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 1,
          }}>
            <Icon name={warningColors[warning.level].icon} size={15}
              color={warningColors[warning.level].accent} strokeWidth={2.5}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text)',
              letterSpacing: '-0.01em', marginBottom: 3,
            }}>{warning.title}</div>
            <div style={{
              fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5,
            }}>{warning.body}</div>
          </div>
        </div>
      )}

      <MethodologyNote>
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors reference
        NIH/NHS guidance. Suppr is not a substitute for medical advice —
        consult your doctor before any significant dietary change, especially
        if you're pregnant, under 18, or managing a medical condition.
      </MethodologyNote>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 04 — Sex
// ─────────────────────────────────────────────────────────────
function SexStep() {
  const { state, set } = useOnboarding();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const opts = [
    { k: 'female', t: 'Female' },
    { k: 'male',   t: 'Male' },
  ];
  return (
    <StepBody>
      <StepHeader
        overline="Step 04 of 13"
        title="Sex"
        subtitle="Please select which sex we should use to calculate your calorie needs."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {opts.map(o => (
          <OptionCard
            key={o.k}
            selected={state.sex === o.k}
            onClick={() => set({ sex: o.k })}
            title={o.t}
            compact
          />
        ))}
      </div>

      <button
        onClick={() => setHelpOpen(v => !v)}
        style={{
          background: 'transparent', border: 0, padding: '14px 0 0',
          color: 'var(--text-sec)', fontFamily: 'inherit',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          textAlign: 'left',
        }}
      >
        <Icon name="info" size={14} color="var(--primary)"/>
        <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--radio-border)', textUnderlineOffset: 3 }}>
          Which one should I choose?
        </span>
      </button>

      {helpOpen && (
        <div style={{
          marginTop: 12,
          padding: 14,
          background: 'var(--primary-tint-bg)',
          border: '1px solid var(--primary-tint-border)',
          borderRadius: 12,
          fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
          animation: 'sxFade 200ms cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--primary-hover)', marginBottom: 8,
          }}>What Suppr does with this</div>
          <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>
            The Mifflin-St Jeor equation uses different coefficients for male and
            female metabolic rate — the difference is about 166 kcal/day.
          </p>
          <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>
            If you're trans, non-binary, or gender non-conforming: if you haven't
            started gender-affirming hormones, selecting your sex assigned at
            birth will most accurately reflect your metabolic rate. If you've
            been on hormones for more than a few months, your metabolism may be
            closer to your gender identity.
          </p>
          <p style={{ margin: 0, color: 'var(--text-sec)' }}>
            For best results, consult your doctor. You can change this at any
            time — Suppr also re-calibrates from your actual logs.
          </p>
          <style>{`@keyframes sxFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}

      <div style={{
        marginTop: 'auto',
        paddingTop: 20,
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <Icon name="shield" size={12} color="var(--text-muted)"/>
        <span>Stored privately on your device and synced only to your Suppr account. Never shared.</span>
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 05 — Age
// ─────────────────────────────────────────────────────────────
function AgeStep() {
  const { state, set } = useOnboarding();
  return (
    <StepBody>
      <StepHeader
        overline="Step 05 of 13"
        title="How old are you?"
        subtitle="Metabolic rate drops ~1% per decade after 20 — we'll factor that in."
      />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
        <NumberStepper
          value={state.age}
          onChange={v => set({ age: v })}
          min={14} max={100}
          suffix="years"
          big
        />
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 06 — Height
// ─────────────────────────────────────────────────────────────
function HeightStep() {
  const { state, set } = useOnboarding();
  const metric = state.unitSystem === 'metric';
  return (
    <StepBody>
      <StepHeader
        overline="Step 06 of 13"
        title="How tall are you?"
        subtitle={null}
        compact
      />
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <Segmented
          value={state.unitSystem}
          onChange={v => set({ unitSystem: v })}
          options={[{ value: 'metric', label: 'cm' }, { value: 'imperial', label: 'ft / in' }]}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {metric ? (
          <RulerSlider
            value={state.heightCm}
            onChange={v => set({ heightCm: v })}
            min={140} max={210} step={1} decimals={0}
            unit="cm" width={320}
          />
        ) : (
          <RulerSlider
            value={Math.round(state.heightCm / 2.54)}
            onChange={totalIn => set({ heightCm: Math.round(totalIn * 2.54) })}
            min={48} max={84} step={1} decimals={0}
            width={320}
            format={v => formatImperialHeightInches(v)}
            parseInput={s => {
              // accept "5'10\"" / "5 10" / "5ft 10in" / "70"
              const m = String(s).match(/^\s*(\d+)\s*(?:['′ft]|[\s])\s*(\d+)?/i);
              if (m) {
                const ft = parseInt(m[1], 10);
                const inch = m[2] ? parseInt(m[2], 10) : 0;
                return ft * 12 + inch;
              }
              return parseFloat(s);
            }}
          />
        )}
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 07 — Weight
// ─────────────────────────────────────────────────────────────
function WeightStep() {
  const { state, set } = useOnboarding();
  const metric = state.unitSystem === 'metric';
  return (
    <StepBody>
      <StepHeader
        overline="Step 07 of 13"
        title="And your weight?"
        subtitle="We'll store this privately. You can log it whenever — no daily prompts."
        compact
      />
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <Segmented
          value={state.unitSystem}
          onChange={v => set({ unitSystem: v })}
          options={[{ value: 'metric', label: 'kg' }, { value: 'imperial', label: 'lb' }]}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {metric ? (
          <RulerSlider
            value={state.weightKg}
            onChange={v => set({ weightKg: v })}
            min={40} max={150} step={0.5} decimals={1}
            unit="kg" width={320}
          />
        ) : (
          <RulerSlider
            value={+(state.weightKg * 2.2046).toFixed(1)}
            onChange={v => set({ weightKg: +(v / 2.2046).toFixed(2) })}
            min={90} max={330} step={1} decimals={0}
            unit="lb" width={320}
          />
        )}
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 08 — Activity
// ─────────────────────────────────────────────────────────────
function ActivityStep() {
  const { state, set } = useOnboarding();
  const opts = [
    { k: 'sedentary', t: 'Sedentary',         s: 'Mostly sitting, little walking', i: 'armchair' },
    { k: 'light',     t: 'Lightly active',    s: '1–3 workouts or active days / wk', i: 'footprints' },
    { k: 'moderate',  t: 'Moderately active', s: '3–5 sessions + daily movement',  i: 'activity' },
    { k: 'active',    t: 'Very active',       s: '6–7 sessions, physical job',     i: 'dumbbell' },
    { k: 'athlete',   t: 'Athlete',           s: 'Twice-daily training, competitive', i: 'flame' },
  ];
  return (
    <StepBody>
      <StepHeader
        overline="Step 08 of 13"
        title="How active are you?"
        subtitle="Rough estimate — Suppr will refine this using Apple Health data over ~2 weeks."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map(o => (
          <OptionCard
            key={o.k}
            selected={state.activity === o.k}
            onClick={() => set({ activity: o.k })}
            icon={<Icon name={o.i} size={18}/>}
            title={o.t}
            subtitle={o.s}
            compact
          />
        ))}
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 09 — Diet preferences + allergies (multi)
// ─────────────────────────────────────────────────────────────
function DietStep() {
  const { state, set } = useOnboarding();
  const diets = [
    { k: 'anything',    t: 'Anything goes',   i: 'salad'     },
    { k: 'vegetarian',  t: 'Vegetarian',      i: 'leaf'      },
    { k: 'vegan',       t: 'Vegan',           i: 'wheat'     },
    { k: 'pescatarian', t: 'Pescatarian',     i: 'fish'      },
    { k: 'keto',        t: 'Keto / low-carb', i: 'beef'      },
    { k: 'mediterranean', t: 'Mediterranean', i: 'apple'     },
  ];
  const allergies = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Shellfish', 'Soy'];
  const toggle = (list, k) => list.includes(k) ? list.filter(x => x !== k) : [...list, k];
  return (
    <StepBody>
      <StepHeader
        overline="Step 10 of 13"
        title="Any dietary preferences?"
        subtitle="We'll filter recipes and macro suggestions. Optional — skip if none apply."
      />
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24,
      }}>
        {diets.map(d => {
          const on = state.diet.includes(d.k);
          return (
            <OptionCard
              key={d.k}
              selected={on}
              onClick={() => {
                if (d.k === 'anything') {
                  set({ diet: on ? [] : ['anything'] });
                } else {
                  set({ diet: toggle(state.diet.filter(x => x !== 'anything'), d.k) });
                }
              }}
              icon={<Icon name={d.i} size={17}/>}
              title={d.t}
              compact
              trailing={null}
            />
          );
        })}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10,
      }}>Allergies</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allergies.map(a => (
          <Chip
            key={a}
            selected={state.allergies.includes(a)}
            onClick={() => set({ allergies: toggle(state.allergies, a) })}
          >{a}</Chip>
        ))}
      </div>
    </StepBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 10 — THE REVEAL (aha moment)
// ─────────────────────────────────────────────────────────────
function RevealStep({ compact = false }) {
  const { targets, state } = useOnboarding();
  const t = targets || { target: 1800, bmr: 1500, tdee: 2100, proteinG: 130, carbsG: 180, fatG: 60, fiberG: 25 };

  // Animated count-up on mount
  const [displayCals, setDisplayCals] = React.useState(0);
  const [ringProgress, setRingProgress] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    let raf;
    const tick = now => {
      const p = Math.min(1, (now - start) / dur);
      // easeOutCubic
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayCals(Math.round(t.target * e));
      setRingProgress(e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t.target]);

  const R = 88;
  const C = 2 * Math.PI * R;
  const dash = C * ringProgress;

  const userPace = t.pace ?? (state.paceKgPerWeek ?? 0.4);
  const kcalAdj = Math.abs(t.kcalAdj ?? 0);
  const paceLabel = userPace.toFixed(userPace < 0.1 ? 2 : 2);
  const goalBlurb = {
    lose: `At ~${paceLabel} kg/week, this is ~${kcalAdj.toLocaleString()} kcal below your estimated TDEE of ${t.tdee.toLocaleString()}.`,
    maintain: `This matches your estimated TDEE of ${t.tdee.toLocaleString()} — no deficit, no surplus.`,
    gain: `A ~${kcalAdj.toLocaleString()} kcal surplus on your estimated TDEE of ${t.tdee.toLocaleString()} for ~${paceLabel} kg/week gains. Slow builds hold.`,
    recomp: `A ~${kcalAdj.toLocaleString()} kcal deficit with protein locked at 1.8 g/kg. Body composition changes take time.`,
  }[state.goal || 'maintain'];

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'auto',
      background: 'linear-gradient(180deg, rgba(76,108,224,0.12) 0%, rgba(224,72,136,0.04) 40%, transparent 70%)',
    }}>
      {/* Hero */}
      <div style={{
        padding: compact ? '24px 22px 16px' : '32px 32px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: 'var(--primary)',
          marginBottom: 10,
        }}>Your daily target</div>
        <h1 style={{
          fontSize: compact ? 20 : 22, fontWeight: 700,
          letterSpacing: '-0.02em', margin: '0 0 20px',
          color: 'var(--text)', lineHeight: 1.25,
          textWrap: 'balance',
        }}>
          Here's what your day looks like.
        </h1>

        {/* Ring with animated number */}
        <div style={{
          position: 'relative',
          width: compact ? 210 : 240, height: compact ? 210 : 240,
          margin: '0 auto',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="revealGrad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)"/>
                <stop offset="100%" stopColor="#e04888"/>
              </linearGradient>
            </defs>
            <circle cx="110" cy="110" r={R} stroke="var(--bg-input)" strokeWidth="12" fill="none"/>
            <circle cx="110" cy="110" r={R} stroke="url(#revealGrad)" strokeWidth="12" fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - dash}
              style={{ transition: 'stroke-dashoffset 80ms linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <div style={{
              fontSize: compact ? 52 : 60, fontWeight: 800,
              letterSpacing: '-0.035em', lineHeight: 1,
              color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums',
            }}>{displayCals.toLocaleString()}</div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-sec)',
              marginTop: 6, letterSpacing: '0.02em',
            }}>kcal / day</div>
          </div>
        </div>

        <p style={{
          fontSize: 13, color: 'var(--text-sec)',
          margin: '18px auto 0', lineHeight: 1.55, maxWidth: 340,
          textWrap: 'pretty',
        }}>{goalBlurb}</p>
      </div>

      {/* Macro breakdown */}
      <div style={{ padding: compact ? '8px 22px 28px' : '8px 32px 32px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          marginBottom: 14,
        }}>
          <MacroTile name="Protein" value={t.proteinG} unit="g" color="var(--primary)" pct={Math.round(t.proteinG * 4 / t.target * 100)}/>
          <MacroTile name="Carbs"   value={t.carbsG}   unit="g" color="var(--warning)" pct={Math.round(t.carbsG * 4 / t.target * 100)}/>
          <MacroTile name="Fat"     value={t.fatG}     unit="g" color="var(--magenta)" pct={Math.round(t.fatG * 9 / t.target * 100)}/>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: 14,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>BMR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginTop: 2 }}>{t.bmr.toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text-sec)', fontWeight: 500, marginLeft: 4 }}>kcal</span></div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Est. TDEE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginTop: 2 }}>{t.tdee.toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text-sec)', fontWeight: 500, marginLeft: 4 }}>kcal</span></div>
          </div>
        </div>

        <MethodologyNote>
          Values are estimates based on the Mifflin-St Jeor equation. Suppr will
          re-calibrate your TDEE from your logged intake and Apple Health data
          over the first ~2 weeks.
        </MethodologyNote>
      </div>
    </div>
  );
}

function MacroTile({ name, value, unit, color, pct }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{name}</span>
        <span style={{ fontSize: 10, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800,
        color: 'var(--text)', letterSpacing: '-0.025em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>{value}<span style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 500, marginLeft: 3 }}>{unit}</span></div>
      <div style={{
        marginTop: 10, height: 3, borderRadius: 2,
        background: `${color}22`,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 2,
        }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 11 — Permissions (Apple Health + Notifications)
// ─────────────────────────────────────────────────────────────
function PermissionsStep() {
  const { state, set } = useOnboarding();
  return (
    <StepBody>
      <StepHeader
        overline="Step 12 of 13"
        title="A couple of permissions"
        subtitle="Both are optional and you can change them later in Settings."
      />
      <PermissionCard
        icon={<Icon name="heart-pulse" size={22} color="var(--magenta)"/>}
        iconBg="rgba(255,126,179,0.12)"
        title="Apple Health"
        body="Read your active energy and steps to refine your adaptive TDEE. Suppr does not write to Health."
        granted={state.healthGranted}
        onAllow={() => set({ healthGranted: true })}
        onSkip={() => set({ healthGranted: false })}
      />
      <PermissionCard
        icon={<Icon name="bell" size={20} color="var(--warning)"/>}
        iconBg="rgba(255,192,76,0.12)"
        title="Notifications"
        body="Gentle reminders only — an optional evening nudge if you're below your protein target. Off by default on weekends."
        granted={state.notifGranted}
        onAllow={() => set({ notifGranted: true })}
        onSkip={() => set({ notifGranted: false })}
      />
    </StepBody>
  );
}

function PermissionCard({ icon, iconBg, title, body, granted, onAllow, onSkip }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${granted === true ? 'rgba(76,208,128,0.4)' : 'var(--border)'}`,
      borderRadius: 16, padding: 18, marginBottom: 12,
      transition: 'border-color 200ms',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: iconBg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 4, lineHeight: 1.5 }}>{body}</div>
        </div>
      </div>
      {granted === true ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>
          <Icon name="check" size={14} color="var(--success)" strokeWidth={2.5}/>Allowed
        </div>
      ) : granted === false ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-sec)' }}>Skipped — you can allow later</div>
          <button onClick={onAllow} style={{ background: 'none', border: 0, color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Undo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <Button size="md" onClick={onAllow}>Allow</Button>
          <Button size="md" variant="secondary" onClick={onSkip}>Not now</Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 12 — First recipe import demo
// ─────────────────────────────────────────────────────────────
function ImportStep() {
  const { state, set } = useOnboarding();
  const [url, setUrl] = React.useState('');
  const [phase, setPhase] = React.useState('idle'); // idle | parsing | done

  const runImport = src => {
    set({ importSource: src });
    setPhase('parsing');
    setTimeout(() => setPhase('done'), 2200);
  };

  return (
    <StepBody>
      <StepHeader
        overline="Step 13 of 13"
        title="Try importing a recipe"
        subtitle="Paste a link or pick a source — Suppr parses ingredients and matches each against USDA / Open Food Facts."
      />

      {phase === 'idle' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <TextField
              label="Recipe URL"
              value={url}
              onChange={setUrl}
              placeholder="https://www.instagram.com/reel/…"
              prefix={<Icon name="link" size={14} color="var(--text-muted)"/>}
            />
          </div>
          <Button
            full size="lg" variant="secondary"
            onClick={() => runImport('instagram')}
            disabled={!url && false}
          >
            {url ? 'Import this recipe' : 'Try a sample recipe'}
          </Button>

          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', margin: '22px 0 10px',
          }}>Or pick a source</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <SourceTile name="Instagram" icon="instagram" onClick={() => runImport('instagram')}/>
            <SourceTile name="TikTok"    icon="music"     onClick={() => runImport('tiktok')}/>
            <SourceTile name="Any blog"  icon="link"      onClick={() => runImport('blog')}/>
          </div>
        </>
      )}

      {phase === 'parsing' && <ImportParsing/>}
      {phase === 'done'    && <ImportDone source={state.importSource}/>}
    </StepBody>
  );
}

function SourceTile({ name, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 10px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      color: 'var(--text)', fontFamily: 'inherit',
      transition: 'all 150ms',
    }}>
      <Icon name={icon} size={22} color="var(--text-sec)"/>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
    </button>
  );
}

function ImportParsing() {
  const steps = [
    'Fetching recipe…',
    'Parsing ingredients with natural-language model',
    'Matching against USDA food database',
    'Calculating macros and confidence',
  ];
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setCur(c => Math.min(steps.length - 1, c + 1)), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
      padding: 22, textAlign: 'center',
    }}>
      <div style={{
        width: 60, height: 60, margin: '0 auto 16px',
        borderRadius: 30, border: '3px solid var(--border)',
        borderTopColor: 'var(--primary)',
        animation: 'spin 1s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
        Importing your recipe
      </div>
      <div style={{ textAlign: 'left', maxWidth: 280, margin: '0 auto' }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '6px 0',
            opacity: i <= cur ? 1 : 0.35,
            transition: 'opacity 250ms',
          }}>
            {i < cur
              ? <Icon name="check" size={14} color="var(--success)" strokeWidth={2.5}/>
              : <div style={{ width: 14, height: 14, borderRadius: 7, border: `1.5px solid ${i === cur ? 'var(--primary)' : 'var(--radio-border)'}`, background: i === cur ? 'rgba(108,140,255,0.2)' : 'transparent' }}/>
            }
            <span style={{ fontSize: 12, color: i <= cur ? 'var(--text)' : 'var(--text-muted)' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportDone({ source }) {
  const src = {
    instagram: 'instagram.com', tiktok: 'tiktok.com', blog: 'seriouseats.com',
  }[source] || 'instagram.com';
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--success-border)', borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        aspectRatio: '16/9',
        background: 'linear-gradient(135deg, #2a2a3a 0%, var(--bg-input) 50%, #2f3542 100%)',
        display: 'grid', placeItems: 'center', position: 'relative',
      }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: 'var(--text-faint)', fontWeight: 600,
        }}>recipe photo</div>
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(10px)',
          padding: '5px 10px', borderRadius: 9999,
          fontSize: 11, fontWeight: 600, color: 'var(--text)',
        }}>
          <Icon name="link" size={11} color="var(--primary)"/>
          {src}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--success)', marginBottom: 8,
        }}>
          <Icon name="check" size={13} color="var(--success)" strokeWidth={2.5}/>
          Matched · 94% confidence
        </div>
        <div style={{
          fontSize: 17, fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.01em', marginBottom: 4,
        }}>Sheet-pan chicken with roasted peppers</div>
        <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 14 }}>
          4 servings · 32 min
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          borderTop: '1px solid var(--border)', paddingTop: 14,
        }}>
          <MiniStat n="620" u="kcal" c="var(--success)"/>
          <MiniStat n="48"  u="P g"  c="var(--primary)"/>
          <MiniStat n="52"  u="C g"  c="var(--warning)"/>
          <MiniStat n="22"  u="F g"  c="var(--magenta)"/>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ n, u, c }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{n}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: c, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{u}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step body wrapper + methodology note
// ─────────────────────────────────────────────────────────────
function StepBody({ children, style }) {
  return (
    <div style={{
      padding: '24px 24px 12px',
      display: 'flex', flexDirection: 'column',
      height: '100%', boxSizing: 'border-box',
      ...style,
    }}>{children}</div>
  );
}

function MethodologyNote({ children }) {
  return (
    <div style={{
      marginTop: 18,
      padding: 12,
      background: 'rgba(108,140,255,0.06)',
      border: '1px solid var(--primary-tint-bg-strong)',
      borderRadius: 12,
      fontSize: 11,
      color: 'var(--text-sec)',
      lineHeight: 1.55,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <Icon name="sparkles" size={13} color="var(--primary)"/>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Validation map — what's needed before "continue" enables
// ─────────────────────────────────────────────────────────────
function canAdvance(step, state) {
  const k = STEP_IDS[step];
  switch (k) {
    case 'welcome': return true;
    case 'signup':  return !!(state.authMethod || (state.name && state.email && state.email.includes('@')));
    case 'goal':    return !!state.goal;
    case 'pace':    {
      if (state.goal === 'maintain') return true;
      // Block advance if the resulting target falls below medical safety floor
      const t = computeTargets(state);
      if (t && (state.goal === 'lose' || state.goal === 'recomp')) {
        const floor = state.sex === 'female' ? 1200 : 1500;
        if (t.target < floor) return false;
      }
      return state.paceKgPerWeek != null || true;
    }
    case 'sex':     return !!state.sex;
    case 'age':     return state.age >= 14;
    case 'height':  return state.heightCm > 0;
    case 'weight':  return state.weightKg > 0;
    case 'activity':return !!state.activity;
    case 'diet':    return true;
    case 'reveal':  return true;
    case 'permissions': return true;
    case 'import':  return true;
    default: return true;
  }
}

// Map step id → component
const STEP_COMPONENTS = {
  welcome:     WelcomeStep,
  signup:      SignupStep,
  goal:        GoalStep,
  pace:        PaceStep,
  sex:         SexStep,
  age:         AgeStep,
  height:      HeightStep,
  weight:      WeightStep,
  activity:    ActivityStep,
  diet:        DietStep,
  reveal:      RevealStep,
  permissions: PermissionsStep,
  import:      ImportStep,
};

Object.assign(window, {
  StepHeader, StepBody, MethodologyNote,
  WelcomeStep, SignupStep, GoalStep, PaceStep, SexStep, AgeStep, HeightStep,
  WeightStep, ActivityStep, DietStep, RevealStep, PermissionsStep, ImportStep,
  STEP_COMPONENTS, canAdvance,
});
