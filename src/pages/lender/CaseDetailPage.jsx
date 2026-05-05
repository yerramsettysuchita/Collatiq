import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
import SummaryCard from '../../components/shared/SummaryCard';
import { getCaseById, updateCaseStatus, upsertDecision, logCaseActivity } from '../../lib/cases';
import '../../styles/platform.css';
import './LenderCaseDetail.css';

function fmt(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const VERDICT_COLOR = {
  'Sanction Recommended': 'var(--sanction)',
  'Conditional Sanction': 'var(--conditional)',
  'Do Not Sanction':      'var(--highrisk)',
};

export default function LenderCaseDetailPage() {
  const { id }                  = useParams();
  const navigate                = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [decision, setDecision] = useState('approved');
  const [note, setNote]         = useState('');
  const [ltvOverride, setLtv]   = useState('');
  const [decisionDone, setDecisionDone] = useState(false);

  useEffect(() => {
    getCaseById(id)
      .then(data => {
        setCaseData(data);
        if (data.status === 'approved' || data.status === 'rejected' || data.status === 'conditional') {
          setDecisionDone(true);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDecision = async () => {
    if (!caseData) return;
    setSaving(true);
    try {
      const statusMap = { approved: 'approved', rejected: 'rejected', conditional: 'conditional' };
      const newStatus = statusMap[decision] || 'approved';
      await updateCaseStatus(caseData.id, newStatus);
      if (ltvOverride || note) {
        const existing = caseData.case_decisions?.[0] || {};
        await upsertDecision(caseData.id, {
          ...existing,
          recommendation: decision === 'approved' ? 'Sanction Recommended'
                        : decision === 'conditional' ? 'Conditional Sanction'
                        : 'Do Not Sanction',
          ltv_band:       ltvOverride || existing.ltv_band,
          borrower_summary: note || existing.borrower_summary,
        });
      }
      await logCaseActivity(caseData.id, {
        eventType:  `decision_${decision}`,
        eventLabel: `Decision: ${decision}`,
        details:    { note, ltvOverride },
        actorRole:  'lender',
      });
      setDecisionDone(true);
      setCaseData(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      alert('Failed to save decision: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell variant="lender">
        <div className="plat-page">
          <div className="plat-spinner" style={{ margin: '80px auto' }} />
        </div>
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell variant="lender">
        <div className="plat-page">
          <div className="plat-empty">
            <p className="plat-empty-text">Case not found or access denied.</p>
            <button className="plat-btn plat-btn-ghost" onClick={() => navigate('/lender/cases')}>
              Back to cases
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const dec  = caseData.case_decisions?.[0];
  const prop = caseData.property_payload || {};
  const res  = dec?.full_result_payload || {};
  const addr = prop.address || 'Unknown property';
  const borrower = caseData.profiles?.full_name || caseData.profiles?.email || '—';
  const verdictColor = dec ? (VERDICT_COLOR[dec.recommendation] || 'var(--ink)') : 'var(--ink)';

  return (
    <AppShell variant="lender">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Case detail — {borrower}</p>
          <h1 className="plat-title" style={{ fontSize: 'clamp(18px,2.5vw,28px)' }}>{addr}</h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
            <StatusBadge status={caseData.status} />
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              {fmtDate(caseData.created_at)}
            </span>
          </div>
        </div>

        {dec && (
          <div className="lc-verdict-banner" style={{ '--vcolor': verdictColor }}>
            <div className="lc-vdict-label">Engine verdict</div>
            <div className="lc-vdict-value">{dec.recommendation}</div>
            {dec.ltv_band && <div className="lc-vdict-ltv">LTV Band: {dec.ltv_band}</div>}
          </div>
        )}

        {dec && (
          <>
            <p className="plat-section-label" style={{ marginTop: 24 }}>Valuation metrics</p>
            <div className="plat-cards">
              <SummaryCard label="Market value (low)"   value={fmt(dec.market_value_min)} />
              <SummaryCard label="Market value (high)"  value={fmt(dec.market_value_max)} accent />
              <SummaryCard label="Confidence score"     value={`${dec.confidence_score ?? '—'}%`} />
              <SummaryCard label="Resale potential"     value={dec.resale_potential_index != null ? `${dec.resale_potential_index}/100` : '—'} />
              {dec.ttl_days_min && (
                <SummaryCard label="Time to sell" value={`${dec.ttl_days_min}–${dec.ttl_days_max} days`} />
              )}
              {res.collateralHealthScore && (
                <SummaryCard label="Collateral health" value={`${res.collateralHealthScore}/820`} />
              )}
            </div>
          </>
        )}

        <p className="plat-section-label">Property details</p>
        <div className="lc-detail-grid">
          {[
            ['Address',     addr],
            ['Type',        prop.type || '—'],
            ['Sub-type',    prop.subtype || '—'],
            ['Area',        prop.area ? `${prop.area} sq ft` : '—'],
            ['Floor',       prop.floor || '—'],
            ['Age',         prop.age || '—'],
            ['Legal',       prop.legal || '—'],
            ['Occupancy',   prop.occupancy || '—'],
          ].map(([k, v]) => (
            <div key={k} className="lc-detail-item">
              <span className="lc-detail-key">{k}</span>
              <span className="lc-detail-val" style={{ textTransform: 'capitalize' }}>{v}</span>
            </div>
          ))}
        </div>

        {res.fraudRiskLevel && (
          <>
            <p className="plat-section-label">Risk signals</p>
            <div className="lc-risk-row">
              <div className="lc-risk-pill" data-level={res.fraudRiskLevel}>
                Fraud risk: {res.fraudRiskLevel}
              </div>
              {res.fraudFlags?.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  {res.fraudFlags.map((f, i) => (
                    <span key={i} className="lc-flag">{typeof f === 'string' ? f : f.flag}</span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {res.decisionMemo && (
          <>
            <p className="plat-section-label" style={{ marginTop: 24 }}>Decision memo</p>
            <div className="lc-memo">{res.decisionMemo}</div>
          </>
        )}

        <p className="plat-section-label" style={{ marginTop: 28 }}>Lender decision</p>
        {decisionDone ? (
          <div className="lc-decision-done">
            Decision recorded: <strong style={{ textTransform: 'capitalize' }}>{caseData.status}</strong>
            <button
              className="plat-btn plat-btn-ghost plat-btn-sm"
              style={{ marginLeft: 16 }}
              onClick={() => setDecisionDone(false)}
            >
              Revise
            </button>
          </div>
        ) : (
          <div className="lc-decision-panel">
            <div className="lc-decision-options">
              {['approved', 'conditional', 'rejected'].map(opt => (
                <label key={opt} className={`lc-decision-opt ${decision === opt ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="decision"
                    value={opt}
                    checked={decision === opt}
                    onChange={() => setDecision(opt)}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{opt}</span>
                </label>
              ))}
            </div>
            <div className="nc-form-row" style={{ marginTop: 16, maxWidth: 500 }}>
              <div className="plat-form-field">
                <label className="plat-form-label">LTV override (optional)</label>
                <input
                  className="plat-form-input"
                  placeholder="e.g. 55%–60%"
                  value={ltvOverride}
                  onChange={e => setLtv(e.target.value)}
                />
              </div>
            </div>
            <div className="plat-form-field" style={{ maxWidth: 500, marginTop: 8 }}>
              <label className="plat-form-label">Internal note (shown to borrower)</label>
              <textarea
                className="plat-form-input"
                rows={3}
                placeholder="Add a note for the borrower…"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="nc-actions" style={{ marginTop: 16 }}>
              <button className="plat-btn plat-btn-primary" onClick={handleDecision} disabled={saving}>
                {saving ? 'Saving…' : 'Record decision'}
              </button>
              <button className="plat-btn plat-btn-ghost" onClick={() => navigate('/lender/cases')}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {caseData.case_activity?.length > 0 && (
          <>
            <p className="plat-section-label" style={{ marginTop: 32 }}>Activity log</p>
            <div className="activity-feed">
              {caseData.case_activity.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-body">
                    <span className="activity-label">{a.event_label}</span>
                    <span className="activity-time">{fmtDate(a.created_at)}</span>
                    {a.profiles && (
                      <span className="activity-actor">by {a.profiles.full_name || a.profiles.email}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 32 }}>
          <button className="plat-btn plat-btn-ghost" onClick={() => navigate('/lender/cases')}>
            ← Back to cases
          </button>
        </div>
      </div>
    </AppShell>
  );
}
