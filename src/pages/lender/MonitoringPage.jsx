import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/shared/AppShell';
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

export default function MonitoringPage() {
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLenderCases()
      .then(all => setCases(all.filter(c => c.status === 'approved')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalExposure = cases.reduce((sum, c) => {
    const dec = c.case_decisions?.[0];
    return sum + (Number(dec?.market_value_max) || 0);
  }, 0);

  const avgRpi = (() => {
    const rpis = cases.map(c => c.case_decisions?.[0]?.resale_potential_index).filter(Boolean);
    return rpis.length ? Math.round(rpis.reduce((a, b) => a + b, 0) / rpis.length) : null;
  })();

  const avgConf = (() => {
    const scores = cases.map(c => c.case_decisions?.[0]?.confidence_score).filter(Boolean);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  })();

  return (
    <AppShell variant="lender">
      <div className="plat-page">
        <div className="plat-header">
          <p className="plat-eyebrow">Lender workspace</p>
          <h1 className="plat-title">Portfolio monitoring</h1>
          <p className="plat-subtitle">Approved collateral under active monitoring.</p>
        </div>

        {loading ? (
          <div className="plat-spinner" style={{ margin: '60px auto' }} />
        ) : (
          <>
            <div className="plat-cards" style={{ marginBottom: 28 }}>
              <SummaryCard label="Approved cases" value={cases.length} accent />
              <SummaryCard
                label="Total collateral (high)"
                value={totalExposure >= 10000000
                  ? `₹${(totalExposure / 10000000).toFixed(1)}Cr`
                  : totalExposure >= 100000
                  ? `₹${(totalExposure / 100000).toFixed(0)}L`
                  : totalExposure ? `₹${totalExposure.toLocaleString('en-IN')}` : '—'}
              />
              {avgRpi !== null && <SummaryCard label="Avg resale potential" value={`${avgRpi}/100`} />}
              {avgConf !== null && <SummaryCard label="Avg confidence" value={`${avgConf}%`} />}
            </div>

            {cases.length === 0 ? (
              <div className="plat-empty">
                <p className="plat-empty-text">No approved cases in the portfolio yet.</p>
              </div>
            ) : (
              <div className="plat-table-wrap">
                <table className="plat-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Borrower</th>
                      <th>Approved on</th>
                      <th>Market value range</th>
                      <th>Resale index</th>
                      <th>LTV band</th>
                      <th>Confidence</th>
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
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {addr}
                          </td>
                          <td>{borrower}</td>
                          <td>{fmtDate(c.updated_at || c.created_at)}</td>
                          <td>
                            {dec
                              ? `${fmt(dec.market_value_min)} – ${fmt(dec.market_value_max)}`
                              : '—'}
                          </td>
                          <td>{dec?.resale_potential_index != null ? `${dec.resale_potential_index}/100` : '—'}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{dec?.ltv_band || '—'}</td>
                          <td>{dec?.confidence_score != null ? `${dec.confidence_score}%` : '—'}</td>
                          <td>
                            <Link to={`/lender/cases/${c.id}`} className="plat-table-link">
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
          </>
        )}
      </div>
    </AppShell>
  );
}
