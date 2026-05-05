import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
import StatusBadge from '../../components/shared/StatusBadge';
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

export default function OwnerCasesPage() {
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate              = useNavigate();

  useEffect(() => {
    getBorrowerCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell variant="owner">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">My portal</p>
          <h1 className="plat-title">My assessments</h1>
          <p className="plat-subtitle">{loading ? '' : `${cases.length} assessment${cases.length !== 1 ? 's' : ''} on file.`}</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
            + New assessment
          </button>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : cases.length === 0 ? (
          <div className="plat-empty">
            <p className="plat-empty-text">No assessments yet. Start your first one now.</p>
            <button className="plat-btn plat-btn-primary" onClick={() => navigate('/owner/new-case')}>
              Start assessment
            </button>
          </div>
        ) : (
          <div className="plat-table-wrap">
            <table className="plat-table">
              <thead>
                <tr>
                  <th>Property address</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Market value range</th>
                  <th>Verdict</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const dec  = c.case_decisions?.[0];
                  const addr = c.property_payload?.address || 'Unknown';
                  const type = c.property_payload?.type    || '—';
                  return (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {addr}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{type}</td>
                      <td>{fmtDate(c.created_at)}</td>
                      <td>
                        {dec
                          ? `${fmt(dec.market_value_min)} – ${fmt(dec.market_value_max)}`
                          : '—'}
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
        )}
      </div>
    </AppShell>
  );
}
