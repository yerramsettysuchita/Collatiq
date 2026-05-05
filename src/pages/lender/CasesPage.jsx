import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
import { getLenderCases } from '../../lib/cases';
import '../../styles/platform.css';

const ALL_STATUSES = ['all', 'submitted', 'under_review', 'decision_pending', 'approved', 'conditional', 'rejected', 'closed'];

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

export default function LenderCasesPage() {
  const [cases, setCases]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    getLenderCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = cases.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter;
    const addr  = (c.property_payload?.address || '').toLowerCase();
    const name  = (c.profiles?.full_name || c.profiles?.email || '').toLowerCase();
    const q     = search.toLowerCase();
    const matchSearch = !q || addr.includes(q) || name.includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <AppShell variant="lender">
      <div className="plat-page-wide">
        <div className="plat-header">
          <p className="plat-eyebrow">Lender workspace</p>
          <h1 className="plat-title">All cases</h1>
          <p className="plat-subtitle">{loading ? '' : `${cases.length} case${cases.length !== 1 ? 's' : ''} total.`}</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="plat-form-input"
            style={{ maxWidth: 260, marginBottom: 0 }}
            placeholder="Search by address or borrower…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                className={`plat-btn ${filter === s ? 'plat-btn-primary plat-btn-sm' : 'plat-btn-ghost plat-btn-sm'}`}
                onClick={() => setFilter(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : visible.length === 0 ? (
          <div className="plat-empty">
            <p className="plat-empty-text">No cases match your filters.</p>
          </div>
        ) : (
          <div className="plat-table-wrap">
            <table className="plat-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Borrower</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Market value</th>
                  <th>Confidence</th>
                  <th>LTV band</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => {
                  const dec      = c.case_decisions?.[0];
                  const addr     = c.property_payload?.address || 'Unknown';
                  const borrower = c.profiles?.full_name || c.profiles?.email || '—';
                  const type     = c.property_payload?.type || '—';
                  return (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {addr}
                      </td>
                      <td>{borrower}</td>
                      <td>{fmtDate(c.created_at)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{type}</td>
                      <td>
                        {dec
                          ? `${fmt(dec.market_value_min)} – ${fmt(dec.market_value_max)}`
                          : '—'}
                      </td>
                      <td>{dec?.confidence_score != null ? `${dec.confidence_score}%` : '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{dec?.ltv_band || '—'}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <Link to={`/lender/cases/${c.id}`} className="plat-table-link">
                          Open →
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
