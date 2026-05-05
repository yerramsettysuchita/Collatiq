import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import SummaryCard from '../../components/shared/SummaryCard';
import '../../styles/platform.css';
import './CaseDetailPage.css';

function fmt(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const VERDICT_COLOR = {
  'Sanction Recommended': 'var(--sanction)',
  'Conditional Sanction': 'var(--conditional)',
  'Do Not Sanction':      'var(--highrisk)',
};

export default function ResultPreviewPage() {
  const navigate        = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');
    if (id) {
      try {
        const stored = sessionStorage.getItem(id);
        if (stored) setResult(JSON.parse(stored));
      } catch {}
    }
  }, []);

  if (!result) {
    return (
      <AppShell variant="owner">
        <div className="plat-page">
          <div className="plat-empty">
            <p className="plat-empty-text">Result not found.</p>
            <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
              Run new assessment
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const verdictLabel = result.verdictLabel || result.verdict || '—';
  const verdictColor = VERDICT_COLOR[verdictLabel] || 'var(--ink)';
  const prop = result.property_payload || {};

  return (
    <AppShell variant="owner">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Assessment result — preview mode</p>
          <h1 className="plat-title" style={{ fontSize: 'clamp(18px,2.5vw,28px)' }}>
            {prop.address || 'Property assessment'}
          </h1>
          <p className="plat-subtitle" style={{ color: '#D97706', fontSize: 13, fontFamily: 'var(--mono)' }}>
            Preview mode — connect Supabase to save results permanently.
          </p>
        </div>

        <div className="cd-verdict-banner" style={{ '--vcolor': verdictColor }}>
          <div className="cd-verdict-label">Verdict</div>
          <div className="cd-verdict-value">{verdictLabel}</div>
          {result.ltvBand && <div className="cd-verdict-ltv">Recommended LTV: {result.ltvBand}</div>}
        </div>

        <p className="plat-section-label" style={{ marginTop: 24 }}>Valuation summary</p>
        <div className="plat-cards">
          <SummaryCard label="Market value (low)"  value={fmt(result.mv_low)} />
          <SummaryCard label="Market value (high)" value={fmt(result.mv_high)} accent />
          <SummaryCard label="Confidence score"    value={`${result.confidenceScore ?? '—'}%`} />
          <SummaryCard label="Resale potential"    value={result.rpi != null ? `${result.rpi}/100` : '—'} />
          {result.ttl_low && (
            <SummaryCard label="Time to sell" value={`${result.ttl_low}–${result.ttl_high} days`} />
          )}
          {result.collateralHealthScore && (
            <SummaryCard label="Collateral health" value={`${result.collateralHealthScore}/820`} />
          )}
        </div>

        {result.decisionMemo && (
          <>
            <p className="plat-section-label">Assessment memo</p>
            <div className="cd-memo-text">{result.decisionMemo}</div>
          </>
        )}

        <p className="plat-section-label" style={{ marginTop: 24 }}>Property details</p>
        <div className="cd-detail-grid">
          {[
            ['Type',    prop.type || '—'],
            ['Sub-type', prop.subtype || '—'],
            ['Area',    prop.area ? `${prop.area} sq ft` : '—'],
            ['Age',     prop.age || '—'],
            ['Legal',   prop.legal || '—'],
          ].map(([k, v]) => (
            <div key={k} className="cd-detail-item">
              <span className="cd-detail-key">{k}</span>
              <span className="cd-detail-val" style={{ textTransform: 'capitalize' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
            Run another assessment
          </button>
          <Link to="/signup" className="plat-btn plat-btn-ghost">
            Save results — create account →
          </Link>
        </div>

        <p className="plat-disclaimer" style={{ marginTop: 24 }}>
          Model-generated estimate only. Not a certified valuation and should not be the sole basis for any financial decision.
        </p>
      </div>
    </AppShell>
  );
}
