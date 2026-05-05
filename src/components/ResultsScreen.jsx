import { useState, useEffect, useRef, lazy, Suspense, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { applyStress } from '../engine/valuationEngine';
import { RESEARCH } from '../data/research';
import { SCENARIO_PRESETS, explainChanges } from '../lib/scenarioPresets';
import { sendReport, openWhatsAppWeb } from '../lib/notifications';
import './ResultsScreen.css';
import '../styles/results-additions.css';

const PropertyMap = lazy(() => import('./PropertyMap'));

/* ── HELPERS ──────────────────────────────────────────────────────────────── */
function formatINR(val) {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function useReveal(threshold = 0.1) {
  const ref  = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis];
}

function Counter({ target, format, started, className }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let raf;
    const start = performance.now();
    const dur = 700;
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, started]);
  return <span className={className}>{format ? format(val) : val}</span>;
}

function getVerdictCode(results) {
  if (results.verdictCode) return results.verdictCode;
  const v = results.verdictLabel || results.verdict || '';
  if (v.includes('Sanction')) return 'SANCTION_RECOMMENDED';
  if (v.includes('Conditional')) return 'CONDITIONAL_REVIEW';
  if (v.includes('Reject') || v.includes('reject')) return 'REJECT';
  if (v.includes('High Risk') || v.includes('High risk')) return 'HIGH_RISK';
  return 'SANCTION_RECOMMENDED';
}

function getVerdictColor(results) {
  if (results.verdictColor) return results.verdictColor;
  const COLORS = {
    SANCTION_RECOMMENDED: '#16A34A',
    CONDITIONAL_REVIEW:   '#D97706',
    HIGH_RISK:            '#DC2626',
    REJECT:               '#DC2626',
  };
  return COLORS[getVerdictCode(results)] || '#16A34A';
}

function generateFallbackPeers(results) {
  const mid = (results.mv_low + results.mv_high) / 2;
  const spread = 0.12;
  const area = results.areaSqft || results.area || 1000;
  return [
    {
      label: 'Comparable A', type: results.propertyType, subtype: results.subtype,
      area: Math.round(area * 0.92), location: 'Adjacent micro-zone',
      mv_low:  Math.round(mid * (1 - spread - 0.04) / 100000) * 100000,
      mv_high: Math.round(mid * (1 + spread - 0.04) / 100000) * 100000,
      rpi: Math.max(10, (results.rpi || 55) - 5),
    },
    {
      label: 'Subject property', type: results.propertyType, subtype: results.subtype,
      area, location: results.address || 'Subject',
      mv_low: results.mv_low, mv_high: results.mv_high, rpi: results.rpi, isSubject: true,
    },
    {
      label: 'Comparable B', type: results.propertyType, subtype: results.subtype,
      area: Math.round(area * 1.08), location: 'Adjacent micro-zone',
      mv_low:  Math.round(mid * (1 - spread + 0.05) / 100000) * 100000,
      mv_high: Math.round(mid * (1 + spread + 0.05) / 100000) * 100000,
      rpi: Math.min(95, (results.rpi || 55) + 4),
    },
  ];
}

/* ── COLLATERAL HEALTH SCORE BANNER (Feature 1) ────────────────────────────── */
function CollateralHealthBanner({ score, band }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 300);
    return () => clearTimeout(t);
  }, []);

  const fillPct = Math.round((score / 850) * 100);
  const fillColor =
    score >= 750 ? '#16A34A' :
    score >= 650 ? '#16A34A' :
    score >= 550 ? '#D97706' :
    score >= 450 ? '#D97706' : '#DC2626';
  const bandColor = fillColor;

  return (
    <div className="health-score-banner">
      <div className="health-score-left">
        <div className="health-score-number">{score ?? '—'}</div>
        <div className="health-score-label">Collateral Health Score</div>
      </div>

      <div className="health-score-gauge">
        <div className="hs-gauge-track">
          <div
            className="hs-gauge-fill"
            style={{
              width: filled ? `${fillPct}%` : '0%',
              background: fillColor,
              transition: 'width 1.2s ease-out',
            }}
          />
        </div>
        <div className="hs-gauge-ticks">
          {[0, 212, 425, 637, 850].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>

      <div className="health-score-band">
        <div className="hs-band-text" style={{ color: bandColor }}>{band}</div>
        <div className="hs-band-sub">vs CIBIL-equivalent scale</div>
      </div>
    </div>
  );
}

/* ── STICKY HEADER ─────────────────────────────────────────────────────────── */
function StickyBar({ results, onReset, onRerun, hideNav = false }) {
  const [compressed, setCompressed] = useState(false);
  const [activeSection, setActiveSection] = useState('section-valuation');

  useEffect(() => {
    const onScroll = () => setCompressed(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = ['section-valuation', 'section-confidence', 'section-anomalies', 'section-memo', 'section-sensitivity'];
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { threshold: 0.3 }
    );
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const code = getVerdictCode(results);
  const verdictClass = code === 'SANCTION_RECOMMENDED' ? 'badge--green'
                     : code === 'CONDITIONAL_REVIEW'   ? 'badge--amber'
                     : 'badge--red';

  const NAV = [
    { id: 'section-valuation',   label: 'Valuation' },
    { id: 'section-confidence',  label: 'Confidence' },
    { id: 'section-anomalies',   label: 'Anomalies' },
    { id: 'section-memo',        label: 'Memo' },
    { id: 'section-sensitivity', label: 'Sensitivity' },
  ];

  return (
    <div className={`results-bar ${compressed ? 'results-bar--compressed' : ''}`}>
      <a href="#results-main" className="skip-link">Skip to main content</a>
      <div className="results-bar-left">
        <span className="results-bar-address">{results.address}</span>
        {(results.propertyType || results.subtype) && (
          <span className="results-bar-type-pill">
            {results.propertyType && (results.propertyType.charAt(0).toUpperCase() + results.propertyType.slice(1))}
            {results.subtype && `, ${results.subtype.charAt(0).toUpperCase() + results.subtype.slice(1)}`}
          </span>
        )}
        <span className={`verdict-badge ${verdictClass}`}>{results.verdictLabel || results.verdict}</span>
      </div>
      {!hideNav && (
        <nav className="results-bar-nav" aria-label="Section navigation">
          {NAV.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav-pill ${activeSection === item.id ? 'nav-pill--active' : ''}`}
              onClick={e => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
      {onRerun && (
        <button className="results-bar-btn results-bar-btn--ghost" onClick={onRerun}>
          ← Edit property
        </button>
      )}
      <button className="results-bar-btn" onClick={onReset}>
        Assess another property
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ── VERDICT HERO ──────────────────────────────────────────────────────────── */
function VerdictHero({ results, stressed }) {
  const code = getVerdictCode(stressed);
  const verdictColor = getVerdictColor(stressed);
  const verdictLabel = stressed.verdictLabel || stressed.verdict;
  const ltvBand = stressed.ltvBand || stressed.ltv_band;
  const recommendedAction = results.recommendedAction;
  const decisionReasons   = results.decisionReasons   || [];
  const escalationFlags   = results.escalationFlags   || [];

  const BG = {
    SANCTION_RECOMMENDED: '#E8F5EE',
    CONDITIONAL_REVIEW:   '#FDF3E3',
    HIGH_RISK:            '#FDE8E6',
    REJECT:               '#FDDADA',
  };
  const bgColor = BG[code] || '#F7F7F4';

  return (
    <div className="verdict-hero" style={{ background: bgColor }} id="section-valuation">
      <div className="verdict-hero-inner">
        <div className="vh-eyebrow">Verdict</div>

        <div className="vh-badge" style={{ background: verdictColor }}>
          {verdictLabel}
        </div>

        <h2 className="vh-title">{verdictLabel}</h2>

        {recommendedAction && (
          <p className="vh-recommended">{recommendedAction}</p>
        )}

        <div className="vh-ltv-section">
          <div className="vh-ltv-label">Recommended LTV Band</div>
          <div className="vh-ltv-pill" style={{ borderColor: verdictColor, color: verdictColor }}>
            {ltvBand}
          </div>
        </div>

        {decisionReasons.length > 0 && (
          <div className="vh-reasons">
            <div className="vh-reasons-label">Why this verdict</div>
            {decisionReasons.map((r, i) => (
              <div key={i} className="vh-reason-row">
                <div className="vh-reason-dot" style={{ background: verdictColor }} />
                <span className="vh-reason-text">{r}</span>
              </div>
            ))}
          </div>
        )}

        {escalationFlags.length > 0 && (
          <div className="vh-escalation">
            <div className="vh-escalation-label">Items requiring human review</div>
            {escalationFlags.map((f, i) => (
              <div key={i} className="vh-escalation-row">
                <span className="vh-escalation-icon">⚠</span>
                <span className="vh-escalation-text">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── METRIC GRID ───────────────────────────────────────────────────────────── */
function MetricGrid({ results, started }) {
  const [ref, vis] = useReveal();
  const s = vis && started;

  const confidencePct = Math.round(results.confidenceScore ?? (results.confidence ?? 0) * 100);
  const tier = results.confidenceTier || (confidencePct >= 85 ? 'high' : confidencePct >= 55 ? 'medium' : 'low');
  const tierColor = tier === 'high' ? '#16A34A' : tier === 'medium' ? '#D97706' : '#DC2626';
  const tierLabel = tier === 'high' ? 'High confidence' : tier === 'medium' ? 'Moderate' : 'Low — review needed';

  const fraudLevel = results.fraudRiskLevel || 'clean';
  const fraudColor = (fraudLevel === 'clean' || fraudLevel === 'low') ? '#16A34A'
                   : fraudLevel === 'medium' ? '#D97706' : '#DC2626';
  const fraudCount = (results.fraudFlags || []).length;
  const fraudDisplay = fraudLevel.charAt(0).toUpperCase() + fraudLevel.slice(1);

  return (
    <div className="metric-grid metric-grid--5" ref={ref}>
      <motion.div className="metric-cell"
        initial={{ opacity: 0, y: 16 }} animate={vis ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <div className="metric-eyebrow">Market value range</div>
        <div className="metric-range">
          <Counter className="metric-big" target={results.mv_low / 100000} format={v => `₹${v.toFixed(1)}L`} started={s} />
          <span className="metric-sep">–</span>
          <Counter className="metric-big" target={results.mv_high / 100000} format={v => `₹${v.toFixed(1)}L`} started={s} />
        </div>
        <div className="metric-note">The lower bound is the conservative estimate. The upper bound assumes all conditions are stable.</div>
      </motion.div>

      <motion.div className="metric-cell"
        initial={{ opacity: 0, y: 16 }} animate={vis ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <div className="metric-eyebrow">Distress sale value</div>
        <div className="metric-range">
          <Counter className="metric-big" target={results.dv_low / 100000} format={v => `₹${v.toFixed(1)}L`} started={s} />
          <span className="metric-sep">–</span>
          <Counter className="metric-big" target={results.dv_high / 100000} format={v => `₹${v.toFixed(1)}L`} started={s} />
        </div>
        <div className="metric-note">What a forced sale under time pressure would realistically recover.</div>
      </motion.div>

      <motion.div className="metric-cell"
        initial={{ opacity: 0, y: 16 }} animate={vis ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <div className="metric-eyebrow">Time to liquidate</div>
        <div className="metric-range">
          <Counter className="metric-big" target={results.ttl_low} format={v => `${v}d`} started={s} />
          <span className="metric-sep">–</span>
          <Counter className="metric-big" target={results.ttl_high} format={v => `${v}d`} started={s} />
        </div>
        <div className="metric-note">How long a sale typically takes in this micromarket under normal conditions.</div>
      </motion.div>

      <motion.div className="metric-cell"
        initial={{ opacity: 0, y: 16 }} animate={vis ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <div className="metric-eyebrow">Confidence Score</div>
        <div className="metric-range">
          <span className="metric-big">{s ? `${confidencePct}%` : '—'}</span>
        </div>
        <div className="metric-tier-chip" style={{ background: tierColor + '22', color: tierColor, border: `1px solid ${tierColor}55` }}>
          {tierLabel}
        </div>
        <div className="metric-note">How reliably this property can be assessed with the available data.</div>
      </motion.div>

      <motion.div className="metric-cell"
        initial={{ opacity: 0, y: 16 }} animate={vis ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <div className="metric-eyebrow">Anomaly Detection</div>
        <div className="metric-range">
          <span className="metric-fraud-level" style={{ color: fraudColor }}>{s ? fraudDisplay : '—'}</span>
        </div>
        <div className="metric-note">{fraudCount} signal{fraudCount !== 1 ? 's' : ''} checked across 5 fraud detection rules.</div>
      </motion.div>
    </div>
  );
}

/* ── RPI GAUGE ─────────────────────────────────────────────────────────────── */
const RPIGauge = memo(function RPIGauge({ rpi, started }) {
  const circumference = 2 * Math.PI * 52;
  const dashArray = circumference * (rpi / 100);
  const band = rpi >= 65 ? 'Highly liquid asset' : rpi >= 45 ? 'Moderate liquidity' : 'Illiquid asset';
  const arcColor = rpi >= 65 ? 'var(--sanction)' : rpi >= 45 ? 'var(--conditional)' : 'var(--highrisk)';
  const bandNote = rpi >= 65
    ? 'This asset sits in the top tier for its category. You can expect a competitive sale process with multiple buyers at fair value.'
    : rpi >= 45
    ? 'Liquidity is acceptable but not exceptional. A sale at full value is achievable within the estimated timeframe with standard marketing.'
    : 'This asset has limited liquidity. Recovery in a forced sale scenario may be significantly below the market value estimate.';
  return (
    <div className="rpi-gauge">
      <div className="rpi-ring-wrap">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke="var(--paper-3)" strokeWidth="4"/>
          <motion.circle
            cx="65" cy="65" r="52" fill="none"
            stroke={arcColor} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${dashArray} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={started ? { strokeDashoffset: circumference * 0.25 } : { strokeDashoffset: circumference }}
            transition={{ duration: 1.2, ease: [0.16,1,0.3,1] }}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '65px 65px' }}
          />
          <text x="65" y="60" textAnchor="middle"
            style={{ fontFamily: 'var(--serif)', fontSize: '28px', fill: 'var(--ink)', fontWeight: 400, fontFeatureSettings: '"kern" on' }}>
            {started ? rpi : 0}
          </text>
          <text x="65" y="76" textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: '8px', fill: 'var(--ink-4)', letterSpacing: '0.08em' }}>
            OUT OF 100
          </text>
        </svg>
      </div>
      <div className="rpi-band-label">{band}</div>
      <p className="rpi-band-note">{bandNote}</p>
    </div>
  );
});

/* ── VALUE DRIVERS ─────────────────────────────────────────────────────────── */
function ValueDrivers({ drivers, started }) {
  const maxAbs = Math.max(...drivers.map(d => Math.abs(d.impact)));
  return (
    <div className="drivers-chart">
      {drivers.map((d, i) => (
        <motion.div key={i} className="driver-row"
          initial={{ opacity: 0, x: 12 }}
          animate={started ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16,1,0.3,1] }}
        >
          <div className="driver-label">{d.label}</div>
          <div className="driver-bar-wrap">
            <div className="driver-bar-track">
              <motion.div
                className={`driver-bar-fill ${d.dir >= 0 ? 'positive' : 'negative'}`}
                initial={{ width: 0 }}
                animate={started ? { width: `${(Math.abs(d.impact) / maxAbs) * 100}%` } : {}}
                transition={{ delay: i * 0.07 + 0.2, duration: 0.6, ease: [0.16,1,0.3,1] }}
              />
            </div>
          </div>
          <div className={`driver-pct ${d.dir >= 0 ? 'positive' : 'negative'}`}>
            {d.dir >= 0 ? '+' : ''}{d.impact}%
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── WATERFALL CHART ───────────────────────────────────────────────────────── */
const WaterfallChart = memo(function WaterfallChart({ results, started }) {
  const [ref, vis] = useReveal();
  const s = vis && started;
  const base = results.circleRatePerSqft;
  const items = [
    { label: 'Circle rate baseline', value: 0, isBase: true },
    ...results.drivers.map(d => ({ label: d.label, value: d.impact, dir: d.dir })),
  ];
  const maxVal = Math.max(...results.drivers.map(d => Math.abs(d.impact)), 5);

  return (
    <div className="waterfall-wrap" ref={ref}>
      <div className="waterfall-chart">
        {items.map((item, i) => (
          <motion.div key={i} className={`wf-row ${item.isBase ? 'wf-base' : ''}`}
            initial={{ opacity: 0 }} animate={s ? { opacity: 1 } : {}} transition={{ delay: i * 0.06 }}
          >
            <div className="wf-label">{item.label}</div>
            <div className="wf-bar-area">
              {item.isBase ? (
                <div className="wf-baseline-line" />
              ) : (
                <div className={`wf-bar-side ${item.dir >= 0 ? 'right' : 'left'}`}>
                  <motion.div
                    className={`wf-bar-fill ${item.dir >= 0 ? 'pos' : 'neg'}`}
                    initial={{ width: 0 }}
                    animate={s ? { width: `${(Math.abs(item.value) / maxVal) * 50}%` } : {}}
                    transition={{ delay: i * 0.07 + 0.2, duration: 0.6, ease: [0.16,1,0.3,1] }}
                  />
                </div>
              )}
            </div>
            <div className={`wf-pct ${item.isBase ? 'base' : item.dir >= 0 ? 'pos' : 'neg'}`}>
              {item.isBase ? `₹${base}/sqft` : `${item.dir >= 0 ? '+' : ''}${item.value}%`}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div className="waterfall-narrative"
        initial={{ opacity: 0 }} animate={s ? { opacity: 1 } : {}} transition={{ delay: 0.6 }}
      >
        {(results.narrative || '').split('\n\n').map((para, i) => (
          <p key={i} className="waterfall-narrative-para">{para}</p>
        ))}
      </motion.div>
    </div>
  );
});

/* ── CONFIDENCE DRIVERS PANEL ──────────────────────────────────────────────── */
const ConfidenceDriversPanel = memo(function ConfidenceDriversPanel({ results, started }) {
  const [ref, vis] = useReveal();
  const s = vis && started;

  const drivers = results.confidenceDrivers || [];
  const negative = drivers.filter(d => d.impact === 'negative');
  const positive = drivers.filter(d => d.impact === 'positive');

  const confidencePct = Math.round(results.confidenceScore ?? (results.confidence ?? 0) * 100);
  const tier = results.confidenceTier || (confidencePct >= 85 ? 'high' : confidencePct >= 55 ? 'medium' : 'low');
  const tierColor = tier === 'high' ? '#16A34A' : tier === 'medium' ? '#D97706' : '#DC2626';
  const showLowWarning = confidencePct < 60;

  return (
    <div className="conf-drivers-panel" ref={ref} id="section-confidence">
      <div className="section-eyebrow-res">Confidence Intelligence</div>
      <h3 className="conf-drivers-heading">What drove the confidence score</h3>
      <p className="conf-drivers-subtitle">
        These factors determined how reliably this property can be assessed with the available data.
      </p>

      {drivers.length > 0 && (
        <div className="conf-drivers-grid">
          <div className="conf-drivers-col">
            <div className="conf-col-label">Factors reducing confidence</div>
            {negative.length === 0
              ? <div className="conf-driver-none">No deductions applied.</div>
              : negative.map((d, i) => (
                <motion.div key={i} className="conf-driver-item conf-driver-item--neg"
                  initial={{ opacity: 0, x: -8 }} animate={s ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.06 }}
                >
                  <span className="conf-driver-arrow conf-driver-arrow--neg">↓</span>
                  <span className="conf-driver-reason">{d.reason}</span>
                </motion.div>
              ))
            }
          </div>
          <div className="conf-drivers-col">
            <div className="conf-col-label">Factors supporting confidence</div>
            {positive.length === 0
              ? <div className="conf-driver-none">No positive factors recorded.</div>
              : positive.map((d, i) => (
                <motion.div key={i} className="conf-driver-item conf-driver-item--pos"
                  initial={{ opacity: 0, x: 8 }} animate={s ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.06 }}
                >
                  <span className="conf-driver-arrow conf-driver-arrow--pos">↑</span>
                  <span className="conf-driver-reason">{d.reason}</span>
                </motion.div>
              ))
            }
          </div>
        </div>
      )}

      <div className="conf-bar-section">
        <div className="conf-bar-track-wide">
          <motion.div
            className="conf-bar-fill-wide"
            style={{ background: tierColor }}
            initial={{ width: 0 }}
            animate={s ? { width: `${confidencePct}%` } : {}}
            transition={{ duration: 1, ease: [0.16,1,0.3,1] }}
          />
        </div>
        <div className="conf-bar-caption">Overall confidence is {confidencePct}%</div>
      </div>

      {showLowWarning && (
        <div className="conf-low-callout">
          Low confidence estimate. This valuation requires physical inspection and additional
          documentation before sanctioning. Do not rely on this estimate as the sole basis for
          a lending decision.
        </div>
      )}
    </div>
  );
});

/* ── ANOMALY DETECTION PANEL ───────────────────────────────────────────────── */
function AnomalyDetectionPanel({ results, started }) {
  const [ref, vis] = useReveal();

  const fraudFlags   = results.fraudFlags   || [];
  const fraudRisk    = results.fraudRiskLevel || 'clean';
  const showBanner   = fraudRisk === 'medium' || fraudRisk === 'high';
  const isClean      = fraudFlags.length === 0 || fraudFlags.every(f => f.severity === 'info');

  const SEV_COLOR = {
    critical: { bg: '#DC2626', text: '#fff' },
    warning:  { bg: '#D97706', text: '#fff' },
    info:     { bg: '#E8E7E1', text: 'var(--ink)' },
  };
  const SEV_ACTION = {
    critical: 'Do not proceed without resolving this issue.',
    warning:  'Verify this information with the borrower before sanctioning.',
    info:     'Note for the credit file.',
  };

  return (
    <div className="anomaly-panel" ref={ref} id="section-anomalies">
      <div className="section-eyebrow-res">Anomaly Detection</div>

      {showBanner && (
        <div className="anomaly-banner">
          This property has <strong>{fraudRisk}</strong> fraud risk indicators.
          Senior credit review is required before any sanction decision.
        </div>
      )}

      {isClean ? (
        <div className="anomaly-clean">
          No significant anomalies detected. All standard checks passed.
        </div>
      ) : (
        <div className="anomaly-flags">
          {fraudFlags.map((f, i) => {
            const sc = SEV_COLOR[f.severity] || SEV_COLOR.info;
            return (
              <motion.div key={i} className="anomaly-flag-card"
                initial={{ opacity: 0, y: 10 }}
                animate={vis && started ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <div className="anomaly-flag-header">
                  <span className="anomaly-severity-badge"
                    style={{ background: sc.bg, color: sc.text }}>
                    {f.severity.toUpperCase()}
                  </span>
                  <span className="anomaly-check-name">{f.checkName}</span>
                </div>
                <p className="anomaly-description">{f.description}</p>
                <p className="anomaly-action">{SEV_ACTION[f.severity] || SEV_ACTION.info}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── DECISION MEMO SECTION ─────────────────────────────────────────────────── */
function DecisionMemoSection({ results, onExportPDF }) {
  const memo   = results.decisionMemo || '';
  const lines  = memo.split('\n');

  const isHeading = (line) =>
    line.trim() &&
    (line === line.toUpperCase() || line.startsWith('COLLATIQ'));

  const timestamp = results.timestamp
    ? new Date(results.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="memo-section" id="section-memo">
      <div className="section-eyebrow-res">Credit Committee Memo</div>
      <div className="memo-document">
        <div className="memo-header">
          <span className="memo-wordmark">Collatiq</span>
          <div className="memo-meta">
            <div className="memo-id">{results.valuationId || '—'}</div>
            <div className="memo-ts">{timestamp}</div>
          </div>
        </div>
        <hr className="memo-rule" />

        <div className="memo-body">
          {lines.map((line, i) => {
            if (!line.trim()) return <div key={i} className="memo-spacer" />;
            if (isHeading(line)) return <div key={i} className="memo-subheading">{line}</div>;
            return <p key={i} className="memo-paragraph">{line}</p>;
          })}
        </div>

        <hr className="memo-rule" />
        <div className="memo-footer">
          <span className="memo-disclaimer">
            Generated by Collatiq Collateral Intelligence Engine. Model v2.0. This is not a certified valuation.
          </span>
          <button className="memo-pdf-btn" onClick={onExportPDF}>
            Download Memo PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SENSITIVITY SLIDERS ───────────────────────────────────────────────────── */
function SensitivityDial({ baseResults, onStressChange }) {
  const [legal,     setLegal]     = useState(0);
  const [occupancy, setOccupancy] = useState(0);
  const [demand,    setDemand]    = useState(0);

  useEffect(() => {
    onStressChange({ legal, occupancy, demand });
  }, [legal, occupancy, demand]); // eslint-disable-line

  return (
    <div className="sensitivity-section">
      <div className="section-eyebrow-res">Stress testing</div>
      <p className="sensitivity-intro">
        Move these sliders to see how the collateral performs under different scenarios.
        The base estimate above reflects the inputs you provided.
      </p>
      <div className="sliders">
        <SliderRow label="Legal status"   leftLabel="Clear title"   rightLabel="Complex title" value={legal}     onChange={setLegal} />
        <SliderRow label="Occupancy"      leftLabel="Self-occupied" rightLabel="Vacant"         value={occupancy} onChange={setOccupancy} />
        <SliderRow label="Market demand"  leftLabel="High demand"   rightLabel="Low demand"     value={demand}    onChange={setDemand} />
      </div>
    </div>
  );
}

function SliderRow({ label, leftLabel, rightLabel, value, onChange }) {
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value-label">{leftLabel}</span>
      </div>
      <div className="slider-track-wrap">
        <span className="slider-endpoint">{leftLabel}</span>
        <input
          type="range" className="slider-input" min="0" max="1" step="0.01" value={value}
          style={{ '--value': value * 100 }}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <span className="slider-endpoint">{rightLabel}</span>
      </div>
    </div>
  );
}

/* ── STRESSED METRICS DISPLAY ──────────────────────────────────────────────── */
function StressedMetrics({ stressed }) {
  const code = getVerdictCode(stressed);
  const verdictClass = code === 'SANCTION_RECOMMENDED' ? 'green'
                     : code === 'CONDITIONAL_REVIEW'   ? 'amber' : 'red';
  const confidencePct = Math.round(stressed.confidenceScore ?? (stressed.confidence ?? 0) * 100);

  return (
    <div className="stressed-metrics">
      <div className="sm-item">
        <span className="sm-label">Market value</span>
        <motion.span className="sm-val" layout animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {formatINR(stressed.mv_low)} – {formatINR(stressed.mv_high)}
        </motion.span>
      </div>
      <div className="sm-item">
        <span className="sm-label">Distress value</span>
        <motion.span className="sm-val" layout animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {formatINR(stressed.dv_low)} – {formatINR(stressed.dv_high)}
        </motion.span>
      </div>
      <div className="sm-item">
        <span className="sm-label">RPI</span>
        <motion.span className="sm-val" layout animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {stressed.rpi} / 100
        </motion.span>
      </div>
      <div className="sm-item">
        <span className="sm-label">Confidence</span>
        <motion.span className="sm-val" layout animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {confidencePct}%
        </motion.span>
      </div>
      <div className="sm-item sm-item--verdict">
        <span className="sm-label">Verdict under stress</span>
        <motion.span className={`sm-verdict ${verdictClass}`} layout animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {stressed.verdictLabel || stressed.verdict}
        </motion.span>
      </div>
    </div>
  );
}

/* ── MICROMARKET STRIP ─────────────────────────────────────────────────────── */
function MicromarketStrip({ results }) {
  const rpi          = results.rpi || 60;
  const crpsf        = results.circleRatePerSqft || results.baseRatePsf || 4200;
  const ttlLow       = results.ttl_low || 45;
  const amenityDens  = results.precomputedInfra?.amenityDensity ?? null;
  const localityGrade = results.localityGrade || 'Developing';

  const activeListings = Math.min(45, Math.max(8, Math.round((amenityDens !== null ? amenityDens * 3.2 : 18) + 8)));
  const medianPsf      = Math.round(crpsf * 1.22 / 50) * 50;
  const avgDays        = ttlLow + 12;
  const demandPressure = rpi > 70 ? 'High' : rpi >= 50 ? 'Moderate' : 'Low';

  const points = [
    { label: 'Active listings',    val: `${activeListings}` },
    { label: 'Median price/sqft',  val: `₹${medianPsf.toLocaleString('en-IN')}` },
    { label: 'Avg days on market', val: `${avgDays}d` },
    { label: 'Demand pressure',    val: demandPressure },
    { label: 'Locality grade',     val: localityGrade },
  ];

  return (
    <div className="mm-strip">
      {points.map((p, i) => (
        <div key={i} className="mm-point">
          <div className="mm-label">{p.label}</div>
          <div className="mm-val">{p.val}</div>
        </div>
      ))}
    </div>
  );
}

/* ── PEER COMPARISON CHART ─────────────────────────────────────────────────── */
function PeerComparisonChart({ results, started }) {
  const [ref, vis] = useReveal();
  const peers   = results.peers || [];
  const subject = peers.find(p => p.isSubject);
  const comps   = peers.filter(p => !p.isSubject);

  if (!subject || comps.length < 1) return null;

  const deriveTTL  = (rpi) => rpi > 74 ? 45 : rpi > 59 ? 67 : rpi > 44 ? 112 : 180;
  const deriveConf = (rpi) => rpi > 74 ? 85 : rpi > 59 ? 72 : rpi > 44 ? 60 : 45;
  const pricePsf   = (p)   => Math.round((p.mv_low + p.mv_high) / 2 / (p.area || 1000));

  const subjectPsf = results.circleRatePerSqft || pricePsf(subject);
  const avgPsf     = Math.round(comps.reduce((s, c) => s + pricePsf(c), 0) / comps.length);
  const bestPsf    = Math.max(...comps.map(pricePsf));

  const dimensions = [
    { label: 'Price / sqft', unit: '₹', vals: [subjectPsf, avgPsf, bestPsf], higherBetter: true, format: v => v > 999 ? `${Math.round(v/1000)}k` : String(v) },
    { label: 'RPI score', unit: '', vals: [subject.rpi, Math.round(comps.reduce((s, c) => s + c.rpi, 0) / comps.length), Math.max(...comps.map(c => c.rpi))], higherBetter: true, format: v => String(v) },
    { label: 'Days to sell', unit: 'd', vals: [deriveTTL(subject.rpi), Math.round(comps.reduce((s, c) => s + deriveTTL(c.rpi), 0) / comps.length), Math.min(...comps.map(c => deriveTTL(c.rpi)))], higherBetter: false, format: v => String(v) },
    { label: 'Confidence', unit: '%', vals: [Math.round((results.confidenceScore ?? (results.confidence ?? 0) * 100)), Math.round(comps.reduce((s, c) => s + deriveConf(c.rpi), 0) / comps.length), Math.max(...comps.map(c => deriveConf(c.rpi)))], higherBetter: true, format: v => String(v) },
  ];

  const BAR_LABELS = ['Subject', 'Avg', 'Best'];

  return (
    <div className="peer-chart" ref={ref}>
      {dimensions.map((dim, di) => {
        const maxVal = dim.higherBetter ? Math.max(...dim.vals) : null;
        const minVal = dim.higherBetter ? null : Math.min(...dim.vals);
        const scale  = (v) => dim.higherBetter
          ? (maxVal > 0 ? (v / maxVal) * 100 : 50)
          : (v > 0 ? (minVal / v) * 100 : 50);
        return (
          <div key={di} className="peer-chart-dim">
            <div className="peer-chart-dim-label">{dim.label}</div>
            <div className="peer-chart-bars">
              {dim.vals.map((v, bi) => (
                <div key={bi} className="peer-chart-bar-group">
                  <div className="peer-chart-bar-track">
                    <motion.div
                      className={`peer-chart-bar-fill peer-chart-bar--${bi === 0 ? 'subject' : bi === 1 ? 'avg' : 'best'}`}
                      initial={{ height: 0 }}
                      animate={vis && started ? { height: `${scale(v)}%` } : {}}
                      transition={{ delay: di * 0.1 + bi * 0.06, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="peer-chart-bar-val">{dim.unit}{dim.format(v)}</div>
                  <div className="peer-chart-bar-label">{BAR_LABELS[bi]}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── PEER COMPARISON ───────────────────────────────────────────────────────── */
const PeerComparison = memo(function PeerComparison({ peers, results, started }) {
  const [ref, vis] = useReveal();
  const subject = peers.find(p => p.isSubject);
  const comps   = peers.filter(p => !p.isSubject);
  if (!subject) return null;

  const allMids  = peers.map(p => (p.mv_low + p.mv_high) / 2);
  const median   = allMids.sort((a,b)=>a-b)[Math.floor(allMids.length/2)];
  const subMid   = (subject.mv_low + subject.mv_high) / 2;
  const relation = subMid > median * 1.05 ? 'above the micromarket median'
                 : subMid < median * 0.95 ? 'below the micromarket median'
                 : 'in line with the micromarket median';

  return (
    <div className="peers-section" ref={ref}>
      <div className="section-eyebrow-res">Peer comparison</div>
      {results.lat && results.lng && (
        <Suspense fallback={<div className="lazy-spinner-wrap"><div className="lazy-spinner" /></div>}>
          <PropertyMap
            lat={results.lat}
            lng={results.lng}
            address={results.address}
            rpi={results.rpi}
            zone={results.zone}
          />
        </Suspense>
      )}
      <PeerComparisonChart results={results} started={vis && started} />
      <MicromarketStrip results={results} />
      <div className="peers-grid">
        {[...comps.slice(0,1), subject, ...comps.slice(1)].map((p, i) => (
          <motion.div key={i}
            className={`peer-card ${p.isSubject ? 'peer-card--subject' : ''}`}
            initial={{ opacity: 0, y: 12 }}
            animate={vis && started ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16,1,0.3,1] }}
          >
            {p.isSubject && <div className="peer-subject-tag">Subject property</div>}
            <div className="peer-type">{p.label}</div>
            <div className="peer-area">{p.area?.toLocaleString('en-IN')} sq ft, {p.subtype || p.type}</div>
            <div className="peer-location">{p.isSubject ? (p.location?.split(',').slice(-2).join(',').trim() || p.location) : p.location}</div>
            <div className="peer-value">{formatINR(p.mv_low)} – {formatINR(p.mv_high)}</div>
            <div className="peer-rpi">RPI {p.rpi}</div>
          </motion.div>
        ))}
      </div>
      <p className="peers-note">
        The subject property is valued {relation} for comparable {subject.type || 'residential'} assets in this locality.
      </p>
    </div>
  );
});

/* ── CALIBRATION PANEL ─────────────────────────────────────────────────────── */
function CalibrationPanel() {
  const [open, setOpen] = useState(false);
  const cases = RESEARCH.calibrationCases;
  return (
    <div className="calib-section">
      <button className="calib-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="calib-title">How we validated this estimate</span>
        <svg className={`calib-chevron ${open ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="calib-body"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}
          >
            <table className="calib-table">
              <thead>
                <tr><th>Property</th><th>Known value</th><th>Engine estimate</th><th>Error</th></tr>
              </thead>
              <tbody>
                {cases.map((c, i) => {
                  const errNum = parseFloat(c.error);
                  const barColor = errNum < 10 ? '#16A34A' : errNum < 15 ? '#D97706' : '#DC2626';
                  return (
                    <tr key={i}>
                      <td>
                        <div className="calib-prop">{c.location}</div>
                        <div className="calib-prop-sub">{c.type}, {c.area.toLocaleString('en-IN')} sq ft</div>
                      </td>
                      <td className="calib-mono">{c.known}</td>
                      <td className="calib-mono">{c.engine}</td>
                      <td>
                        <div className="calib-error-row">
                          <div className="calib-error-track">
                            <div className="calib-error-bar" style={{ width: `${Math.min(errNum / 20 * 100, 100)}%`, background: barColor }} />
                          </div>
                          <span className="calib-error-pct" style={{ color: barColor }}>{c.error}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="calib-summary">
              Across eight benchmark properties in six Indian cities, the engine estimates fall within an average of 8.5% of the independently verified market value.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── AUDIT SECTION ─────────────────────────────────────────────────────────── */
function AuditSection({ results, onReset }) {
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [shareToast,   setShareToast]   = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { exportValuationMemo } = await import('../engine/pdfExport');
      exportValuationMemo(results, results.inputs || {});
    } catch (err) {
      console.error('[PDF] export failed', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${results.valuationId}`;
    try { await navigator.clipboard.writeText(url); }
    catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  // Feature 3 — WhatsApp share (opens modal for phone-targeted send)
  const handleWhatsApp = () => setShowSendModal(true);

  // Feature 4 — Compliance Audit JSON export
  const handleExportAuditJSON = () => {
    const audit = {
      auditVersion:  '2.0',
      generatedAt:   new Date().toISOString(),
      valuationId:   results.valuationId,
      modelVersion:  results.modelVersion || 'v3.0',
      inputs: {
        address:           results.address,
        lat:               results.lat,
        lng:               results.lng,
        propertyType:      results.propertyType,
        subtype:           results.subtype,
        areaSqft:          results.areaSqft || results.area,
        floorNumber:       results.floorNumber || results.floor,
        ageBand:           results.ageBand || results.age,
        occupancy:         results.occupancy,
        legalStatus:       results.legalStatus || results.legal,
        circleRatePerSqft: results.circleRatePerSqft,
        zone:              results.zone,
        zoneConfidence:    results.zoneConfidence,
      },
      intermediates: {
        allAdjustments: results.allAdjustments,
        infraScore:     results.infraScore,
        localityGrade:  results.localityGrade,
      },
      outputs: {
        mv_low:               results.mv_low,
        mv_high:              results.mv_high,
        mv_mid:               results.mv_mid,
        dv_low:               results.dv_low,
        dv_high:              results.dv_high,
        rpi:                  results.rpi,
        ttl_low:              results.ttl_low,
        ttl_high:             results.ttl_high,
        collateralHealthScore: results.collateralHealthScore,
      },
      confidence: {
        score:   results.confidenceScore,
        tier:    results.confidenceTier,
        drivers: results.confidenceDrivers,
      },
      fraud: {
        riskLevel: results.fraudRiskLevel,
        flags:     results.fraudFlags,
      },
      decision: {
        verdict:         results.verdictCode,
        verdictLabel:    results.verdictLabel,
        ltvBand:         results.ltvBand,
        decisionReasons: results.decisionReasons,
        escalationFlags: results.escalationFlags,
        decisionMemo:    results.decisionMemo,
      },
      dataLineage: {
        geocoding:      'nominatim.openstreetmap.org',
        infrastructure: 'overpass-api.de',
        circleRates:    'karnataka_sro_2024',
        valuation:      'collatiq_engine_v2',
      },
    };
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Collatiq-Audit-${results.valuationId || 'report'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ts = results.timestamp
    ? new Date(results.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  return (
    <div className="audit-section">
      <div className="section-eyebrow-res">Audit trail</div>
      <div className="audit-grid">
        <div className="audit-item">
          <span className="audit-key">Valuation ID</span>
          <span className="audit-val mono">{results.valuationId || '—'}</span>
        </div>
        <div className="audit-item">
          <span className="audit-key">Generated at</span>
          <span className="audit-val mono">{ts}</span>
        </div>
        <div className="audit-item">
          <span className="audit-key">Model version</span>
          <span className="audit-val mono">{results.modelVersion || 'v3.0'}</span>
        </div>
        <div className="audit-item">
          <span className="audit-key">Property type</span>
          <span className="audit-val">{results.propertyType} / {results.subtype}</span>
        </div>
      </div>
      <div className="audit-actions">
        <button className="audit-btn-primary" onClick={handleExportPDF} disabled={pdfLoading} aria-label="Export PDF memo">
          {pdfLoading ? 'Generating memo…' : 'Export PDF memo'}
          {!pdfLoading && (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 9v2.5h9V9M6.5 2v7M4 5.5l2.5-3 2.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button className="audit-btn-ghost" onClick={copyShareLink}>
          Copy share link
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 7.5a3 3 0 004.5 0l1-1a3 3 0 00-4.24-4.24l-.53.52" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M8 5.5a3 3 0 00-4.5 0l-1 1a3 3 0 004.24 4.24l.52-.52" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="whatsapp-btn" onClick={handleWhatsApp}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.686-.488-5.239-1.342l-.375-.222-3.876.923.955-3.77-.244-.388A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          Share on WhatsApp
        </button>
        <button className="audit-btn-json" onClick={handleExportAuditJSON}>
          Export Audit JSON
        </button>
        <button className="audit-btn-ghost" onClick={onReset}>Assess another property</button>
      </div>
      <AnimatePresence>
        {shareToast && (
          <motion.div className="pdf-toast"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          >
            Share link copied. Anyone with this link can view this report.
          </motion.div>
        )}
      </AnimatePresence>
      {showSendModal && <SendReportModal results={results} onClose={() => setShowSendModal(false)} />}
    </div>
  );
}

/* ── SEND REPORT MODAL ─────────────────────────────────────────────────────── */
function SendReportModal({ results, onClose }) {
  const [phone,    setPhone]    = useState('');
  const [channel,  setChannel]  = useState('whatsapp');
  const [status,   setStatus]   = useState('idle'); // idle | sending | sent | error
  const [errMsg,   setErrMsg]   = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (!phone.replace(/\D/g, '').match(/^\d{10,12}$/)) {
      setErrMsg('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setErrMsg('');
    setStatus('sending');
    try {
      const res = await sendReport(phone, results, channel);
      if (res.ok) {
        setStatus('sent');
      } else if (res.fallback) {
        // openWhatsAppWeb already called inside sendReport for whatsapp fallback
        if (channel === 'sms') {
          setErrMsg('SMS service is not configured. Ask your admin to set REACT_APP_MSG91_AUTH_KEY.');
          setStatus('error');
        } else {
          setStatus('sent');
        }
      } else {
        setErrMsg(res.error || 'Could not send. Please try again.');
        setStatus('error');
      }
    } catch (e) {
      setErrMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="srm-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div className="srm-card"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <button className="srm-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>

          {status === 'sent' ? (
            <div className="srm-success">
              <div className="srm-success-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="#16A34A" strokeWidth="1.5"/>
                  <path d="M8 14l4 4 8-8" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="srm-success-title">Report sent</div>
              <div className="srm-success-sub">
                {channel === 'whatsapp'
                  ? 'WhatsApp opened with the report summary.'
                  : `SMS sent to ${phone}.`}
              </div>
              <button className="srm-done-btn" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="srm-header">
                <div className="srm-eyebrow">Send report</div>
                <h3 className="srm-title">Share this assessment</h3>
                <p className="srm-sub">Send the valuation summary to a borrower, advisor, or colleague.</p>
              </div>

              <div className="srm-channel-toggle">
                <button
                  className={`srm-ch-btn ${channel === 'whatsapp' ? 'active' : ''}`}
                  onClick={() => setChannel('whatsapp')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                  </svg>
                  WhatsApp
                </button>
                <button
                  className={`srm-ch-btn ${channel === 'sms' ? 'active' : ''}`}
                  onClick={() => setChannel('sms')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="2" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 12h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <path d="M4 6h6M4 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  SMS (MSG91)
                </button>
              </div>

              <div className="srm-input-group">
                <label className="srm-input-label">Mobile number</label>
                <div className="srm-input-wrap">
                  <span className="srm-prefix">+91</span>
                  <input
                    ref={inputRef}
                    className="srm-input"
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setErrMsg(''); setStatus('idle'); }}
                    maxLength={14}
                  />
                </div>
                {errMsg && <div className="srm-error">{errMsg}</div>}
              </div>

              <button
                className="srm-send-btn"
                onClick={handleSend}
                disabled={status === 'sending'}
              >
                {status === 'sending' ? (
                  'Sending…'
                ) : channel === 'whatsapp' ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.686-.488-5.239-1.342l-.375-.222-3.876.923.955-3.77-.244-.388A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    Send via WhatsApp
                  </>
                ) : (
                  'Send SMS'
                )}
              </button>

              <p className="srm-privacy">
                The number is only used to deliver this report and is never stored.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── BORROWER VIEW (Feature 6) ─────────────────────────────────────────────── */
function EMICalculator({ loanMid }) {
  const [tenure,  setTenure]  = useState(15);
  const [ratePct, setRatePct] = useState(9.5);

  const monthlyRate = ratePct / 100 / 12;
  const months      = tenure * 12;
  const emi = loanMid > 0 && monthlyRate > 0
    ? Math.round((loanMid * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1))
    : 0;

  const fmt = (v) => {
    if (v >= 100000)  return `₹${(v / 100000).toFixed(1)}L/mo`;
    if (v >= 10000)   return `₹${(v / 1000).toFixed(1)}K/mo`;
    return `₹${v.toLocaleString('en-IN')}/mo`;
  };

  return (
    <div className="bv-emi-card">
      <div className="bv-emi-eyebrow">EMI calculator</div>
      <div className="bv-emi-result">{emi > 0 ? fmt(emi) : '—'}</div>
      <div className="bv-emi-note">estimated monthly payment</div>
      <div className="bv-emi-controls">
        <div className="bv-emi-row">
          <span className="bv-emi-label">Loan tenure</span>
          <div className="bv-emi-slider-wrap">
            <input type="range" min="5" max="30" step="1" value={tenure}
              onChange={e => setTenure(+e.target.value)}
              className="bv-emi-slider" style={{ '--v': ((tenure - 5) / 25) * 100 }}
            />
            <span className="bv-emi-slider-val">{tenure} yr</span>
          </div>
        </div>
        <div className="bv-emi-row">
          <span className="bv-emi-label">Interest rate</span>
          <div className="bv-emi-slider-wrap">
            <input type="range" min="7" max="14" step="0.5" value={ratePct}
              onChange={e => setRatePct(+e.target.value)}
              className="bv-emi-slider" style={{ '--v': ((ratePct - 7) / 7) * 100 }}
            />
            <span className="bv-emi-slider-val">{ratePct}%</span>
          </div>
        </div>
      </div>
      <p className="bv-emi-disclaimer">
        Indicative only. Actual EMI depends on lender, credit score, and processing fees.
      </p>
    </div>
  );
}

function BorrowerView({ results, onReset }) {
  const [showModal, setShowModal] = useState(false);
  const code = getVerdictCode(results);

  const verdict = {
    SANCTION_RECOMMENDED: {
      heading: 'Your property looks strong',
      sub: 'This property meets standard lending criteria. You are in a good position to apply for a home loan.',
      color: '#16A34A', bg: '#F0FDF4', icon: '✓', pillText: 'Good for loan',
    },
    CONDITIONAL_REVIEW: {
      heading: 'Your property needs some attention',
      sub: 'There are a few items your lender will want to verify. Address these before applying to improve your chances.',
      color: '#D97706', bg: '#FFFBEB', icon: '!', pillText: 'Conditional',
    },
    HIGH_RISK: {
      heading: 'This property has significant concerns',
      sub: 'Several risk factors were identified. You should resolve these before approaching a lender.',
      color: '#DC2626', bg: '#FEF2F2', icon: '!', pillText: 'High Risk',
    },
    REJECT: {
      heading: 'This property is not suitable for a loan',
      sub: 'The assessment found critical issues. Consult a property lawyer before taking any further steps.',
      color: '#DC2626', bg: '#FEF2F2', icon: '✕', pillText: 'Not eligible',
    },
  };
  const v = verdict[code] || verdict.SANCTION_RECOMMENDED;

  const ltvMatch = (results.ltvBand || '').match(/(\d+)[–-](\d+)/);
  const ltvLow  = ltvMatch ? parseInt(ltvMatch[1]) : 55;
  const ltvHigh = ltvMatch ? parseInt(ltvMatch[2]) : 65;
  const rawLoanLow  = Math.round((results.mv_low  || 0) * ltvLow  / 100);
  const rawLoanHigh = Math.round((results.mv_high || 0) * ltvHigh / 100);
  const loanMid = Math.round((rawLoanLow + rawLoanHigh) / 2);

  const posDrivers = (results.confidenceDrivers || []).filter(d => d.impact === 'positive').slice(0, 3);
  const negDrivers = (results.confidenceDrivers || []).filter(d => d.impact === 'negative').slice(0, 2);

  const healthScore = results.collateralHealthScore;
  const healthLabel = healthScore >= 700 ? 'Strong'
    : healthScore >= 550 ? 'Fair'
    : healthScore >= 400 ? 'Weak'
    : 'Poor';
  const healthColor = healthScore >= 700 ? '#16A34A'
    : healthScore >= 550 ? '#D97706'
    : '#DC2626';

  const nextSteps = code === 'SANCTION_RECOMMENDED'
    ? [
        'Share this report with your preferred lender or bank.',
        'Ensure your property documents (title deed, EC, building plan) are in order.',
        'Request a physical inspection for the final sanction.',
      ]
    : code === 'CONDITIONAL_REVIEW'
    ? [
        'Resolve any documentation gaps highlighted in this report.',
        'Get an encumbrance certificate and verify the legal chain.',
        'Request a physical inspection before submitting to your lender.',
      ]
    : [
        'Consult a property lawyer to address the risk flags.',
        'Do not apply for a loan until the issues are resolved.',
        'Request a re-assessment once the concerns are addressed.',
      ];

  return (
    <div className="borrower-view">

      {/* Hero verdict card */}
      <div className="bv-verdict-card" style={{ background: v.bg, borderColor: v.color + '40' }}>
        <div className="bv-verdict-icon-wrap" style={{ background: v.color + '20', color: v.color }}>
          {v.icon}
        </div>
        <div className="bv-verdict-body">
          <div className="bv-verdict-pill" style={{ background: v.color + '18', color: v.color, borderColor: v.color + '40' }}>
            {v.pillText}
          </div>
          <h1 className="bv-hero-heading" style={{ color: v.color }}>{v.heading}</h1>
          <p className="bv-verdict-sub">{v.sub}</p>
        </div>
      </div>

      {/* Property value + health score row */}
      <div className="bv-value-row">
        <div className="bv-value-card bv-value-card--main">
          <div className="bv-value-eyebrow">Estimated market value</div>
          <div className="bv-value-range">
            <span className="bv-value-num">{formatINR(results.mv_low)}</span>
            <span className="bv-value-sep">to</span>
            <span className="bv-value-num">{formatINR(results.mv_high)}</span>
          </div>
          <div className="bv-value-address">{results.address?.split(',').slice(0, 3).join(', ')}</div>
        </div>
        {healthScore && (
          <div className="bv-value-card bv-value-card--health">
            <div className="bv-value-eyebrow">Property health</div>
            <div className="bv-health-score" style={{ color: healthColor }}>{healthScore}</div>
            <div className="bv-health-label" style={{ color: healthColor }}>{healthLabel}</div>
            <div className="bv-health-sub">out of 850</div>
          </div>
        )}
      </div>

      {/* Loan eligibility card */}
      <div className="bv-loan-card">
        <div className="bv-loan-header">
          <div className="bv-loan-eyebrow">Estimated loan eligibility</div>
          <div className="bv-loan-badge">
            {ltvLow}–{ltvHigh}% LTV
          </div>
        </div>
        <div className="bv-loan-range">
          <span className="bv-loan-num">{formatINR(rawLoanLow)}</span>
          <span className="bv-loan-sep">to</span>
          <span className="bv-loan-num">{formatINR(rawLoanHigh)}</span>
        </div>
        <p className="bv-disclaimer">
          Indicative estimate only. Actual loan amount depends on your income, credit score, and lender policy.
        </p>
      </div>

      {/* EMI Calculator */}
      {rawLoanLow > 0 && <EMICalculator loanMid={loanMid} />}

      {/* What works / what to address */}
      {(posDrivers.length > 0 || negDrivers.length > 0) && (
        <div className="bv-drivers-row">
          {posDrivers.length > 0 && (
            <div className="bv-drivers-col">
              <div className="bv-drivers-label bv-drivers-label--pos">What works in your favour</div>
              {posDrivers.map((d, i) => (
                <div key={i} className="bv-check-row">
                  <span className="bv-check-icon bv-check-icon--pos">✓</span>
                  <span className="bv-check-text">{d.reason}</span>
                </div>
              ))}
            </div>
          )}
          {negDrivers.length > 0 && (
            <div className="bv-drivers-col">
              <div className="bv-drivers-label bv-drivers-label--neg">What to address</div>
              {negDrivers.map((d, i) => (
                <div key={i} className="bv-check-row">
                  <span className="bv-check-icon bv-check-icon--neg">!</span>
                  <span className="bv-check-text">{d.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share section */}
      <div className="bv-share-section">
        <div className="bv-share-eyebrow">Share this report</div>
        <p className="bv-share-sub">Send the valuation summary to your lender, family, or financial advisor.</p>
        <div className="bv-share-actions">
          <button className="bv-share-btn bv-share-btn--wa" onClick={() => setShowModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
            </svg>
            Send via WhatsApp
          </button>
          <button className="bv-share-btn bv-share-btn--ghost"
            onClick={() => openWhatsAppWeb('', results)}
          >
            Share without number
          </button>
        </div>
      </div>

      {/* Next steps */}
      <div className="bv-next-section">
        <div className="bv-next-eyebrow">Recommended next steps</div>
        <div className="bv-steps">
          {nextSteps.map((step, i) => (
            <div key={i} className="bv-step">
              <span className="bv-step-num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="bv-reset-btn" onClick={onReset}>Assess another property</button>

      {showModal && <SendReportModal results={results} onClose={() => setShowModal(false)} />}
    </div>
  );
}

/* ── AUTO-SAVE INDICATOR ───────────────────────────────────────────────────── */
function AutoSaveIndicator({ status }) {
  if (!status) return null;
  return (
    <AnimatePresence>
      <motion.div
        className={`autosave-indicator autosave-indicator--${status}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        {status === 'saved' ? (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1"/>
              <path d="M4 6.5l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Assessment saved locally on this device
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1"/>
              <path d="M6.5 4v3M6.5 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Could not save locally
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── NEXT BEST ACTIONS ─────────────────────────────────────────────────────── */
const ACTION_RULES = [
  {
    test: r => (r.confidenceScore ?? 100) < 55,
    action: { label: 'Request physical inspection', reason: 'Confidence is low. Field verification will improve accuracy.' },
  },
  {
    test: r => (r.ltvBand || '').includes('30') || (r.ltvBand || '').includes('40'),
    action: { label: 'Apply conservative LTV ceiling', reason: 'Distress exit value is materially below market value. Cap exposure accordingly.' },
  },
  {
    test: r => (r.fraudRiskLevel === 'high' || r.fraudRiskLevel === 'medium'),
    action: { label: 'Verify title deed and sanctioned plan', reason: 'One or more anomaly flags were raised. Due diligence is required before sanction.' },
  },
  {
    test: r => (r.ttl_low ?? 0) > 90,
    action: { label: 'Factor in extended liquidation timeline', reason: 'Time-to-liquidate exceeds 90 days. Stress scenarios should extend recovery period.' },
  },
  {
    test: r => (r.legal === 'unknown' || r.legal === 'complex'),
    action: { label: 'Verify legal chain before sanction', reason: 'Legal status is unclear. Obtain registered title documents and encumbrance certificate.' },
  },
  {
    test: r => (r.rpi ?? 100) < 50,
    action: { label: 'Apply enhanced due diligence for this low liquidity asset', reason: 'Resale Potential Index is below 50. This asset has limited exit options.' },
  },
  {
    test: r => (r.confidenceScore ?? 100) >= 75 && (r.rpi ?? 0) >= 65 && r.fraudRiskLevel === 'clean',
    action: { label: 'Proceed to document collection', reason: 'All signals are strong. Standard sanction process can proceed.' },
  },
];

function NextBestActions({ results }) {
  const actions = ACTION_RULES.filter(rule => rule.test(results)).map(r => r.action).slice(0, 4);
  if (actions.length === 0) return null;
  return (
    <div className="nba-section">
      <div className="section-eyebrow-res">Recommended next actions</div>
      <div className="nba-list">
        {actions.map((a, i) => (
          <div key={i} className="nba-item">
            <div className="nba-num">{i + 1}</div>
            <div className="nba-body">
              <div className="nba-label">{a.label}</div>
              <div className="nba-reason">{a.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── LOCATION VERIFICATION ─────────────────────────────────────────────────── */
function LocationVerification({ results }) {
  const hasCoords   = !!(results.lat && results.lng);
  const zone        = results.circleRateZone || results.zone || null;
  const infra       = results.infraScore != null;
  const cr          = results.circleRate || results.ratePerSqft;
  const fallback    = results.circleFallback ?? false;

  const coverageTier = hasCoords && zone && infra && !fallback ? 'full'
                     : hasCoords && !fallback ? 'partial'
                     : 'geo-only';

  const rows = [
    { label: 'Address entered',       ok: !!(results.address), val: results.address ? results.address.split(',').slice(0, 2).join(',') : '—' },
    { label: 'Coordinates resolved',  ok: hasCoords,          val: hasCoords ? `${results.lat?.toFixed(4)}, ${results.lng?.toFixed(4)}` : 'Not resolved' },
    { label: 'Zone matched',          ok: !!zone,             val: zone || 'Not matched, using city fallback' },
    { label: 'Circle rate',           ok: !!cr,               val: cr ? `₹${Number(cr).toLocaleString('en-IN')}/sqft` : '—' },
    { label: 'Infrastructure signals',ok: infra,              val: infra ? `Score ${results.infraScore}/100, ${results.localityGrade || ''}` : 'Not available' },
    { label: 'Coverage level',        ok: coverageTier === 'full', val: coverageTier === 'full' ? 'Full coverage' : coverageTier === 'partial' ? 'Partial — some signals estimated' : 'Geo-only estimate' },
  ];

  return (
    <div className="locv-section">
      <div className="section-eyebrow-res">Location verification</div>
      <div className="locv-grid">
        {rows.map((row, i) => (
          <div key={i} className="locv-row">
            <span className={`locv-dot ${row.ok ? 'locv-dot--ok' : 'locv-dot--warn'}`} />
            <span className="locv-label">{row.label}</span>
            <span className="locv-val">{row.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SCENARIO BOOKMARKS ────────────────────────────────────────────────────── */
function ScenarioBookmarks({ onApply, activeId }) {
  return (
    <div className="scenario-bookmarks">
      <div className="scenario-bookmarks-label">Quick scenarios</div>
      <div className="scenario-chips">
        {SCENARIO_PRESETS.map(preset => (
          <button
            key={preset.id}
            className={`scenario-chip ${activeId === preset.id ? 'scenario-chip--active' : ''}`}
            onClick={() => onApply(preset)}
            title={preset.description}
          >
            <span className="sc-icon">{preset.icon}</span>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── SENSITIVITY DELTA PANEL ───────────────────────────────────────────────── */
function SensitivityDeltaPanel({ base, stressed, changes }) {
  if (!changes || changes.length === 0) return null;

  const mvDelta = (stressed.mv_low + stressed.mv_high) / 2 - (base.mv_low + base.mv_high) / 2;
  const dvDelta = (stressed.dv_low + stressed.dv_high) / 2 - (base.dv_low + base.dv_high) / 2;
  const rpiDelta = (stressed.rpi ?? 0) - (base.rpi ?? 0);
  const ttlDelta = ((stressed.ttl_low + stressed.ttl_high) / 2) - ((base.ttl_low + base.ttl_high) / 2);

  function fmtDelta(val, isMonetary) {
    if (Math.abs(val) < 1) return null;
    const sign = val > 0 ? '+' : '';
    if (isMonetary) {
      const abs = Math.abs(val);
      const str = abs >= 100000 ? `${(abs / 100000).toFixed(1)}L` : val.toLocaleString('en-IN');
      return `${sign}₹${str}`;
    }
    return `${sign}${Math.round(val)}`;
  }

  const color = (val) => val > 0 ? '#16A34A' : val < 0 ? '#DC2626' : '#9B9B95';

  const deltas = [
    { label: 'Market value (mid)',   raw: mvDelta,  display: fmtDelta(mvDelta, true),    unit: '' },
    { label: 'Distress value (mid)', raw: dvDelta,  display: fmtDelta(dvDelta, true),    unit: '' },
    { label: 'RPI',                  raw: rpiDelta, display: fmtDelta(rpiDelta, false),  unit: ' pts' },
    { label: 'Liquidation time',     raw: -ttlDelta, display: ttlDelta !== 0 ? `${ttlDelta > 0 ? '+' : ''}${Math.round(ttlDelta)} days` : null, unit: '' },
  ].filter(d => d.display !== null);

  return (
    <div className="sdelta-panel">
      <div className="sdelta-title">Impact of scenario change</div>
      <div className="sdelta-metrics">
        {deltas.map((d, i) => (
          <div key={i} className="sdelta-metric">
            <div className="sdelta-label">{d.label}</div>
            <div className="sdelta-val" style={{ color: color(d.raw) }}>{d.display}{d.unit}</div>
          </div>
        ))}
      </div>
      <div className="sdelta-explanations">
        {changes.map((line, i) => (
          <div key={i} className="sdelta-line">
            <span className="sdelta-dot" />
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ROOT COMPONENT ────────────────────────────────────────────────────────── */
export default function ResultsScreen({ results, onReset, saveStatus, onViewRecent, onRerun }) {
  const [started,       setStarted]       = useState(false);
  const [stressed,      setStressed]       = useState(results);
  const [sensitivity,   setSensitivity]    = useState({ legal: 0, occupancy: 0, demand: 0 });
  const [, setPrevSensitivity] = useState({ legal: 0, occupancy: 0, demand: 0 });
  const [scenarioId,    setScenarioId]     = useState('base');
  const [deltaChanges,  setDeltaChanges]   = useState([]);
  const [viewMode,      setViewMode]       = useState('lender');
  const [isMobile,      setIsMobile]       = useState(window.innerWidth < 480);
  const [openSections,  setOpenSections]   = useState([false, false, false, false, false]);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleSection = (idx) => {
    setOpenSections(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  const handleStress = (newSensitivity) => {
    setPrevSensitivity(sensitivity);
    setSensitivity(newSensitivity);
    setStressed(applyStress(results, newSensitivity));
    setDeltaChanges(explainChanges(sensitivity, newSensitivity));
    setScenarioId('custom');
  };

  const handleScenario = (preset) => {
    setPrevSensitivity(sensitivity);
    setSensitivity(preset.sensitivity);
    setStressed(applyStress(results, preset.sensitivity));
    setDeltaChanges(explainChanges(sensitivity, preset.sensitivity));
    setScenarioId(preset.id);
  };
  const handleExportPDF = async () => {
    try {
      const { exportValuationMemo } = await import('../engine/pdfExport');
      exportValuationMemo(results, results.inputs || {});
    } catch (err) {
      console.error('[PDF] export failed', err);
    }
  };

  const [rpiRef, rpiVis] = useReveal();
  const [driverRef, driverVis] = useReveal();
  const [wfRef, wfVis] = useReveal();

  const peers = results.peers && results.peers.length >= 2 ? results.peers : generateFallbackPeers(results);
  const enrichedResults = { ...results, peers };

  const healthScore = results.collateralHealthScore;
  const healthBand  = results.collateralHealthBand;

  // Mobile whatsapp shortcut for bottom bar
  const handleWhatsAppMobile = () => {
    const shareUrl = `${window.location.origin}/?v=${results.valuationId}`;
    const msg = encodeURIComponent([
      'COLLATIQ VALUATION REPORT', results.address || '', '',
      `Market Value: ${formatINR(results.mv_low)} – ${formatINR(results.mv_high)}`,
      `Verdict: ${results.verdictLabel || results.verdict || '—'}`,
      `Health Score: ${results.collateralHealthScore ?? '—'} / 850`,
      '', `Full report: ${shareUrl}`,
    ].join('\n'));
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (viewMode === 'borrower') {
    return (
      <div className="results-screen" id="results-main">
        <StickyBar results={stressed} onReset={onReset} onRerun={onRerun} hideNav />
        {healthScore && <CollateralHealthBanner score={healthScore} band={healthBand} />}
        <div className="view-toggle-wrap" role="tablist" aria-label="View mode">
          <button className={`view-toggle-pill ${viewMode === 'lender' ? 'active' : ''}`} role="tab" aria-selected={viewMode === 'lender'} onClick={() => setViewMode('lender')}>Lender View</button>
          <button className={`view-toggle-pill ${viewMode === 'borrower' ? 'active' : ''}`} role="tab" aria-selected={viewMode === 'borrower'} onClick={() => setViewMode('borrower')}>Borrower Summary</button>
        </div>
        <BorrowerView results={results} onReset={onReset} />
      </div>
    );
  }

  const ACCORDION_SECTIONS = [
    { label: 'Confidence Intelligence', content: <ConfidenceDriversPanel results={stressed} started={started} /> },
    { label: 'Anomaly Detection',       content: <AnomalyDetectionPanel  results={results}  started={started} /> },
    { label: 'Decision Memo',           content: <DecisionMemoSection results={results} onExportPDF={handleExportPDF} /> },
    { label: 'Peer Comparison',         content: <PeerComparison peers={enrichedResults.peers} results={enrichedResults} started={started} /> },
    { label: 'Audit Trail',             content: <AuditSection results={results} onReset={onReset} /> },
  ];

  return (
    <div className={`results-screen ${isMobile ? 'results-mobile' : ''}`} id="results-main">
      <StickyBar results={stressed} onReset={onReset} onRerun={onRerun} />

      {/* Auto-save indicator */}
      <AutoSaveIndicator status={saveStatus} />

      {/* Collateral Health Score Banner */}
      {healthScore && <CollateralHealthBanner score={healthScore} band={healthBand} />}

      {/* View toggle */}
      <div className="view-toggle-wrap">
        <button className={`view-toggle-pill ${viewMode === 'lender' ? 'active' : ''}`} onClick={() => setViewMode('lender')}>Lender View</button>
        <button className={`view-toggle-pill ${viewMode === 'borrower' ? 'active' : ''}`} onClick={() => setViewMode('borrower')}>Borrower Summary</button>
      </div>

      <VerdictHero results={results} stressed={stressed} />

      <MetricGrid results={stressed} started={started} />

      {/* Location verification */}
      <div className="mobile-hidden">
        <LocationVerification results={results} />
      </div>

      {/* RPI + Value Drivers */}
      <div className="results-two-col mobile-hidden">
        <div ref={rpiRef}>
          <div className="section-eyebrow-res">Resale potential index</div>
          <RPIGauge rpi={stressed.rpi} started={rpiVis && started} />
        </div>
        <div ref={driverRef}>
          <div className="section-eyebrow-res">Value driver breakdown</div>
          <ValueDrivers drivers={results.drivers} started={driverVis && started} />
        </div>
      </div>

      <div className="results-section mobile-hidden" ref={wfRef}>
        <div className="section-eyebrow-res">Pricing factor waterfall</div>
        <WaterfallChart results={results} started={wfVis && started} />
      </div>

      {/* Confidence + Anomaly + Decision + Next Actions */}
      <div className="mobile-hidden">
        <ConfidenceDriversPanel results={stressed} started={started} />
        <AnomalyDetectionPanel  results={results}  started={started} />
        <NextBestActions results={results} />
        <DecisionMemoSection results={results} onExportPDF={handleExportPDF} />
      </div>

      {/* Scenario bookmarks + Sensitivity + Delta */}
      <div className="results-section results-section--alt mobile-hidden" id="section-sensitivity">
        <ScenarioBookmarks onApply={handleScenario} activeId={scenarioId} />
        <SensitivityDial baseResults={results} onStressChange={handleStress} />
        <StressedMetrics stressed={stressed} />
        <SensitivityDeltaPanel
          base={results}
          stressed={stressed}
          changes={deltaChanges}
        />
      </div>

      <div className="mobile-hidden">
        <PeerComparison peers={enrichedResults.peers} results={enrichedResults} started={started} />
        <CalibrationPanel />
        <AuditSection results={results} onReset={onReset} />
      </div>

      {/* Recent assessments link */}
      {onViewRecent && (
        <div className="results-recent-link mobile-hidden">
          <button className="rrl-btn" onClick={onViewRecent}>
            View all recent assessments →
          </button>
        </div>
      )}

      {/* Feature 7 — Mobile accordion */}
      {isMobile && (
        <div className="mobile-accordion">
          {ACCORDION_SECTIONS.map((sec, idx) => (
            <div key={idx} className="accordion-item">
              <button className="accordion-header" onClick={() => toggleSection(idx)}>
                <span className="accordion-label">{sec.label}</span>
                <span className="accordion-toggle">{openSections[idx] ? '−' : '+'}</span>
              </button>
              {openSections[idx] && (
                <div className="accordion-body">{sec.content}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feature 7 — Mobile bottom action bar */}
      {isMobile && (
        <div className="mobile-bottom-bar">
          <button className="mbb-btn" onClick={handleExportPDF}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 13v2.5h12V13M9 2v9M6 7.5l3-3.5 3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>PDF</span>
          </button>
          <button className="mbb-btn mbb-btn--wa" onClick={handleWhatsAppMobile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            <span>Share</span>
          </button>
          <button className="mbb-btn" onClick={onReset}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M15 9A6 6 0 1 1 9 3M15 3v6H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>New</span>
          </button>
        </div>
      )}

      <footer className="results-footnote">
        This report was generated by an automated valuation model. It is intended as decision support for trained lending professionals and does not constitute a certified property valuation. Physical inspection is recommended for any Conditional or High Risk verdict.
      </footer>
    </div>
  );
}
