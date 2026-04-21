// Mobile flow — iOS frame with full-bleed onboarding
// Uses the shared OnboardingProvider + step components.

function MobileFlow({ compactScale = false }) {
  const { state, go, goTo, TOTAL, STEP_IDS } = useOnboarding();
  const stepKey = STEP_IDS[state.step];
  const StepComponent = STEP_COMPONENTS[stepKey];
  const isWelcome = stepKey === 'welcome';
  const isReveal = stepKey === 'reveal';
  const isImport = stepKey === 'import';
  const showHeader = !isWelcome;
  const showFooter = !isWelcome;

  // progress value: welcome counts as step 0 (hidden), real progress starts at step 1
  const progressValue = state.step; // 0..TOTAL-1
  const progressTotal = TOTAL - 1;

  const ctaLabel = (() => {
    if (isReveal) return 'Looks good — continue';
    if (isImport) return 'Open my dashboard';
    if (state.step === TOTAL - 2) return 'Continue';
    return 'Continue';
  })();

  const advance = () => {
    if (!canAdvance(state.step, state)) return;
    if (state.step === TOTAL - 1) {
      // would land in app — loop back for demo
      goTo(0);
      return;
    }
    go(1);
  };

  return (
    <div style={{
      width: 402, height: 874,
      borderRadius: 48, overflow: 'hidden', position: 'relative',
      background: 'var(--bg-canvas)',
      boxShadow: 'var(--shadow-lg), 0 0 0 10px var(--device-bezel), 0 0 0 11px var(--border)',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      color: 'var(--text)',
      transform: compactScale ? 'scale(0.88)' : 'none',
      transformOrigin: 'top center',
    }}>
      {/* Dynamic island */}
      <div style={{
        position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
        width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 80,
      }}/>
      {/* Status bar */}
      <MobileStatusBar/>

      {/* Header (progress + back) */}
      {showHeader && (
        <div style={{
          position: 'absolute', top: 62, left: 0, right: 0, zIndex: 40,
          padding: '10px 20px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => go(-1)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text)', display: 'grid', placeItems: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            ><Icon name="chevron-left" size={18}/></button>
            <ProgressBar value={progressValue} total={progressTotal} style={{ flex: 1 }}/>
            <div style={{
              fontSize: 11, color: 'var(--text-sec)', fontWeight: 700,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
              minWidth: 28, textAlign: 'right',
            }}>{state.step}/{progressTotal}</div>
          </div>
        </div>
      )}

      {/* Step body */}
      <div style={{
        position: 'absolute', inset: 0,
        paddingTop: showHeader ? 118 : 0,
        paddingBottom: showFooter ? 110 : 0,
        overflow: 'auto',
      }}>
        <div key={state.step} style={{
          animation: 'stepIn 350ms cubic-bezier(0.22,1,0.36,1)',
          height: '100%',
        }}>
          {StepComponent && <StepComponent compact/>}
        </div>
        <style>{`
          @keyframes stepIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* Footer CTA */}
      {showFooter && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
          padding: '14px 20px 38px',
          background: 'linear-gradient(180deg, transparent, var(--bg-canvas) 28%, var(--bg-canvas) 60%)',
        }}>
          <Button
            full size="xl"
            onClick={advance}
            disabled={!canAdvance(state.step, state)}
          >{ctaLabel}</Button>
        </div>
      )}

      {/* Home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 132, height: 5, borderRadius: 999,
        background: 'rgba(255,255,255,0.55)', zIndex: 90, pointerEvents: 'none',
      }}/>
    </div>
  );
}

function MobileStatusBar() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 70,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 30px 10px', fontSize: 15, fontWeight: 600, color: 'var(--text)',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="6" width="3" height="5" rx="0.7" fill="var(--text)"/><rect x="5" y="4" width="3" height="7" rx="0.7" fill="var(--text)"/><rect x="10" y="2" width="3" height="9" rx="0.7" fill="var(--text)"/><rect x="15" y="0" width="3" height="11" rx="0.7" fill="var(--text)"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 3a7 7 0 0 1 5 2l1-1a8 8 0 0 0-12 0l1 1a7 7 0 0 1 5-2Z" fill="var(--text)"/><path d="M8 6a4 4 0 0 1 3 1l1-1a5 5 0 0 0-8 0l1 1a4 4 0 0 1 3-1Z" fill="var(--text)"/><circle cx="8" cy="9.5" r="1.3" fill="var(--text)"/></svg>
        <svg width="25" height="11" viewBox="0 0 25 11"><rect x="0.5" y="0.5" width="22" height="10" rx="2.5" fill="none" stroke="var(--text)" strokeOpacity="0.45"/><rect x="2" y="2" width="19" height="7" rx="1.5" fill="var(--text)"/></svg>
      </div>
    </div>
  );
}

Object.assign(window, { MobileFlow });
