import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import { createCase, submitCase, upsertDecision, logCaseActivity } from '../../lib/cases';
import { runCollatiqPipeline } from '../../engine/pipeline';
import { getCircleRateForLocation } from '../../engine/geoEngine';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import '../../styles/platform.css';
import './NewCasePage.css';

const SUPABASE_CONFIGURED = !!(
  process.env.REACT_APP_SUPABASE_URL &&
  process.env.REACT_APP_SUPABASE_URL !== 'https://placeholder.supabase.co'
);

const PROC_STEPS = [
  'Resolving address and pulling infrastructure signals.',
  'Computing market value with 12 adjustment factors.',
  'Scoring resale liquidity and time-to-liquidate.',
  'Running confidence and data quality assessment.',
  'Checking for fraud and anomaly signals.',
  'Generating decision object and credit memo.',
];

const TYPE_OPTIONS = [
  { id: 'residential', label: 'Residential' },
  { id: 'commercial',  label: 'Commercial'  },
  { id: 'industrial',  label: 'Industrial'  },
];

const SUBTYPES = {
  residential: ['Apartment', 'Villa', 'Plot'],
  commercial:  ['Shop', 'Office', 'Warehouse'],
  industrial:  ['Factory', 'Warehouse', 'Land'],
};

const LEGAL_OPTIONS = [
  { id: 'clear',   label: 'Clear title'      },
  { id: 'complex', label: 'Some complexity'  },
  { id: 'unknown', label: 'Unknown'          },
];

const AGE_OPTIONS = [
  { id: 'new', label: 'New',     sub: 'Under 5 years' },
  { id: 'mid', label: 'Mid-age', sub: '5–15 years'    },
  { id: 'old', label: 'Old',     sub: 'Above 15 years' },
];

function ProcessingPhase({ currentStep }) {
  return (
    <div className="nc-processing">
      <div className="nc-proc-icon">
        <div className="step-spinner" style={{ width: 32, height: 32 }} />
      </div>
      <p className="nc-proc-title">Analysing property</p>
      <div className="nc-proc-steps">
        {PROC_STEPS.map((label, i) => (
          <div key={i} className={`nc-proc-step ${i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'}`}>
            <span className="nc-proc-dot" />
            <span className="nc-proc-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewCasePage() {
  const navigate    = useNavigate();
  const [phase, setPhase]     = useState('form');
  const [procStep, setProcStep] = useState(0);
  const [error, setError]     = useState('');
  const [formErr, setFormErr] = useState('');
  const runningRef            = useRef(false);

  const [form, setForm] = useState(() => {
    // Pre-fill from free estimate if owner upgraded from /owner/estimate
    try {
      const saved = sessionStorage.getItem('fe_form');
      if (saved) {
        sessionStorage.removeItem('fe_form');
        sessionStorage.removeItem('fe_result');
        const parsed = JSON.parse(saved);
        return {
          address: parsed.address || '', lat: parsed.lat || null, lng: parsed.lng || null,
          type: parsed.type || '', subtype: '', area: parsed.area || '',
          floor: '', age: parsed.age || '', legal: parsed.legal || 'clear',
          circleRateData: parsed.circleRateData || null,
        };
      }
    } catch {}
    return { address: '', lat: null, lng: null, type: '', subtype: '', area: '', floor: '', age: '', legal: 'clear', circleRateData: null };
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddressSelect = ({ address, lat, lng }) => {
    setForm(f => ({ ...f, address, lat, lng, circleRateData: getCircleRateForLocation(lat, lng) }));
  };

  // Run pipeline when phase changes to 'processing'
  useEffect(() => {
    if (phase !== 'processing' || runningRef.current) return;
    runningRef.current = true;

    const run = async () => {
      try {
        setProcStep(0);
        const result = await runCollatiqPipeline(form);
        setProcStep(5);

        if (!SUPABASE_CONFIGURED) {
          // Preview mode: store result in sessionStorage and show inline result
          const previewId = 'preview-' + Date.now();
          try { sessionStorage.setItem(previewId, JSON.stringify({ ...result, property_payload: form })); } catch {}
          navigate(`/owner/result-preview?id=${previewId}`);
          return;
        }

        const caseRow = await createCase({ propertyPayload: form, intakeMode: 'borrower' });

        const dec = {
          recommendation:         result.verdictLabel || result.verdict,
          confidence_score:       result.confidenceScore,
          resale_potential_index: result.rpi,
          market_value_min:       result.mv_low,
          market_value_max:       result.mv_high,
          ttl_days_min:           result.ttl_low,
          ttl_days_max:           result.ttl_high,
          ltv_band:               result.ltvBand,
          borrower_summary:       result.decisionMemo || '',
          full_result_payload:    result,
        };
        await upsertDecision(caseRow.id, dec);
        await submitCase(caseRow.id, { resultPayload: result });
        await logCaseActivity(caseRow.id, {
          eventType:  'case_submitted',
          eventLabel: 'Assessment submitted',
          details:    { verdict: result.verdict },
          actorRole:  'borrower',
        });

        navigate(`/owner/cases/${caseRow.id}`);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Something went wrong. Please try again.');
        setPhase('error');
        runningRef.current = false;
      }
    };

    run();
  }, [phase]); // eslint-disable-line

  const handleSubmit = () => {
    if (!form.address.trim()) { setFormErr('Please enter a property address.'); return; }
    if (!form.type)           { setFormErr('Please select a property type.');   return; }
    if (!form.area || isNaN(parseFloat(form.area))) { setFormErr('Please enter the built-up area.'); return; }
    setFormErr('');
    runningRef.current = false;
    setPhase('processing');
  };

  if (phase === 'processing') {
    return (
      <AppShell variant="owner">
        <div className="plat-page">
          <ProcessingPhase currentStep={procStep} />
        </div>
      </AppShell>
    );
  }

  if (phase === 'error') {
    return (
      <AppShell variant="owner">
        <div className="plat-page">
          <div className="plat-empty">
            <p className="plat-empty-text" style={{ color: 'var(--highrisk)' }}>
              Assessment failed: {error}
            </p>
            <button className="plat-btn plat-btn-primary" onClick={() => setPhase('form')}>
              Try again
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const subtypes = form.type ? SUBTYPES[form.type] || [] : [];

  return (
    <AppShell variant="owner">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Borrower portal</p>
          <h1 className="plat-title">New assessment</h1>
          <p className="plat-subtitle">Enter your property details and get a full collateral report in under 30 seconds.</p>
        </div>

        {formErr && <div className="nc-form-error">{formErr}</div>}

        <div className="nc-form">
          <div className="plat-form-field">
            <label className="plat-form-label">Property address</label>
            <AddressAutocomplete
              value={form.address}
              onChange={val => set('address', val)}
              onSelect={handleAddressSelect}
              placeholder="Start typing a property address…"
            />
          </div>

          <div className="plat-form-field">
            <label className="plat-form-label">Property type</label>
            <div className="nc-type-row">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`nc-type-btn ${form.type === opt.id ? 'active' : ''}`}
                  onClick={() => { set('type', opt.id); set('subtype', ''); }}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {subtypes.length > 0 && (
            <div className="plat-form-field">
              <label className="plat-form-label">Sub-type</label>
              <div className="nc-type-row">
                {subtypes.map(s => (
                  <button
                    key={s}
                    className={`nc-type-btn nc-type-btn--sm ${form.subtype === s ? 'active' : ''}`}
                    onClick={() => set('subtype', s)}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="nc-form-row">
            <div className="plat-form-field">
              <label className="plat-form-label">Built-up area (sq ft)</label>
              <input
                className="plat-form-input"
                type="number"
                min="1"
                placeholder="e.g. 1200"
                value={form.area}
                onChange={e => set('area', e.target.value)}
              />
            </div>
            <div className="plat-form-field">
              <label className="plat-form-label">Floor (optional)</label>
              <input
                className="plat-form-input"
                type="number"
                min="0"
                placeholder="e.g. 3"
                value={form.floor}
                onChange={e => set('floor', e.target.value)}
              />
            </div>
          </div>

          <div className="plat-form-field">
            <label className="plat-form-label">Property age</label>
            <div className="nc-type-row">
              {AGE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`nc-type-btn ${form.age === opt.id ? 'active' : ''}`}
                  onClick={() => set('age', opt.id)}
                  type="button"
                >
                  <span>{opt.label}</span>
                  <span className="nc-type-sub">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="plat-form-field">
            <label className="plat-form-label">Legal status</label>
            <select
              className="plat-form-input"
              value={form.legal}
              onChange={e => set('legal', e.target.value)}
            >
              {LEGAL_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="nc-actions">
            <button className="plat-btn plat-btn-primary" onClick={handleSubmit} type="button">
              Run assessment →
            </button>
            <button
              className="plat-btn plat-btn-ghost"
              onClick={() => navigate('/owner/dashboard')}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>

        <p className="plat-disclaimer">
          Model-generated estimate only. Not a certified valuation and should not be the sole basis for any financial decision.
        </p>
      </div>
    </AppShell>
  );
}
