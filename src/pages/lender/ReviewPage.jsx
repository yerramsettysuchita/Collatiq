import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
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

export default function ReviewPage() {
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLenderCases()
      .then(all => setCases(all.filter(c => ['submitted', 'under_review', 'decision_pending'].includes(c.status))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell variant="lender">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Lender workspace</p>
          <h1 className="plat-title">Review queue</h1>
          <p className="plat-subtitle">Cases awaiting your decision.</p>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : cases.length === 0 ? (
          <div className="plat-empty">
            <p className="plat-empty-text">No cases pending review right now.</p>
          </div>
        ) : (
          <div className="plat-table-wrap">
            <table className="plat-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Borrower</th>
                  <th>Submitted</th>
                  <th>Market value</th>
                  <th>Confidence</th>
                  <th>Engine verdict</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const dec      = c.case_decisions?.[0];
                  const addr     = c.property_payload?.address || 'Unknown';
                  const borrower = c.profiles?.full_name || c.profiles?.email || '—';
                  return (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      <td style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{dec?.recommendation || '—'}</td>
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
        )}
      </div>
    </AppShell>
  );
}
