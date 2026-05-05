import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
import SummaryCard from '../../components/shared/SummaryCard';
import { getBorrowerCases } from '../../lib/cases';
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

export default function OwnerDashboardPage() {
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate              = useNavigate();

  useEffect(() => {
    getBorrowerCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total     = cases.length;
  const approved  = cases.filter(c => c.status === 'approved').length;
  const pending   = cases.filter(c => ['submitted','under_review','decision_pending'].includes(c.status)).length;
  const recent    = cases.slice(0, 5);

  const lastCase  = cases[0];
  const lastVal   = lastCase?.case_decisions?.[0];

  return (
    <AppShell variant="owner">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Overview</p>
          <h1 className="plat-title">Dashboard</h1>
          <p className="plat-subtitle">Track your property assessments and their status.</p>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : (
          <>
            <div className="plat-cards">
              <SummaryCard label="Total assessments" value={total} />
              <SummaryCard label="Approved" value={approved} accent />
              <SummaryCard label="Pending review" value={pending} />
              <SummaryCard
                label="Last assessed"
                value={lastCase ? fmtDate(lastCase.created_at) : '—'}
              />
              {lastVal && (
                <SummaryCard
                  label="Last market value"
                  value={fmt(lastVal.market_value_min)}
                  sub={lastVal.market_value_max ? `to ${fmt(lastVal.market_value_max)}` : undefined}
                />
              )}
            </div>

            {total === 0 ? (
              <div className="plat-empty">
                <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.25 }}>⊞</div>
                <p className="plat-empty-text">No assessments on file yet.</p>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
                  Fill in your property details and the engine will return a full valuation report — market value, liquidity score, risk flags, and a lending verdict — in under 30 seconds.
                </p>
                <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
                  Start your first assessment →
                </button>
              </div>
            ) : (
              <>
                <p className="plat-section-label">Recent assessments</p>
                <div className="plat-table-wrap">
                  <table className="plat-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Date</th>
                        <th>Market value</th>
                        <th>Verdict</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(c => {
                        const dec = c.case_decisions?.[0];
                        const addr = c.property_payload?.address || 'Unknown address';
                        return (
                          <tr key={c.id}>
                            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {addr}
                            </td>
                            <td>{fmtDate(c.created_at)}</td>
                            <td>
                              {dec ? `${fmt(dec.market_value_min)} – ${fmt(dec.market_value_max)}` : '—'}
                            </td>
                            <td>{dec?.recommendation || '—'}</td>
                            <td><StatusBadge status={c.status} /></td>
                            <td>
                              <Link to={`/owner/cases/${c.id}`} className="plat-table-link">
                                View →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {total > 5 && (
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Link to="/owner/cases" className="plat-table-link">View all {total} assessments →</Link>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: 32 }}>
              <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
                + New assessment
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
