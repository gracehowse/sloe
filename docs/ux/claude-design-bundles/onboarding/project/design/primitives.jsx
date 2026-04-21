// Shared primitive components — buttons, inputs, steppers, logo, chips.
// Pure visual building blocks — zero business logic.

// ─────────────────────────────────────────────────────────────
// Logo mark — rounded-square "S" per design system spec (25% radius)
// ─────────────────────────────────────────────────────────────
function SupprMark({ size = 32, dark = true, style }) {
  // Mark is always blue background with WHITE "S" regardless of theme.
  // Follows the canonical logo-mark.svg / logo-mark-dark.svg assets.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={style}>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="var(--primary)"/>
      <text x="16" y="22.5" textAnchor="middle"
        style={{
          fontFamily: 'Inter, system-ui',
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: '-0.02em',
          fill: '#ffffff',
        }}>S</text>
    </svg>
  );
}

function SupprWordmark({ dark = true }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <SupprMark size={28}/>
      <span style={{
        fontFamily: 'Inter, system-ui',
        fontWeight: 700, fontSize: 18,
        letterSpacing: '-0.02em', color: 'var(--text)',
      }}>Suppr</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Primary / Secondary / Ghost buttons
// ─────────────────────────────────────────────────────────────
function Button({ children, variant = 'primary', size = 'lg', full = false, disabled, onClick, icon, style, ...rest }) {
  const heights = { md: 40, lg: 48, xl: 56 };
  const fontSizes = { md: 13, lg: 15, xl: 16 };
  const base = {
    height: heights[size], borderRadius: 12,
    padding: size === 'xl' ? '0 24px' : '0 18px',
    fontFamily: 'Inter, system-ui',
    fontWeight: 700,
    fontSize: fontSizes[size],
    letterSpacing: '-0.01em',
    border: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: full ? '100%' : undefined,
    transition: 'filter 120ms var(--pm-ease, cubic-bezier(0.22,1,0.36,1)), background 150ms, transform 120ms',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--text-on-brand)' },
    secondary: { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-sec)', border: 0 },
    glass: {
      background: 'rgba(255,255,255,0.08)', color: 'var(--text-strong)',
      border: '1px solid rgba(255,255,255,0.18)',
      backdropFilter: 'blur(12px)',
    },
    dark: { background: 'var(--bg-canvas)', color: 'var(--text-strong)', border: '1px solid rgba(255,255,255,0.1)' },
    apple: { background: '#000000', color: '#ffffff', border: '1px solid #000000' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {icon}{children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Selection card — tappable option with optional icon + subtitle
// ─────────────────────────────────────────────────────────────
function OptionCard({ selected, onClick, icon, title, subtitle, trailing, compact = false, accent = 'var(--primary)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: compact ? '14px 16px' : '16px 18px',
        background: selected ? 'var(--primary-tint-bg)' : 'var(--bg-card)',
        border: `1px solid ${selected ? accent : 'var(--border)'}`,
        borderRadius: 16,
        cursor: 'pointer',
        fontFamily: 'inherit', color: 'var(--text)',
        transition: 'all 150ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {icon && (
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: selected ? `${accent}22` : 'var(--bg-input)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          color: selected ? accent : 'var(--text-sec)',
          transition: 'all 150ms cubic-bezier(0.22,1,0.36,1)',
        }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 14 : 15, fontWeight: 600,
          color: 'var(--text)', letterSpacing: '-0.01em',
          lineHeight: 1.35,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 12, color: 'var(--text-sec)',
            marginTop: 2, lineHeight: 1.4,
          }}>{subtitle}</div>
        )}
      </div>
      {trailing !== undefined ? trailing : (
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          border: `1.5px solid ${selected ? accent : 'var(--radio-border)'}`,
          background: selected ? accent : 'transparent',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          transition: 'all 120ms cubic-bezier(0.22,1,0.36,1)',
        }}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 11 11">
              <path d="M1.5 5.5l2.5 2.5 5.5-5.5" stroke="var(--text-on-brand)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Chip (multi-select tag)
// ─────────────────────────────────────────────────────────────
function Chip({ selected, onClick, children, accent = 'var(--primary)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px',
        borderRadius: 9999,
        background: selected ? 'var(--primary-tint-bg-strong)' : 'var(--bg-card)',
        color: selected ? accent : 'var(--text)',
        border: `1px solid ${selected ? accent : 'var(--border)'}`,
        fontFamily: 'inherit',
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// TextField — inline floating label, dark surface
// ─────────────────────────────────────────────────────────────
function TextField({ label, value, onChange, placeholder, type = 'text', autoFocus, prefix, suffix, onKeyDown }) {
  return (
    <label style={{
      display: 'block',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 14px',
      transition: 'border-color 150ms',
    }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4,
        }}>{label}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {prefix && <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>{prefix}</span>}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown}
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 0, outline: 'none',
            color: 'var(--text)',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
            padding: 0,
          }}
        />
        {suffix && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{suffix}</span>}
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Segmented control (small, e.g. metric/imperial, male/female/other)
// ─────────────────────────────────────────────────────────────
function Segmented({ options, value, onChange, accent = 'var(--primary)' }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
    }}>
      {options.map(opt => {
        const k = opt.value ?? opt;
        const label = opt.label ?? opt;
        const on = k === value;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            style={{
              padding: '7px 14px',
              borderRadius: 8, border: 0,
              background: on ? accent : 'transparent',
              color: on ? 'var(--text-on-brand)' : 'var(--text-sec)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Number stepper (age, etc)
// ─────────────────────────────────────────────────────────────
function NumberStepper({ value, onChange, min = 0, max = 120, suffix, big = false, compact = false }) {
  const btnSize = big ? 48 : compact ? 32 : 40;
  const radius = btnSize / 2;
  const numSize = big ? 56 : compact ? 28 : 36;
  const minW = big ? 140 : compact ? 56 : 100;
  const pad = big ? '22px 24px' : compact ? '10px 12px' : '14px 18px';
  const gap = big ? 28 : compact ? 10 : 18;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: compact ? 14 : 16, padding: pad,
      flex: compact ? 1 : 'initial',
    }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: btnSize, height: btnSize, borderRadius: radius,
          background: 'var(--bg-input)', border: 0, color: 'var(--text)',
          cursor: 'pointer', display: 'grid', placeItems: 'center',
          fontSize: compact ? 18 : 22, fontWeight: 500, flexShrink: 0,
        }}>−</button>
      <div style={{ textAlign: 'center', minWidth: minW }}>
        <div style={{
          fontSize: numSize, fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1,
          color: 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</div>
        {suffix && (
          <div style={{
            fontSize: compact ? 10 : 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', marginTop: compact ? 3 : 6,
          }}>{suffix}</div>
        )}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: btnSize, height: btnSize, borderRadius: radius,
          background: 'var(--bg-input)', border: 0, color: 'var(--text)',
          cursor: 'pointer', display: 'grid', placeItems: 'center',
          fontSize: compact ? 18 : 22, fontWeight: 500, flexShrink: 0,
        }}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ruler slider (iOS-style horizontal ticks — great for height/weight)
// ─────────────────────────────────────────────────────────────
// formatImperialHeight helper (total inches → "5′ 10″")
function formatImperialHeightInches(totalIn) {
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

function RulerSlider({
  value, onChange, min, max, step = 1, decimals = 0,
  unit, width = 320, accent = 'var(--primary)',
  format, // optional (v) => string — overrides default numeric display
  parseInput, // optional (str) => number — for custom format entries
}) {
  const canvasRef = React.useRef(null);
  const trackRef = React.useRef(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [dragging, setDragging] = React.useState(false);

  const pxPerStep = 8;           // horizontal px per step
  const range = max - min;
  const steps = Math.round(range / step);
  const contentW = steps * pxPerStep;
  const majorEvery = decimals > 0 ? Math.round(1 / step) : 10;
  const midEvery = Math.max(1, Math.round(majorEvery / 2));

  const roundTo = v => {
    const p = Math.pow(10, Math.max(decimals, 2));
    return Math.round(v * p) / p;
  };
  const clamp = v => Math.max(min, Math.min(max, v));
  const snap = v => roundTo(Math.round((v - min) / step) * step + min);

  const valueToOffset = v => ((v - min) / step) * pxPerStep;

  // Draw the ruler — canvas is lightweight even for thousands of ticks
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;
    const dpr = window.devicePixelRatio || 1;
    const w = track.clientWidth;
    const h = 64;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cs = getComputedStyle(track);
    const majorCol = cs.getPropertyValue('--text').trim() || '#fff';
    const minorCol = cs.getPropertyValue('--text-muted').trim() || '#888';
    const labelCol = cs.getPropertyValue('--text-sec').trim() || '#aaa';

    const centerX = w / 2;
    const offset = valueToOffset(value);

    ctx.font = '500 10px ui-sans-serif, system-ui, -apple-system';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Figure out which tick indices are visible
    const leftEdge = -centerX + offset;
    const rightEdge = w - centerX + offset;
    const firstIdx = Math.max(0, Math.floor(leftEdge / pxPerStep));
    const lastIdx = Math.min(steps, Math.ceil(rightEdge / pxPerStep));

    for (let i = firstIdx; i <= lastIdx; i++) {
      const x = centerX + (i * pxPerStep - offset);
      const isMajor = i % majorEvery === 0;
      const isMid = !isMajor && i % midEvery === 0;
      const tickH = isMajor ? 30 : isMid ? 18 : 10;
      const color = isMajor ? majorCol : minorCol;
      const alpha = isMajor ? 0.9 : isMid ? 0.55 : 0.3;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x) - 0.5, 8, 1, tickH);

      if (isMajor) {
        const v = roundTo(min + i * step);
        const label = decimals > 0 ? v.toFixed(0) : String(v);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = labelCol;
        ctx.fillText(label, x, 44);
      }
    }
    ctx.globalAlpha = 1;
  }, [value, min, max, step, decimals, majorEvery, midEvery, steps]);

  React.useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // Pointer drag → change value
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let startX = 0;
    let startVal = 0;
    let pointerId = null;

    const onDown = e => {
      if (editing) return;
      pointerId = e.pointerId;
      track.setPointerCapture(pointerId);
      startX = e.clientX;
      startVal = value;
      setDragging(true);
    };
    const onMove = e => {
      if (pointerId == null) return;
      const dx = e.clientX - startX;
      const dv = -dx * (step / pxPerStep);
      onChange(snap(clamp(startVal + dv)));
    };
    const onUp = e => {
      if (pointerId == null) return;
      try { track.releasePointerCapture(pointerId); } catch {}
      pointerId = null;
      setDragging(false);
    };

    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
    track.addEventListener('pointercancel', onUp);
    return () => {
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointercancel', onUp);
    };
  }, [value, step, editing, onChange]);

  // Wheel → change value
  const onWheel = e => {
    if (editing) return;
    e.preventDefault();
    const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (step / pxPerStep) * 0.8;
    onChange(snap(clamp(value + delta)));
  };

  // Keyboard
  const onKeyDown = e => {
    if (editing) return;
    let handled = true;
    if (e.key === 'ArrowLeft') onChange(snap(clamp(value - step)));
    else if (e.key === 'ArrowRight') onChange(snap(clamp(value + step)));
    else if (e.key === 'PageDown') onChange(snap(clamp(value - step * majorEvery)));
    else if (e.key === 'PageUp') onChange(snap(clamp(value + step * majorEvery)));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const commitDraft = () => {
    const n = parseInput ? parseInput(draft) : parseFloat(draft);
    if (!isNaN(n)) onChange(snap(clamp(n)));
    setEditing(false);
  };

  const displayVal = format
    ? format(value)
    : (decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));

  return (
    <div style={{ position: 'relative', width }}>
      {/* Big readout — tap to edit */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        {editing ? (
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <input
              autoFocus
              type={parseInput ? 'text' : 'number'}
              inputMode="decimal"
              step={step}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={e => {
                if (e.key === 'Enter') commitDraft();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="ruler-num-input"
              style={{
                fontSize: 60, fontWeight: 800, letterSpacing: '-0.03em',
                lineHeight: 1, color: 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'inherit',
                background: 'transparent', border: 0, outline: 0,
                borderBottom: `3px solid ${accent}`,
                width: format ? 180 : (decimals > 0 ? 160 : 130), textAlign: 'center',
                padding: 0,
                MozAppearance: 'textfield',
              }}
            />
            {unit && !format && (
              <span style={{ fontSize: 18, color: 'var(--text-sec)', fontWeight: 600 }}>{unit}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setDraft(String(displayVal).replace(/[^\d.\- ]/g, m => m)); setEditing(true); }}
            style={{
              background: 'transparent', border: 0, padding: 0, cursor: 'text',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'baseline', gap: 6,
            }}
            aria-label="Edit value"
          >
            <span style={{
              fontSize: 60, fontWeight: 800,
              letterSpacing: '-0.035em', lineHeight: 1,
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{displayVal}</span>
            {unit && !format && (
              <span style={{ fontSize: 18, color: 'var(--text-sec)', fontWeight: 600, marginLeft: 2 }}>{unit}</span>
            )}
          </button>
        )}
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', marginTop: 6,
          textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
        }}>{editing ? 'Type · Enter to save' : 'Drag the ruler · or tap number'}</div>
      </div>

      {/* Ruler track */}
      <div
        ref={trackRef}
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          height: 64, width: '100%',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          outline: 'none',
          overflow: 'hidden',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }}/>
        {/* center indicator */}
        <div style={{
          position: 'absolute', top: 4, bottom: 4, left: '50%',
          width: 3, marginLeft: -1.5,
          background: accent, borderRadius: 2,
          pointerEvents: 'none',
          boxShadow: `0 0 14px ${accent}aa`,
        }}/>
        {/* fade edges */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 48,
          background: 'linear-gradient(90deg, var(--bg-card) 20%, transparent)',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 48,
          background: 'linear-gradient(270deg, var(--bg-card) 20%, transparent)',
          pointerEvents: 'none',
        }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress bar — thin, slightly luminous
// ─────────────────────────────────────────────────────────────
function ProgressBar({ value, total, style }) {
  const pct = Math.max(4, (value / total) * 100);
  return (
    <div style={{
      height: 4, borderRadius: 2,
      background: 'var(--bg-input)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'var(--primary)',
        borderRadius: 2,
        boxShadow: '0 0 8px var(--primary-glow)',
        transition: 'width 400ms cubic-bezier(0.22,1,0.36,1)',
      }}/>
    </div>
  );
}

// Tiny icon helper — wraps lucide glyphs available via window.lucide
function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75 }) {
  // Static set of SVGs we use throughout the flow — avoids CDN lucide dependency for reliability.
  const paths = {
    'trending-down': <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
    'equal':         <><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></>,
    'trending-up':   <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    'shuffle':       <><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></>,
    'user':          <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    'armchair':      <><path d="M5 11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2"/><path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M5 17v2"/><path d="M19 17v2"/><path d="M9 11v-2h6v2"/></>,
    'footprints':    <><path d="M4 16v-2.38c0-.56.12-1.13.34-1.65l2.38-5.74c.26-.62.83-1.02 1.48-1.02.87 0 1.58.7 1.58 1.58v9.7c0 .87-.7 1.58-1.58 1.58h-2.62C4.7 18.08 4 17.38 4 16.5z"/><path d="M8.05 16c.09 1.4 1.31 2.5 2.8 2.5a2.8 2.8 0 0 0 2.8-2.8V14"/><path d="M14 7v.91c0 .81-.13 1.61-.39 2.38C13.23 11.1 13 12.07 13 13c0 1.72.96 2.89 1.5 3.4"/><path d="M18 9v.91c0 .81-.13 1.61-.39 2.38"/></>,
    'activity':      <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    'dumbbell':      <><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></>,
    'flame':         <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
    'leaf':          <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.3c1.3 5.5.6 11.1-5 17.6a7 7 0 1 1-3.2.1z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></>,
    'wheat':         <><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/></>,
    'egg':           <><path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/></>,
    'beef':          <><circle cx="12.5" cy="8.5" r="2.5"/><path d="M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 6.5 1 8.5 3 1.98-1.98 2.5-4.13 2.5-6.13a7 7 0 0 1 1-3.85A6.5 6.5 0 0 0 12.5 2"/></>,
    'droplets':      <><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></>,
    'apple':         <><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></>,
    'fish':          <><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 8c-.7-.7-1.5-1.2-2.5-1.2"/><path d="M6.5 12c-.73-.95-1.8-1.77-3.5-2 .54.76 1 1.93 1 3 0 1-.5 1.76-1 2.24"/><path d="M22 12s-2 5-4 5c-1 0-1-5-4-5 0 2-1 5-3 5"/></>,
    'wheat-off':     <><path d="m2 22 10-10"/><path d="m16 8-1.17 1.17"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="m8 8-.53.53a3.5 3.5 0 0 0 0 4.94L9 15l1.53-1.53c.55-.55.88-1.25.98-1.97"/><path d="M10.91 5.26c.15-.26.34-.51.56-.73L13 3l1.53 1.53a3.49 3.49 0 0 1 .95 3.13"/><path d="M16 6V2h4"/><path d="m11.47 17.47 1.53 1.53-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="m15 13 2.53 2.47-1.53 1.53a3.5 3.5 0 0 1-4.94 0"/><path d="m21 21-1-1"/><path d="M18 15a3.5 3.5 0 0 1 1-2.47l1.47-1.53L21 11.5"/></>,
    'salad':         <><path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/><path d="m13 12 4-4"/><path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2"/></>,
    'heart-pulse':   <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></>,
    'bell':          <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    'instagram':     <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>,
    'link':          <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    'music':         <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    'check':         <><polyline points="20 6 9 17 4 12"/></>,
    'chevron-right': <><polyline points="9 18 15 12 9 6"/></>,
    'chevron-left':  <><polyline points="15 18 9 12 15 6"/></>,
    'arrow-right':   <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    'x':             <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    'apple-logo':    <><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></>,
    'mail':          <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    'lock':          <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    'sparkles':      <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="3"/></>,
  };
  const p = paths[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round">{p}</svg>
  );
}

Object.assign(window, {
  SupprMark, SupprWordmark, Button, OptionCard, Chip,
  TextField, Segmented, NumberStepper, RulerSlider, ProgressBar, Icon,
  formatImperialHeightInches,
});
