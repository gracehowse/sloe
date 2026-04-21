// Web flow — split layout: left "story" column + right interactive card.
// Same state as MobileFlow via OnboardingProvider context.

function WebFlow() {
  const { state, go, goTo, TOTAL, STEP_IDS, targets } = useOnboarding();
  const stepKey = STEP_IDS[state.step];
  const StepComponent = STEP_COMPONENTS[stepKey];
  const isWelcome = stepKey === 'welcome';

  const progressValue = state.step;
  const progressTotal = TOTAL - 1;

  const advance = () => {
    if (!canAdvance(state.step, state)) return;
    if (state.step === TOTAL - 1) { goTo(0); return; }
    go(1);
  };

  // Welcome takes the whole canvas
  if (isWelcome) {
    return <WebWelcome/>;
  }

  // Narrative content for the left column — varies per step
  const narrative = NARRATIVE[stepKey] || { eyebrow: 'Setup', head: 'Let\'s tailor things' };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-surface)', color: 'var(--text)',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Top bar — brand + progress + exit */}
      <div style={{
        height: 64, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        padding: '0 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-card)', backdropFilter: 'blur(14px)',
      }}>
        <SupprWordmark/>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          flex: 1, maxWidth: 420, margin: '0 40px',
        }}>
          <ProgressBar value={progressValue} total={progressTotal} style={{ flex: 1 }}/>
          <div style={{
            fontSize: 12, color: 'var(--text-sec)', fontWeight: 600,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
            minWidth: 44,
          }}>Step {state.step} of {progressTotal}</div>
        </div>
        <button style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-sec)',
          background: 'transparent', border: 0, cursor: 'pointer',
          fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8,
        }}>Save & exit</button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        minHeight: 0, overflow: 'hidden',
      }}>
        {/* Left — narrative */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '56px 64px',
          background: 'radial-gradient(ellipse at top left, rgba(76,108,224,0.12), transparent 55%)',
        }}>
          <div key={`n${state.step}`} style={{ animation: 'wFadeIn 400ms cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.14em', color: 'var(--primary)',
              marginBottom: 16,
            }}>{narrative.eyebrow}</div>
            <h1 style={{
              fontSize: 44, fontWeight: 800, letterSpacing: '-0.035em',
              color: 'var(--text-strong)', margin: '0 0 18px', lineHeight: 1.05,
              textWrap: 'balance', maxWidth: 520,
            }}>{narrative.head}</h1>
            {narrative.body && (
              <p style={{
                fontSize: 16, color: 'var(--text-sec)',
                margin: 0, lineHeight: 1.6, maxWidth: 440,
                textWrap: 'pretty',
              }}>{narrative.body}</p>
            )}
            {narrative.extra && <div style={{ marginTop: 32 }}>{narrative.extra({ state, targets })}</div>}
          </div>
          <style>{`
            @keyframes wFadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>

        {/* Right — interactive card */}
        <div style={{
          borderLeft: '1px solid var(--bg-input)',
          background: 'var(--bg-card-alt)',
          padding: '40px 48px',
          overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div key={`c${state.step}`} style={{
            flex: 1, minHeight: 0,
            animation: 'wFadeIn 400ms 60ms cubic-bezier(0.22,1,0.36,1) backwards',
          }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, minHeight: 'calc(100% - 88px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {StepComponent && <StepComponent/>}
            </div>
            <div style={{
              marginTop: 20, display: 'flex', gap: 12,
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <button
                onClick={() => go(-1)}
                style={{
                  background: 'transparent', border: 0,
                  color: 'var(--text-sec)', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 4px',
                }}
              ><Icon name="chevron-left" size={16}/>Back</button>
              <Button
                size="lg"
                onClick={advance}
                disabled={!canAdvance(state.step, state)}
                icon={null}
              >
                Continue
                <Icon name="arrow-right" size={15} color="var(--text-on-brand)" strokeWidth={2.2}/>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Web welcome — full-bleed hero (the one place with real gradient)
// ─────────────────────────────────────────────────────────────
function WebWelcome() {
  const { go } = useOnboarding();
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-canvas)', color: 'var(--text)',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* gradient washes */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 20%, rgba(76,108,224,0.28), transparent 50%)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 75% 75%, rgba(224,72,136,0.22), transparent 55%)',
      }}/>

      <div style={{
        position: 'relative', height: '100%',
        padding: '36px 64px',
        display: 'grid', gridTemplateColumns: '1.1fr 1fr',
        alignItems: 'center', gap: 48,
      }}>
        {/* left */}
        <div style={{ zIndex: 2 }}>
          <div style={{ marginBottom: 40 }}>
            <SupprWordmark dark/>
          </div>
          <h1 style={{
            fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--text-strong)', margin: '0 0 22px', lineHeight: 1.0,
            textWrap: 'balance',
          }}>
            Join the<br/>Suppr Club.
          </h1>
          <p style={{
            fontSize: 17, color: 'var(--text-sec)',
            margin: '0 0 36px', lineHeight: 1.55, maxWidth: 520,
          }}>
            Eat well. Cook what you want. Know what's in it. Import recipes from
            the sites you already use — Suppr breaks down the macros and calibrates
            targets to you.
          </p>

          <div style={{ display: 'flex', gap: 14, marginBottom: 40 }}>
            <Button size="xl" onClick={() => go(1)}
              style={{ padding: '0 28px' }}>Join the club — free</Button>
            <Button size="xl" variant="ghost"
              style={{ color: 'var(--text)' }}>
              I'm already a member
            </Button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 32,
            fontSize: 12,
          }}>
            <Checkline>Adaptive TDEE that learns from you</Checkline>
            <Checkline>One-tap import from any recipe site</Checkline>
            <Checkline>Calm design, private by default</Checkline>
          </div>
        </div>

        {/* right — floating product preview */}
        <div style={{
          position: 'relative', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WebWelcomeVisual/>
        </div>
      </div>
    </div>
  );
}

function Checkline({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        background: 'rgba(76,208,128,0.2)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Icon name="check" size={11} color="var(--success)" strokeWidth={3}/>
      </div>
      <span style={{ color: 'var(--text-sec)', fontWeight: 500 }}>{children}</span>
    </div>
  );
}

function WebWelcomeVisual() {
  return (
    <div style={{
      position: 'relative', width: 440, height: 520,
    }}>
      {/* Main "Today" card preview */}
      <div style={{
        position: 'absolute', top: 40, right: 0, width: 380,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 22, padding: 24,
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-lg), 0 0 0 1px var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Wed, 14 May</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 2 }}>Today</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>
            <Icon name="check" size={11} color="var(--success)" strokeWidth={3}/>On track
          </div>
        </div>

        {/* ring */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
            <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="55" cy="55" r="46" stroke="var(--bg-input)" strokeWidth="9" fill="none"/>
              <circle cx="55" cy="55" r="46" stroke="var(--success)" strokeWidth="9" fill="none" strokeLinecap="round"
                strokeDasharray="289" strokeDashoffset="62"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>left</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>380</div>
              <div style={{ fontSize: 9, color: 'var(--text-sec)', marginTop: 1 }}>of 1,800</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <MiniMacro name="Protein" v="92" t="140g" pct={66} c="var(--primary)"/>
            <MiniMacro name="Carbs"   v="168" t="180g" pct={93} c="var(--warning)"/>
            <MiniMacro name="Fat"     v="48" t="60g" pct={80} c="var(--magenta)"/>
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 12, background: 'var(--bg-input)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-tint-bg-strong)', display: 'grid', placeItems: 'center' }}>
            <Icon name="link" size={14} color="var(--primary)"/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Sheet-pan chicken bowl</div>
            <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 1 }}>imported from instagram.com</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>620</div>
        </div>
      </div>

      {/* Floating import card */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 240,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: 14,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        transform: 'rotate(-4deg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="instagram" size={14} color="#e04888"/>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-sec)' }}>Importing</span>
          <div style={{ flex: 1 }}/>
          <div style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }}/>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>Korean beef bowl</div>
        <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 3 }}>12 ingredients matched</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Floating weekly insight */}
      <div style={{
        position: 'absolute', bottom: 40, left: 20, width: 260,
        background: 'linear-gradient(135deg, rgba(76,108,224,0.25), rgba(224,72,136,0.18))',
        border: '1px solid var(--primary-tint-border)',
        borderRadius: 16, padding: 16,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        transform: 'rotate(3deg)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary-hover)', marginBottom: 6 }}>Weekly insight</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em', marginBottom: 8 }}>Protein intake up 18%</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
          {[30, 42, 38, 55, 62, 72, 80].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg, var(--primary-hover), rgba(138,164,255,0.35))', borderRadius: 2 }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniMacro({ name, v, t, pct, c }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-sec)', marginBottom: 3, fontWeight: 600 }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{name}</span>
        <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{v} <span style={{ color: 'var(--text-muted)' }}>/ {t}</span></span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Narrative content keyed by step
// ─────────────────────────────────────────────────────────────
const NARRATIVE = {
  signup: {
    eyebrow: 'Step 02 · Account',
    head: 'One account.\nEvery device.',
    body: 'Sign in on your laptop, keep logging from your phone — same plan, same targets, always in sync.',
  },
  goal: {
    eyebrow: 'Step 03 · Goal',
    head: "What's the plan?",
    body: "You can change this anytime. Real goals shift, and Suppr adapts with them — your targets recalculate automatically.",
  },
  pace: {
    eyebrow: 'Step 09 · Pace',
    head: 'How fast\nshould we go?',
    body: "Now that we know your body, we can translate your chosen rate into a real daily target. We'll flag anything that drops below the generally-accepted safety floor — you can change pace any time from Settings.",
  },
  sex: {
    eyebrow: 'Step 04 · Metabolism',
    head: 'A quick detail\nabout you.',
    body: "Male vs female shifts basal metabolic rate by about 166 kcal/day. This only affects your calorie target.",
  },
  age: {
    eyebrow: 'Step 05 · Metabolism',
    head: 'And your age.',
    body: "Metabolic rate drops about 1% per decade after 20. We'll factor that in — and keep re-calibrating as Suppr learns from your logs.",
  },
  height: {
    eyebrow: 'Step 06 · Metabolism',
    head: 'How tall are you?',
    body: 'Height is the last variable we need to estimate your resting burn.',
  },
  weight: {
    eyebrow: 'Step 07 · Metabolism',
    head: 'And your current weight.',
    body: "Stored privately. We'll never prompt you for a daily weigh-in — log it when you want to, skip it when you don't.",
  },
  activity: {
    eyebrow: 'Step 08 · Activity',
    head: 'How much do you move?',
    body: "Rough estimate is fine. Suppr will re-calibrate using your Apple Health active-energy data over the first two weeks.",
  },
  diet: {
    eyebrow: 'Step 10 · Preferences',
    head: 'Anything off the table?',
    body: 'We use this to filter recipes in Discover and to suggest swaps. Keep it empty if nothing applies — you can tweak any time.',
  },
  reveal: {
    eyebrow: 'Step 11 · Your targets',
    head: "Here's what your\nday looks like.",
    body: 'Calculated from everything you just told us. These numbers will adapt as Suppr learns from your logs.',
    extra: ({ targets }) => targets ? (
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto auto', rowGap: 14, columnGap: 28,
        maxWidth: 420,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>Your BMR</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{targets.bmr.toLocaleString()} <span style={{ fontSize: 13, color: 'var(--text-sec)', fontWeight: 500 }}>kcal/day</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>Estimated TDEE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{targets.tdee.toLocaleString()} <span style={{ fontSize: 13, color: 'var(--text-sec)', fontWeight: 500 }}>kcal/day</span></div>
        </div>
      </div>
    ) : null,
  },
  permissions: {
    eyebrow: 'Step 12 · Access',
    head: "A couple of\npermissions.",
    body: "Both optional, both revocable. Suppr only asks for what it needs to give you accurate numbers.",
  },
  import: {
    eyebrow: 'Step 13 · Try it',
    head: 'Import your\nfirst recipe.',
    body: "Paste any link — Instagram reel, TikTok, a blog post — and Suppr parses ingredients, matches them against USDA, and calculates macros in seconds.",
  },
};

Object.assign(window, { WebFlow, WebWelcome, NARRATIVE, WebUrlPill });

function WebUrlPill() {
  const { state, STEP_IDS } = useOnboarding();
  const stepKey = STEP_IDS[state.step];
  const slugs = {
    welcome:     'welcome',
    signup:      'signup',
    goal:        'onboarding/goal',
    pace:        'onboarding/pace',
    sex:         'onboarding/sex',
    age:         'onboarding/age',
    height:      'onboarding/height',
    weight:      'onboarding/weight',
    activity:    'onboarding/activity',
    diet:        'onboarding/preferences',
    reveal:      'onboarding/your-plan',
    permissions: 'onboarding/permissions',
    import:      'onboarding/first-recipe',
  };
  return (
    <span className="pill">
      <span style={{ opacity: 0.5 }}>suppr-club.com/</span>{slugs[stepKey] || stepKey}
    </span>
  );
}
