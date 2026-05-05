import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import { getCircleRateForLocation } from '../../engine/geoEngine';
import { runCollatiqPipeline } from '../../engine/pipeline';
import './FreeEstimatePage.css';

/* ── Formatters ─────────────────────────────────────────── */
function fmt(val) {
  if (!val && val !== 0) return '—';
  const n = Number(val);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/* ── Constants ──────────────────────────────────────────── */
const TYPE_OPTIONS = [
  { id: 'residential', label: 'Residential' },
  { id: 'commercial',  label: 'Commercial'  },
  { id: 'industrial',  label: 'Industrial'  },
];
const AGE_OPTIONS = [
  { id: 'new', label: 'New',     sub: 'Under 5 yrs' },
  { id: 'mid', label: 'Mid-age', sub: '5–15 yrs'    },
  { id: 'old', label: 'Old',     sub: 'Above 15 yrs' },
];
const LEGAL_OPTIONS = [
  { id: 'clear',   label: 'Clear title'     },
  { id: 'complex', label: 'Some complexity' },
  { id: 'unknown', label: 'Unknown'         },
];
const PROC_STEPS = [
  'Resolving address and pulling infrastructure signals…',
  'Computing market value with 12 adjustment factors…',
  'Scoring resale liquidity and time-to-liquidate…',
  'Running confidence and data quality assessment…',
  'Generating your free estimate…',
];
const VERDICT_COLORS = {
  'Sanction Recommended': '#16A34A',
  'Conditional Sanction': '#b45309',
  'Review Required':      '#b45309',
  'Decline':              '#dc2626',
};

/* ── Sub-components ─────────────────────────────────────── */
function FormStep({ form, setForm, onSubmit, error }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddressSelect = ({ address, lat, lng }) => {
    setForm(f => ({
      ...f,
      address,
      lat,
      lng,
      circleRateData: getCircleRateForLocation(lat, lng),
    }));
  };

  return (
    <div className="fe-form">
      <div className="fe-form-header">
        <Link to="/access-property" className="fe-back-link">← Back</Link>
        <span className="fe-free-badge">Free estimate</span>
      </div>

      <h1 className="fe-form-title">Get your property estimate</h1>
      <p className="fe-form-sub">
        No account needed. Fill in the details below and get an indicative market value in under 30 seconds.
      </p>

      {error && <div className="fe-error">{error}</div>}

      <div className="fe-fields">
        {/* Address */}
        <div className="fe-field">
          <label className="fe-label">Property address</label>
          <AddressAutocomplete
            value={form.address}
            onChange={addr => set('address', addr)}
            onSelect={handleAddressSelect}
            placeholder="Start typing a property address…"
          />
        </div>

        {/* Type */}
        <div className="fe-field">
          <label className="fe-label">Property type</label>
          <div className="fe-chips">
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.id}
                type="button"
                className={`fe-chip ${form.type === o.id ? 'fe-chip--active' : ''}`}
                onClick={() => set('type', o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Area */}
        <div className="fe-field">
          <label className="fe-label">Built-up area (sq ft)</label>
          <input
            className="fe-input"
            type="number"
            min="0"
            placeholder="e.g. 1200"
            value={form.area}
            onChange={e => set('area', e.target.value)}
          />
        </div>

        {/* Age */}
        <div className="fe-field">
          <label className="fe-label">Property age</label>
          <div className="fe-chips">
            {AGE_OPTIONS.map(o => (
              <button
                key={o.id}
                type="button"
                className={`fe-chip ${form.age === o.id ? 'fe-chip--active' : ''}`}
                onClick={() => set('age', o.id)}
              >
                {o.label}
                <span className="fe-chip-sub">{o.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div className="fe-field">
          <label className="fe-label">Legal status</label>
          <select
            className="fe-select"
            value={form.legal}
            onChange={e => set('legal', e.target.value)}
          >
            {LEGAL_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="fe-submit" type="button" onClick={onSubmit}>
        Run free estimate
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <p className="fe-disclaimer">
        Model-generated indicative estimate only. Not a certified valuation.
      </p>
    </div>
  );
}

function ProcessingStep({ step }) {
  return (
    <div className="fe-processing">
      <div className="fe-proc-spinner" />
      <p className="fe-proc-title">Analysing your property…</p>
      <div className="fe-proc-steps">
        {PROC_STEPS.map((label, i) => (
          <div key={i} className={`fe-proc-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
            <span className="fe-proc-dot" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsStep({ results, form, onRestart }) {
  const navigate  = useNavigate();
  const verdict   = results.verdictLabel || results.verdict || '—';
  const vColor    = VERDICT_COLORS[verdict] || '#374151';
  const flags     = (results.riskFlags || []).slice(0, 2);
  const nextUrl   = `/signup?next=full-estimate`;

  const handleUpgrade = () => {
    // Preserve data for the full flow
    try {
      sessionStorage.setItem('fe_form',   JSON.stringify(form));
      sessionStorage.setItem('fe_result', JSON.stringify(results));
    } catch {}
    navigate(nextUrl);
  };

  const handleSignIn = () => {
    try {
      sessionStorage.setItem('fe_form',   JSON.stringify(form));
      sessionStorage.setItem('fe_result', JSON.stringify(results));
    } catch {}
    navigate('/login?next=full-estimate');
  };

  return (
    <div className="fe-results">
      {/* Header */}
      <div className="fe-results-header">
        <div>
          <span className="fe-free-badge">Free estimate</span>
          <h2 className="fe-results-title">Your indicative estimate</h2>
          {form.address && (
            <p className="fe-results-addr">{form.address}</p>
          )}
        </div>
        <button className="fe-restart" onClick={onRestart} type="button">
          New estimate
        </button>
      </div>

      {/* Headline numbers */}
      <div className="fe-headline">
        <div className="fe-hl-card">
          <div className="fe-hl-label">Market value range</div>
          <div className="fe-hl-value">
            {fmt(results.mv_low)} – {fmt(results.mv_high)}
          </div>
        </div>
        <div className="fe-hl-card">
          <div className="fe-hl-label">Verdict</div>
          <div className="fe-hl-verdict" style={{ color: vColor }}>{verdict}</div>
        </div>
        <div className="fe-hl-card">
          <div className="fe-hl-label">Confidence</div>
          <div className="fe-hl-value">{results.confidenceScore ?? '—'}%</div>
        </div>
      </div>

      {/* Risk flags (up to 2) */}
      {flags.length > 0 && (
        <div className="fe-flags">
          <div className="fe-flags-label">Risk signals</div>
          {flags.map((f, i) => (
            <div key={i} className="fe-flag">
              <span className="fe-flag-dot" />
              <span>{typeof f === 'string' ? f : f.label || f.flag || JSON.stringify(f)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Locked section */}
      <div className="fe-locked-wrap">
        <div className="fe-locked-content" aria-hidden="true">
          <div className="fe-locked-row">
            <span className="fe-locked-label">LTV band</span>
            <span className="fe-locked-val">██████</span>
          </div>
          <div className="fe-locked-row">
            <span className="fe-locked-label">Distress value</span>
            <span className="fe-locked-val">██████</span>
          </div>
          <div className="fe-locked-row">
            <span className="fe-locked-label">Resale potential index</span>
            <span className="fe-locked-val">██████</span>
          </div>
          <div className="fe-locked-row">
            <span className="fe-locked-label">Time to liquidate</span>
            <span className="fe-locked-val">██████</span>
          </div>
          <div className="fe-locked-row">
            <span className="fe-locked-label">Full factor breakdown</span>
            <span className="fe-locked-val">██████████</span>
          </div>
        </div>
        <div className="fe-locked-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span>Full report locked</span>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="fe-upgrade">
        <div className="fe-upgrade-title">Unlock your full collateral report</div>
        <div className="fe-upgrade-sub">Create a free account to get the complete analysis your lender needs.</div>
        <ul className="fe-upgrade-list">
          <li>LTV band and lending recommendation</li>
          <li>Distress value and forced-sale estimate</li>
          <li>Resale potential index and liquidity score</li>
          <li>Time-to-liquidate analysis (days)</li>
          <li>Risk flag breakdown with explanations</li>
          <li>Exportable credit memo for your lender</li>
          <li>Save history and track case status</li>
        </ul>
        <div className="fe-upgrade-actions">
          <button className="fe-upgrade-btn" type="button" onClick={handleUpgrade}>
            Create account — it's free
          </button>
          <button className="fe-signin-link" type="button" onClick={handleSignIn}>
            Already have an account? Sign in →
          </button>
        </div>
      </div>

      <p className="fe-results-disclaimer">
        This is a model-generated indicative estimate only. It is not a certified valuation and should not be the sole basis for any financial decision.
      </p>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */
export default function FreeEstimatePage() {
  const [step,    setStep]    = useState('form');
  const [procIdx, setProcIdx] = useState(0);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState('');
  const runningRef = useRef(false);

  const [form, setForm] = useState({
    address: '', lat: null, lng: null,
    type: '', area: '', age: 'mid',
    legal: 'clear', circleRateData: null,
  });

  // Run pipeline when step changes to 'processing'
  useEffect(() => {
    if (step !== 'processing' || runningRef.current) return;
    runningRef.current = true;

    const run = async () => {
      try {
        setProcIdx(0);
        const tick = () => setProcIdx(p => Math.min(p + 1, PROC_STEPS.length - 1));
        const t1 = setTimeout(tick, 1200);
        const t2 = setTimeout(tick, 2400);
        const t3 = setTimeout(tick, 3600);
        const t4 = setTimeout(tick, 4500);

        const res = await runCollatiqPipeline(form);

        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
        setProcIdx(PROC_STEPS.length - 1);
        setResults(res);
        setStep('results');
      } catch (err) {
        console.error(err);
        setError('Something went wrong. Please try again.');
        setStep('form');
        runningRef.current = false;
      }
    };

    run();
  }, [step]); // eslint-disable-line

  const handleSubmit = () => {
    if (!form.address.trim()) { setError('Please enter a property address.'); return; }
    if (!form.type)           { setError('Please select a property type.');   return; }
    if (!form.area || isNaN(parseFloat(form.area))) { setError('Please enter the built-up area (sq ft).'); return; }
    setError('');
    runningRef.current = false;
    setStep('processing');
  };

  const handleRestart = () => {
    setStep('form');
    setResults(null);
    setError('');
    runningRef.current = false;
    setForm({ address: '', lat: null, lng: null, type: '', area: '', age: 'mid', legal: 'clear', circleRateData: null });
  };

  return (
    <div className="fe-page">
      <div className="fe-wrap">
        {step === 'form' && (
          <FormStep form={form} setForm={setForm} onSubmit={handleSubmit} error={error} />
        )}
        {step === 'processing' && (
          <ProcessingStep step={procIdx} />
        )}
        {step === 'results' && results && (
          <ResultsStep results={results} form={form} onRestart={handleRestart} />
        )}
      </div>
    </div>
  );
}
