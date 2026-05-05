import { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { runCollatiqPipeline } from '../engine/pipeline';
import './ProcessingScreen.css';

const BuildingScene = lazy(() => import('../scenes/BuildingScene'));

/* ── CONSTANTS ─────────────────────────────────────────────────────────────── */
const STEPS = [
  { id: 1, code: '01', short: 'Geocoding + infra',  detail: 'Resolves location and fetches circle rate from govt. SRO data across 19 Indian cities' },
  { id: 2, code: '02', short: 'Market valuation',    detail: 'Applies circle rate through a 17-factor adjustment chain'          },
  { id: 3, code: '03', short: 'Liquidity scoring',   detail: 'Runs the RPI model and time-to-liquidate regression'               },
  { id: 4, code: '04', short: 'Confidence scoring',  detail: 'Checks data completeness and signal alignment'                     },
  { id: 5, code: '05', short: 'Fraud detection',     detail: 'Runs the anomaly engine and flags suspicious patterns'              },
  { id: 6, code: '06', short: 'Decision synthesis',  detail: 'Determines the LTV band, final verdict and credit memo'            },
];

const STEP_DELAYS  = { 2: 550, 3: 460, 4: 400, 5: 360, 6: 320 };
const MIN_STEP1_MS = 3000;

const SCAN_MARKERS = [
  { x: 14, y: 24, label: 'Facade'    },
  { x: 76, y: 33, label: 'Structure' },
  { x: 42, y: 67, label: 'Entrance'  },
  { x: 83, y: 61, label: 'Context'   },
  { x: 27, y: 51, label: 'Layout'    },
];

/* ── HELPERS ───────────────────────────────────────────────────────────────── */
const wait = ms => new Promise(r => setTimeout(r, ms));

function formatINR(val) {
  if (!val) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

/* ── ANIMATED COUNT-UP ─────────────────────────────────────────────────────── */
function AnimCount({ to, duration = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = null;
    const tick = ts => {
      if (!start) start = ts;
      const p    = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * ease));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to, duration]); // eslint-disable-line
  return <>{v}</>;
}

/* ── STEP NODE ─────────────────────────────────────────────────────────────── */
function StepNode({ step, state, timestamp, isLast }) {
  return (
    <div className={`ps-step ps-step--${state}`}>
      <div className="ps-step-track">
        <div className="ps-step-node">
          {state === 'done' && (
            <motion.svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
              <path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </motion.svg>
          )}
          {state === 'active' && <div className="ps-step-spinner" />}
        </div>
        {!isLast && (
          <div className="ps-step-line">
            <motion.div className="ps-step-line-fill"
              animate={{ scaleY: state === 'done' ? 1 : 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>

      <div className="ps-step-body">
        <div className="ps-step-code">{step.code}</div>
        <div className="ps-step-short">{step.short}</div>
        <div className="ps-step-detail">
          {state === 'active'
            ? <span className="ps-step-detail--live">Analyzing…</span>
            : step.detail
          }
        </div>
        <AnimatePresence>
          {state === 'done' && timestamp && (
            <motion.div className="ps-step-ts"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {timestamp}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── DATA CARD ─────────────────────────────────────────────────────────────── */
function DataCard({ category, children, accent = '', d = 0, large = false, sub = '', half = false }) {
  return (
    <motion.div className={`ps-card${accent ? ` ps-card--${accent}` : ''}${half ? ' ps-card--half' : ''}`}
      initial={{ opacity: 0, x: 22, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: d, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      {category && <div className="ps-card-cat">{category}</div>}
      <div className={`ps-card-val${large ? ' ps-card-val--lg' : ''}`}>{children}</div>
      {sub && <div className="ps-card-sub">{sub}</div>}
    </motion.div>
  );
}

/* ── MARKET VALUE FEATURE CARD ─────────────────────────────────────────────── */
function MVCard({ results }) {
  return (
    <motion.div className="ps-card ps-card--feature"
      initial={{ opacity: 0, x: 22, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
      <div className="ps-card-cat">MARKET VALUE RANGE</div>
      <div className="ps-mv">
        <div className="ps-mv-col">
          <div className="ps-mv-tag">LOW</div>
          <div className="ps-mv-num">{formatINR(results.mv_low)}</div>
        </div>
        <div className="ps-mv-sep" />
        <div className="ps-mv-col">
          <div className="ps-mv-tag">HIGH</div>
          <div className="ps-mv-num">{formatINR(results.mv_high)}</div>
        </div>
      </div>
      <div className="ps-card-sub">
        Circle rate ₹{(results.circleRatePerSqft || results.baseRatePsf || 0).toLocaleString('en-IN')}/sq ft
      </div>
    </motion.div>
  );
}

/* ── VERDICT CARD ──────────────────────────────────────────────────────────── */
function VerdictCard({ results }) {
  const v      = results.verdictLabel || results.verdict || '';
  const green  = v.toLowerCase().includes('sanction');
  const amber  = v.toLowerCase().includes('conditional');
  const accent = green ? 'green' : amber ? 'amber' : 'red';
  return (
    <motion.div className={`ps-verdict ps-verdict--${accent}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
      <div className="ps-verdict-eyebrow">FINAL VERDICT</div>
      <div className="ps-verdict-text">{v}</div>
      <div className="ps-verdict-bottom">
        <div className="ps-verdict-ltv">
          <span className="ps-verdict-ltv-tag">RECOMMENDED LTV</span>
          <span className="ps-verdict-ltv-val">{results.ltvBand || results.ltv_band || '—'}</span>
        </div>
        <div className="ps-verdict-conf">
          <span className="ps-verdict-conf-num">
            <AnimCount to={results.confidenceScore ?? 0} />
          </span>
          <span className="ps-verdict-conf-tag">/ 100</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── FLAGS ─────────────────────────────────────────────────────────────────── */
function FlagsBlock({ flags }) {
  return (
    <motion.div className="ps-flags-block"
      initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <div className="ps-card-cat" style={{ marginBottom: 10 }}>FRAUD & ANOMALY SIGNALS</div>
      {flags.length === 0 ? (
        <div className="ps-flag ps-flag--clean">
          <span className="ps-flag-icon">✓</span>
          No anomaly signals detected
        </div>
      ) : flags.slice(0, 3).map((f, i) => (
        <motion.div key={i} className={`ps-flag ps-flag--${f.severity || 'low'}`}
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}>
          <span className="ps-flag-sev">{(f.severity || 'INFO').toUpperCase()}</span>
          <span className="ps-flag-txt">
            {(f.description ?? f.text ?? '').slice(0, 72)}
            {(f.description ?? f.text ?? '').length > 72 ? '…' : ''}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── PROPERTY PROFILE CARD ─────────────────────────────────────────────────── */
function ProfileItem({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="ps-profile-item">
      <span className="ps-profile-label">{label}</span>
      <span className="ps-profile-val">{value}</span>
    </div>
  );
}

function PropertyProfileCard({ formInputs, d = 0 }) {
  if (!formInputs) return null;
  const yr   = parseInt(formInputs.yearOfConstruction);
  const age  = yr > 1900 ? `${new Date().getFullYear() - yr} yrs` : null;
  const cond = formInputs.propertyCondition
    ? formInputs.propertyCondition.charAt(0).toUpperCase() + formInputs.propertyCondition.slice(1)
    : null;
  const ct = formInputs.constructionType?.replace(/_/g, ' ') || null;
  const khata = formInputs.khataType?.replace(/_/g, ' ') || null;
  const oc = formInputs.ocStatus === 'present' ? 'Available'
           : formInputs.ocStatus === 'absent'  ? 'Not available'
           : formInputs.ocStatus === 'na'      ? 'N/A'
           : null;
  const bhk = formInputs.bhkConfig?.toUpperCase() || null;

  return (
    <motion.div className="ps-card ps-card--profile"
      initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: d, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <div className="ps-card-cat">PROPERTY PROFILE</div>
      <div className="ps-profile-grid">
        <ProfileItem label="Built-up" value={formInputs.area ? `${parseFloat(formInputs.area).toLocaleString('en-IN')} sq ft` : null} />
        <ProfileItem label="Floor"    value={formInputs.floor ?? null} />
        {bhk && <ProfileItem label="Config" value={bhk} />}
        <ProfileItem label="Year built" value={yr > 1900 ? `${yr} (${age})` : null} />
        <ProfileItem label="Condition"  value={cond} />
        <ProfileItem label="Structure"  value={ct} />
        <ProfileItem label="Facing"     value={formInputs.facing?.replace(/_/g, '-') || null} />
        <ProfileItem label="Khata"      value={khata} />
        <ProfileItem label="OC"         value={oc} />
        {formInputs.amenities?.length > 0 && (
          <ProfileItem label="Amenities" value={`${formInputs.amenities.length} declared`} />
        )}
      </div>
    </motion.div>
  );
}

/* ── VALUATION DRIVERS MINI-CHART ──────────────────────────────────────────── */
function DriversCard({ drivers = [], d = 0 }) {
  const top = drivers
    .filter(dr => dr.impact !== 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 5);
  if (!top.length) return null;
  const maxAbs = Math.max(...top.map(dr => Math.abs(dr.impact)), 1);

  return (
    <motion.div className="ps-card ps-card--drivers"
      initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: d, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <div className="ps-card-cat">TOP VALUATION DRIVERS</div>
      <div className="ps-drivers">
        {top.map((dr, i) => {
          const pct = Math.abs(dr.impact) / maxAbs * 100;
          const pos = dr.dir > 0 || dr.impact > 0;
          return (
            <div key={i} className="ps-driver-row">
              <span className="ps-driver-label">{dr.label}</span>
              <div className="ps-driver-bar-wrap">
                <div
                  className={`ps-driver-bar ${pos ? 'ps-driver-bar--pos' : 'ps-driver-bar--neg'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`ps-driver-impact ${pos ? 'pos' : 'neg'}`}>
                {pos ? '+' : ''}{dr.impact}%
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── PHOTO SCANNER ─────────────────────────────────────────────────────────── */
function PhotoScanner({ photos, completedSteps, formInputs }) {
  const [idx,       setIdx]       = useState(0);
  const [markersOn, setMarkersOn] = useState(false);

  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx(p => (p + 1) % photos.length), 4200);
    return () => clearInterval(t);
  }, [photos.length]);

  useEffect(() => {
    if (completedSteps.has(1)) setTimeout(() => setMarkersOn(true), 800);
  }, [completedSteps]);

  const shortAddr = formInputs?.address
    ? formInputs.address.split(',').slice(0, 2).join(',').trim()
    : 'Location scanning…';

  return (
    <div className="ps-scanner">
      {/* Cycling property photo */}
      <AnimatePresence mode="crossfade">
        <motion.img key={idx} src={photos[idx]} alt=""
          className="ps-scanner-photo"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </AnimatePresence>

      {/* Overlays */}
      <div className="ps-scanner-dim" />
      <div className="ps-scanner-grid" />

      {/* Viewfinder corner brackets */}
      {['tl','tr','bl','br'].map(c => (
        <div key={c} className={`ps-corner ps-corner--${c}`} />
      ))}

      {/* Sweeping scan line */}
      <div className="ps-scan-line" />

      {/* Analysis markers — appear after geocoding */}
      <AnimatePresence>
        {markersOn && SCAN_MARKERS.map((m, i) => (
          <motion.div key={i} className="ps-marker"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.16, type: 'spring', stiffness: 340, damping: 22 }}>
            <div className="ps-marker-ring" />
            <div className="ps-marker-dot" />
            <div className="ps-marker-label">{m.label}</div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Top status badge */}
      <div className="ps-scanner-status">
        <div className="ps-scanner-pulse" />
        <span>SCANNING PROPERTY</span>
      </div>

      {/* Location pill after step 1 */}
      <AnimatePresence>
        {completedSteps.has(1) && (
          <motion.div className="ps-scanner-loc"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            <svg width="8" height="11" viewBox="0 0 8 11" fill="currentColor">
              <path d="M4 0C1.8 0 0 1.8 0 4c0 2.7 4 7 4 7s4-4.3 4-7C8 1.8 6.2 0 4 0z"/>
            </svg>
            {shortAddr}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo strip dots */}
      {photos.length > 1 && (
        <div className="ps-dots">
          {photos.map((_, i) => (
            <div key={i} className={`ps-dot${i === idx ? ' ps-dot--on' : ''}`} />
          ))}
        </div>
      )}

      {/* Radius rings appear after geocoding */}
      <AnimatePresence>
        {completedSteps.has(1) && (
          <motion.div className="ps-rings"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}>
            <div className="ps-ring ps-ring--1" />
            <div className="ps-ring ps-ring--2" />
            <div className="ps-ring ps-ring--3" />
            <span className="ps-ring-label">1500M RADIUS</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── 3D FALLBACK (no photos) ───────────────────────────────────────────────── */
function Scene3D({ formInputs, completedSteps }) {
  return (
    <div className="ps-3d">
      <Suspense fallback={<div className="ps-3d-loader"><div className="ps-3d-spin" /></div>}>
        <BuildingScene mouseX={0} mouseY={0}
          propertyType={formInputs?.type}
          subType={formInputs?.subtype}
          staticCamera
        />
      </Suspense>
      <div className="ps-3d-overlay" />
      <div className="ps-scan-line" />

      <div className="ps-scanner-status">
        <div className="ps-scanner-pulse" />
        <span>SCANNING PROPERTY</span>
      </div>

      <AnimatePresence>
        {completedSteps.has(1) && (
          <motion.div className="ps-scanner-loc"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <svg width="8" height="11" viewBox="0 0 8 11" fill="currentColor">
              <path d="M4 0C1.8 0 0 1.8 0 4c0 2.7 4 7 4 7s4-4.3 4-7C8 1.8 6.2 0 4 0z"/>
            </svg>
            {formInputs?.address?.split(',').slice(0,2).join(',').trim() || 'Location resolved'}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completedSteps.has(1) && (
          <motion.div className="ps-rings"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}>
            <div className="ps-ring ps-ring--1" />
            <div className="ps-ring ps-ring--2" />
            <div className="ps-ring ps-ring--3" />
            <span className="ps-ring-label">1500M RADIUS</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════════════════════════ */
export default function ProcessingScreen({ formInputs, onComplete, onBack }) {
  const [currentStep,    setCurrentStep]  = useState(0);
  const [completedSteps, setCompleted]    = useState(new Set());
  const [done,           setDone]         = useState(false);
  const [results,        setResults]      = useState(null);
  const [failed,         setFailed]       = useState(false);
  const [timestamps,     setTimestamps]   = useState({});
  const startMs = useRef(Date.now());
  const cancelRef = useRef(false);
  const rightRef  = useRef(null);

  const photos = useMemo(() =>
    (formInputs?._imageFiles || []).map(f => f.preview).filter(Boolean).slice(0, 6),
    [formInputs] // eslint-disable-line
  );

  const ts = () => `+${((Date.now() - startMs.current) / 1000).toFixed(2)}s`;

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      setCurrentStep(1);

      let computed = null;
      try {
        [computed] = await Promise.all([runCollatiqPipeline(formInputs), wait(MIN_STEP1_MS)]);
      } catch (err) {
        console.error('[ProcessingScreen] pipeline error:', err);
        await wait(MIN_STEP1_MS);
      }

      if (cancelRef.current) return;
      if (!computed) { setFailed(true); return; }

      setResults(computed);
      setCompleted(p => new Set([...p, 1]));
      setTimestamps(p => ({ ...p, 1: ts() }));

      for (const id of [2, 3, 4, 5, 6]) {
        if (cancelRef.current) return;
        setCurrentStep(id);
        await wait(STEP_DELAYS[id]);
        if (cancelRef.current) return;
        setCompleted(p => new Set([...p, id]));
        setTimestamps(p => ({ ...p, [id]: ts() }));
      }

      await wait(900);
      if (cancelRef.current) return;
      setDone(true);
      // No auto-navigate — user must click "View Full Report" to proceed
    };

    run();
    return () => { cancelRef.current = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (rightRef.current)
      rightRef.current.scrollTo({ top: rightRef.current.scrollHeight, behavior: 'smooth' });
  }, [completedSteps]);

  const st = id =>
    completedSteps.has(id) ? 'done' : currentStep === id ? 'active' : 'pending';

  const progress = Math.round((completedSteps.size / 6) * 100);

  const propLabel = [
    formInputs?.type && (formInputs.type.charAt(0).toUpperCase() + formInputs.type.slice(1)),
    formInputs?.subtype && formInputs.subtype.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
  ].filter(Boolean).join(' · ').toUpperCase() || 'PROPERTY';

  /* ── FAILURE STATE ── */
  if (failed) return (
    <div className="ps-screen ps-screen--failure">
      <div className="ps-failure">
        <div className="ps-failure-ring">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 8v7M14 18.5v.5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M2 14C2 7.37 7.37 2 14 2s12 5.37 12 12-5.37 12-12 12S2 20.63 2 14z"
              stroke="#DC2626" strokeWidth="1.5"/>
          </svg>
        </div>
        <h2 className="ps-failure-h">Analysis failed</h2>
        <p className="ps-failure-p">
          The engine encountered an error. Your inputs have been preserved.
        </p>
        <button className="ps-failure-btn" onClick={onBack}>← Try again</button>
      </div>
    </div>
  );

  /* ── MAIN RENDER ── */
  return (
    <div className="ps-screen">

      {/* ─── TOP BAR ─── */}
      <div className="ps-topbar">
        {/* Back / Cancel */}
        <button
          className="ps-back-btn"
          onClick={() => { cancelRef.current = true; onBack?.(); }}
          title={done ? 'Back to inputs' : 'Cancel and go back'}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M9.5 2.5L5 7.5l4.5 5" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Left: brand + separator + property type */}
        <div className="ps-topbar-left">
          <div className="ps-topbar-brand">
            <div className={`ps-brand-dot ${done ? 'ps-brand-dot--done' : ''}`} />
            COLLATIQ ENGINE
          </div>
          <div className="ps-topbar-vsep" />
          <div className="ps-topbar-prop">{propLabel}</div>
        </div>

        {/* Center: progress bar only — gets all remaining space */}
        <div className="ps-topbar-track-wrap">
          <div className="ps-topbar-track">
            <motion.div className="ps-topbar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* Right: percentage + step label */}
        <div className="ps-topbar-right">
          <span className="ps-topbar-pct">{progress}%</span>
          <div className="ps-topbar-vsep" />
          <span className="ps-topbar-stepcount">
            {done ? '✓  COMPLETE' : `STEP ${Math.min(currentStep, 6)} / 6`}
          </span>
        </div>
      </div>

      {/* ─── MOBILE PIPELINE STRIP (hidden on desktop) ─── */}
      <div className="ps-mobile-pipeline">
        {STEPS.map((step, i) => {
          const s = st(step.id);
          return (
            <div key={step.id} className={`ps-mp-item ps-mp-item--${s}`}>
              <div className="ps-mp-node">
                {s === 'done' && (
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <path d="M1 3.5l1.8 1.8L6 1.5" stroke="currentColor"
                      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {s === 'active' && <div className="ps-mp-spinner" />}
              </div>
              <span className="ps-mp-label">{step.short}</span>
            </div>
          );
        })}
      </div>

      {/* ─── 3-COLUMN MAIN ─── */}
      <div className="ps-body">

        {/* LEFT — PIPELINE */}
        <div className="ps-left">
          <div className="ps-left-ey">ANALYSIS PIPELINE</div>
          <div className="ps-pipeline">
            {STEPS.map((step, i) => (
              <StepNode key={step.id} step={step} state={st(step.id)}
                timestamp={timestamps[step.id]} isLast={i === STEPS.length - 1} />
            ))}
          </div>

          <AnimatePresence>
            {done && (
              <motion.div className="ps-done-banner"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8.25" stroke="#16A34A" strokeWidth="1.2"/>
                  <path d="M5 9l3 3 5-5" stroke="#16A34A" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <div className="ps-done-title">All 6 stages complete</div>
                  <div className="ps-done-sub">Review the summary, then open your report.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Confidence signal breakdown — appears after step 4 ── */}
          <AnimatePresence>
            {completedSteps.has(4) && results?.confidenceDrivers?.length > 0 && (
              <motion.div className="ps-left-signals"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}>
                <div className="ps-left-signals-ey">CONFIDENCE SIGNALS</div>
                {results.confidenceDrivers
                  .filter(d => d.impact === 'positive').slice(0, 3)
                  .map((d, i) => (
                    <motion.div key={`pos-${i}`} className="ps-signal-row ps-signal-row--pos"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}>
                      <span className="ps-signal-icon">↑</span>
                      <div className="ps-signal-body">
                        <div className="ps-signal-factor">{d.factor}</div>
                        <div className="ps-signal-reason">{d.reason}</div>
                      </div>
                    </motion.div>
                  ))}
                {results.confidenceDrivers
                  .filter(d => d.impact === 'negative').slice(0, 3)
                  .map((d, i) => (
                    <motion.div key={`neg-${i}`} className="ps-signal-row ps-signal-row--neg"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.65 + i * 0.08 }}>
                      <span className="ps-signal-icon">↓</span>
                      <div className="ps-signal-body">
                        <div className="ps-signal-factor">{d.factor}</div>
                        <div className="ps-signal-reason">{d.reason}</div>
                      </div>
                    </motion.div>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── LTV justification — appears after step 6 ── */}
          <AnimatePresence>
            {completedSteps.has(6) && results && (
              <motion.div className="ps-left-ltv"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}>
                <div className="ps-left-signals-ey">LTV BAND RATIONALE</div>
                <div className="ps-ltv-band-display">
                  <span className="ps-ltv-band-val">{results.ltvBand || results.ltv_band || '—'}</span>
                  <span className="ps-ltv-band-label">Recommended</span>
                </div>
                <div className="ps-ltv-factors">
                  {[
                    { label: 'Base LTV',      val: '65%',  note: 'Standard residential' },
                    results.zoneConfidence === 'low'   && { label: 'Zone penalty',   val: '−10%', note: 'Outside coverage zone', neg: true },
                    results.zoneConfidence === 'medium'&& { label: 'Zone discount',  val: '−5%',  note: 'Broad zone match',      neg: true },
                    results.inputs?.ocStatus === 'absent'      && { label: 'No OC',         val: '−5%',  note: 'Legal occupancy risk',  neg: true },
                    results.inputs?.ecStatus === 'charges'     && { label: 'EC charges',     val: '−8%',  note: 'Property encumbered',   neg: true },
                    results.inputs?.existingLoan === 'yes'     && { label: 'Existing loan',  val: '−10%', note: 'Prior mortgage',         neg: true },
                    results.inputs?.planApproval === 'not_approved' && { label: 'Unapproved plan', val: '−5%', note: 'Structural legal risk', neg: true },
                    results.rpi > 70 && { label: 'High RPI',      val: '+5%',  note: 'Strong resale market', pos: true },
                  ].filter(Boolean).map((item, i) => (
                    <div key={i} className={`ps-ltv-row${item.neg ? ' ps-ltv-row--neg' : item.pos ? ' ps-ltv-row--pos' : ''}`}>
                      <span className="ps-ltv-row-label">{item.label}</span>
                      <span className="ps-ltv-row-val">{item.val}</span>
                      <span className="ps-ltv-row-note">{item.note}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CENTER — VISUAL */}
        <div className="ps-center">

          {/* Scanner / 3D — hard removed when done, no fade to prevent zoom artifact */}
          {!done && (
            <div className="ps-center-scanner">
              {photos.length > 0
                ? <PhotoScanner photos={photos} completedSteps={completedSteps} formInputs={formInputs} />
                : <Scene3D formInputs={formInputs} completedSteps={completedSteps} />
              }
              <div className="ps-center-addr">
                {formInputs?.address || 'Property under review'}
              </div>
            </div>
          )}

          {/* Completion overlay — appears only after scanner is fully gone */}
          <AnimatePresence>
            {done && results && (
              <motion.div className="ps-center-done"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}>

                {/* Check icon */}
                <motion.div className="ps-done-icon"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 360, damping: 24 }}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="17" stroke="#16A34A" strokeWidth="1.5"/>
                    <path d="M10 18l6 6 10-10" stroke="#16A34A" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>

                <motion.div className="ps-done-heading"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}>
                  Assessment Complete
                </motion.div>

                {/* Key metrics — 2×2 grid */}
                <motion.div className="ps-done-metrics"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}>
                  <div className="ps-done-metric">
                    <div className="ps-done-m-label">Market value range</div>
                    <div className="ps-done-m-val">
                      {formatINR(results.mv_low)} – {formatINR(results.mv_high)}
                    </div>
                  </div>
                  <div className="ps-done-metric">
                    <div className="ps-done-m-label">Confidence</div>
                    <div className="ps-done-m-val">{results.confidenceScore ?? '—'} / 100</div>
                  </div>
                  <div className={`ps-done-metric ps-done-metric--verdict ps-done-verdict--${
                    (results.verdictLabel || results.verdict || '').toLowerCase().includes('sanction') ? 'green'
                    : (results.verdictLabel || results.verdict || '').toLowerCase().includes('conditional') ? 'amber'
                    : 'red'
                  }`}>
                    <div className="ps-done-m-label">Verdict</div>
                    <div className="ps-done-m-val">{results.verdictLabel || results.verdict || '—'}</div>
                  </div>
                  <div className="ps-done-metric">
                    <div className="ps-done-m-label">Recommended LTV</div>
                    <div className="ps-done-m-val">{results.ltvBand || results.ltv_band || '—'}</div>
                  </div>
                </motion.div>

                {/* Top fraud flag — shown here since right panel no longer carries flags */}
                {(results.fraudFlags ?? []).length > 0 && (
                  <motion.div className="ps-done-flag"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}>
                    <span className={`ps-risk-pill ps-risk-pill--${
                      (results.fraudFlags ?? []).some(f => f.severity === 'high') ? 'high'
                      : (results.fraudFlags ?? []).some(f => f.severity === 'medium') ? 'medium' : 'low'
                    }`}>
                      {(results.fraudFlags ?? []).some(f => f.severity === 'high') ? 'HIGH RISK'
                        : (results.fraudFlags ?? []).some(f => f.severity === 'medium') ? 'MEDIUM RISK'
                        : 'LOW RISK'} · {results.fraudFlags.length} signal{results.fraudFlags.length !== 1 ? 's' : ''}
                    </span>
                    <span className="ps-done-flag-text">
                      {(results.fraudFlags[0]?.description ?? results.fraudFlags[0]?.text ?? '').slice(0, 80)}
                    </span>
                  </motion.div>
                )}

                {/* CTA button */}
                <motion.button
                  className="ps-done-cta"
                  onClick={() => onComplete(results)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}>
                  View Full Report
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT — LIVE OUTPUT */}
        <div className="ps-right" ref={rightRef}>
          <div className="ps-right-ey">LIVE OUTPUT</div>

          <div className="ps-cards">
            <AnimatePresence>

              {/* Property profile — visible immediately from form inputs */}
              <PropertyProfileCard key="profile" formInputs={formInputs} d={0} />

              {/* Step 1 — compact pair */}
              {completedSteps.has(1) && results && (<>
                <DataCard key="loc" category="LOCATION RESOLVED" d={0} half>
                  {results.zone || formInputs?.address?.split(',').slice(-2).join(',').trim() || '—'}
                </DataCard>
                <DataCard key="zc" category="ZONE CONFIDENCE" d={0.08} half>
                  <span className={`ps-pill ps-pill--${results.zoneConfidence || 'low'}`}>
                    {(results.zoneConfidence || 'LOW').toUpperCase()}
                  </span>
                </DataCard>
                <DataCard key="infra" category="INFRASTRUCTURE SCORE" d={0.14} large>
                  <AnimCount to={results.infraScore ?? 65} />
                  <span className="ps-suf"> / 100</span>
                </DataCard>
              </>)}

              {/* Step 2 — market value full-width feature */}
              {completedSteps.has(2) && results && (
                <MVCard key="mv" results={results} />
              )}

              {/* Step 3 — compact pair + large RPI */}
              {completedSteps.has(3) && results && (<>
                <DataCard key="dv" category="DISTRESS VALUE" d={0} half>
                  {formatINR(results.dv_low)}–{formatINR(results.dv_high)}
                </DataCard>
                <DataCard key="ttl" category="TIME TO LIQUIDATE" d={0.08} half>
                  {results.ttl_low}–{results.ttl_high} days
                </DataCard>
                <DataCard key="rpi" category="RESALE POTENTIAL INDEX" d={0.14} large>
                  <AnimCount to={results.rpi ?? 0} />
                  <span className="ps-suf"> / 100</span>
                </DataCard>
              </>)}

              {/* Step 4 — confidence full-width */}
              {completedSteps.has(4) && results && (
                <DataCard key="conf" category="CONFIDENCE SCORE" d={0} large>
                  <AnimCount to={results.confidenceScore ?? 0} />
                  <span className="ps-suf"> / 100</span>
                  {' '}
                  <span className={`ps-pill ps-pill--${results.confidenceTier || 'low'}`}>
                    {(results.confidenceTier || 'LOW').toUpperCase()}
                  </span>
                </DataCard>
              )}

              {/* Right panel stops here — verdict, fraud, drivers, comparables
                  are all shown in the completion overlay and left panel.
                  This keeps the right panel within viewport height with no scroll. */}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
