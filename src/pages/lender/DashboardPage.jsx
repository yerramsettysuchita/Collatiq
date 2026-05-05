import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
import SummaryCard from '../../components/shared/SummaryCard';
import { getLenderCases } from '../../lib/cases';
import '../../styles/platform.css';

function fmt(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LenderDashboardPage() {
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getLenderCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pending   = cases.filter(c => ['submitted', 'under_review'].includes(c.status));
  const approved  = cases.filter(c => c.status === 'approved').length;
  const rejected  = cases.filter(c => c.status === 'rejected').length;
  const thisMonth = cases.filter(c => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const scores    = cases.map(c => c.case_decisions?.[0]?.confidence_score).filter(Boolean);
  const avgConf   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <AppShell variant="lender">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Lender workspace</p>
          <h1 className="plat-title">Dashboard</h1>
          <p className="plat-subtitle">Portfolio overview and pending review queue.</p>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : (
          <>
            <div className="plat-cards">
              <SummaryCard label="Total cases"        value={cases.length} />
              <SummaryCard label="Pending review"     value={pending.length} accent />
              <SummaryCard label="Approved"           value={approved} />
              <SummaryCard label="Rejected"           value={rejected} />
              <SummaryCard label="Cases this month"   value={thisMonth} />
              {avgConf !== null && (
                <SummaryCard label="Avg confidence" value={`${avgConf}%`} />
              )}
            </div>

            {pending.length > 0 && (
              <>
                <p className="plat-section-label">Pending review ({pending.length})</p>
                <div className="plat-table-wrap" style={{ marginBottom: 28 }}>
                  <table className="plat-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Borrower</th>
                        <th>Submitted</th>
                        <th>Market value</th>
                        <th>Confidence</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.slice(0, 8).map(c => {
                        const dec  = c.case_decisions?.[0];
                        const addr = c.property_payload?.address || 'Unknown';
                        const borrower = c.profiles?.full_name || c.profiles?.email || '—';
                        return (
                          <tr key={c.id}>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {addr}
                            </td>
                            <td>{borrower}</td>
                            <td>{fmtDate(c.created_at)}</td>
                            <td>
                              {dec
                                ? `${fmt(dec.market_value_min)} – ${fmt(dec.market_value_max)}`
                                : '—'}
                            </td>
                            <td>{dec?.confidence_score != null ? `${dec.confidence_score}%` : '—'}</td>
                            <td><StatusBadge status={c.status} /></td>
                            <td>
                              <Link to={`/lender/cases/${c.id}`} className="plat-table-link">
                                Review →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {pending.length > 8 && (
                  <div style={{ textAlign: 'right', marginBottom: 28 }}>
                    <Link to="/lender/review" className="plat-table-link">
                      View full queue ({pending.length}) →
                    </Link>
                  </div>
                )}
              </>
            )}

            {cases.length === 0 && (
              <div className="plat-empty">
                <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.25 }}>≡</div>
                <p className="plat-empty-text">No cases in the pipeline yet.</p>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                  Cases will appear here once borrowers submit property assessments. You can review valuations, approve or reject cases, and monitor your portfolio exposure.
                </p>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                  Connect Supabase + apply SQL migration to activate real data.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
