import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
import SummaryCard from '../../components/shared/SummaryCard';
import { getCaseById } from '../../lib/cases';
import '../../styles/platform.css';
import './CaseDetailPage.css';

function fmt(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const NEXT_STEPS = {
  approved:         "Your property assessment has been reviewed. You may proceed with your lender's loan process.",
  conditional:      'Your assessment is conditionally approved. The lender will reach out with specific requirements before processing further.',
  rejected:         'The collateral assessment came back unfavourable. You may re-apply with additional documentation or a different property.',
  submitted:        'Your assessment is submitted and is being reviewed by our team. This typically takes 1 to 2 business days.',
  under_review:     'A lender analyst is reviewing your property assessment. You will be notified once a decision is made.',
  decision_pending: 'A decision is being finalised by the lender team. You will hear back shortly.',
  draft:            'Your assessment is saved as a draft. Submit it to get a full review.',
  closed:           'This case has been closed.',
};

const VERDICT_COLOR = {
  'Sanction Recommended':    'var(--sanction)',
  'Conditional Sanction':    'var(--conditional)',
  'Do Not Sanction':         'var(--highrisk)',
};

export default function OwnerCaseDetailPage() {
  const { id }                = useParams();
  const navigate              = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    getCaseById(id)
      .then(setCaseData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppShell variant="owner">
        <div className="plat-page">
          <div className="plat-spinner" style={{ margin: '80px auto' }} />
        </div>
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell variant="owner">
        <div className="plat-page">
          <div className="plat-empty">
            <p className="plat-empty-text">Case not found or access denied.</p>
            <button className="plat-btn plat-btn-ghost" onClick={() => navigate('/owner/cases')}>
              Back to cases
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const dec  = caseData.case_decisions?.[0];
  const prop = caseData.property_payload || {};
  const addr = prop.address || 'Unknown property';
  const nextStep = NEXT_STEPS[caseData.status] || '';
  const verdictColor = dec ? (VERDICT_COLOR[dec.recommendation] || 'var(--ink)') : 'var(--ink)';

  return (
    <AppShell variant="owner">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Assessment detail</p>
          <h1 className="plat-title" style={{ fontSize: 'clamp(18px,2.5vw,28px)' }}>{addr}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <StatusBadge status={caseData.status} />
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              {fmtDate(caseData.created_at)}
            </span>
          </div>
        </div>

        {dec && (
          <div className="cd-verdict-banner" style={{ '--vcolor': verdictColor }}>
            <div className="cd-verdict-label">Verdict</div>
            <div className="cd-verdict-value">{dec.recommendation}</div>
            {dec.ltv_band && <div className="cd-verdict-ltv">Recommended LTV: {dec.ltv_band}</div>}
          </div>
        )}

        {dec && (
          <>
            <p className="plat-section-label" style={{ marginTop: 28 }}>Valuation summary</p>
            <div className="plat-cards">
              <SummaryCard label="Market value (low)"  value={fmt(dec.market_value_min)} />
              <SummaryCard label="Market value (high)" value={fmt(dec.market_value_max)} accent />
              <SummaryCard label="Confidence score"    value={`${dec.confidence_score ?? '—'}%`} />
              <SummaryCard
                label="Resale potential"
                value={dec.resale_potential_index != null ? `${dec.resale_potential_index}/100` : '—'}
              />
              {dec.ttl_days_min && (
                <SummaryCard
                  label="Time to sell"
                  value={`${dec.ttl_days_min}–${dec.ttl_days_max} days`}
                />
              )}
            </div>
          </>
        )}

        <p className="plat-section-label">Property details</p>
        <div className="cd-detail-grid">
          <div className="cd-detail-item"><span className="cd-detail-key">Type</span><span className="cd-detail-val" style={{ textTransform: 'capitalize' }}>{prop.type || '—'}</span></div>
          <div className="cd-detail-item"><span className="cd-detail-key">Sub-type</span><span className="cd-detail-val">{prop.subtype || '—'}</span></div>
          <div className="cd-detail-item"><span className="cd-detail-key">Area</span><span className="cd-detail-val">{prop.area ? `${prop.area} sq ft` : '—'}</span></div>
          <div className="cd-detail-item"><span className="cd-detail-key">Floor</span><span className="cd-detail-val">{prop.floor || '—'}</span></div>
          <div className="cd-detail-item"><span className="cd-detail-key">Age</span><span className="cd-detail-val" style={{ textTransform: 'capitalize' }}>{prop.age || '—'}</span></div>
          <div className="cd-detail-item"><span className="cd-detail-key">Legal status</span><span className="cd-detail-val" style={{ textTransform: 'capitalize' }}>{prop.legal || '—'}</span></div>
        </div>

        {nextStep && (
          <div className="cd-next-steps">
            <p className="cd-next-heading">What happens next</p>
            <p className="cd-next-body">{nextStep}</p>
          </div>
        )}

        {dec?.borrower_summary && (
          <div className="cd-memo">
            <p className="plat-section-label">Assessment summary</p>
            <p className="cd-memo-text">{dec.borrower_summary}</p>
          </div>
        )}

        {caseData.case_activity?.length > 0 && (
          <>
            <p className="plat-section-label" style={{ marginTop: 28 }}>Activity</p>
            <div className="activity-feed">
              {caseData.case_activity.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-body">
                    <span className="activity-label">{a.event_label}</span>
                    <span className="activity-time">{fmtDate(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 32 }}>
          <button className="plat-btn plat-btn-ghost" onClick={() => navigate('/owner/cases')}>
            ← Back to cases
          </button>
        </div>
      </div>
    </AppShell>
  );
}
