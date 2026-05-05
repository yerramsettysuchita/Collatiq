/**
 * SQL: ALTER TABLE valuations ADD COLUMN IF NOT EXISTS expires_at timestamptz;
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import './HistoryScreen.css';

const PAGE_SIZE = 10;

/* ── HELPERS ─────────────────────────────────────────────────────────────── */
function daysRemaining(expiresAt) {
  if (!expiresAt) return 999;
  return Math.floor((new Date(expiresAt) - Date.now()) / 86400000);
}

function formatINR(val) {
  if (!val) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mo} ${d.getFullYear()} at ${hh}:${mm}`;
}

function getVerdictMeta(verdict) {
  const v = (verdict || '').toLowerCase();
  if (v.includes('sanction'))    return { bg: '#F0FDF4', color: '#16A34A', key: 'sanction' };
  if (v.includes('conditional')) return { bg: '#FFFBEB', color: '#D97706', key: 'conditional' };
  return { bg: '#FEF2F2', color: '#DC2626', key: 'risk' };
}

/* ── EXPIRY PILL ──────────────────────────────────────────────────────────── */
function ExpiryPill({ days }) {
  if (days > 60) return <span className="hs-pill hs-pill--valid">Valid · {days}d remaining</span>;
  if (days > 29) return <span className="hs-pill hs-pill--amber">Expiring · {days}d</span>;
  if (days > 0)  return <span className="hs-pill hs-pill--red">Expires soon · {days}d</span>;
  return <span className="hs-pill hs-pill--expired">Expired · Revalidate</span>;
}

/* ── EMPTY STATE ILLUSTRATION ─────────────────────────────────────────────── */
function HouseIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path d="M10 42L40 14L70 42" stroke="#C8C7BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 36V66H62V36" stroke="#C8C7BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="31" y="46" width="18" height="20" rx="1" stroke="#C8C7BE" strokeWidth="2"/>
      <rect x="22" y="36" width="13" height="12" rx="1" stroke="#C8C7BE" strokeWidth="2"/>
      <rect x="45" y="36" width="13" height="12" rx="1" stroke="#C8C7BE" strokeWidth="2"/>
    </svg>
  );
}

/* ── MAIN COMPONENT ───────────────────────────────────────────────────────── */
export default function HistoryScreen({ user, onBack, onRevalidate, onViewReport, onAssess }) {
  const [valuations, setValuations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [page,       setPage]       = useState(1);

  const CACHE_KEY = user?.id ? `collatiq_history_${user.id}` : null;

  const fetchValuations = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    supabase
      .from('valuations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (err) {
          // Try sessionStorage fallback
          try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
              setValuations(JSON.parse(cached));
              setError(null);
            } else {
              setError(err.message);
            }
          } catch {
            setError(err.message);
          }
        } else {
          const rows = data || [];
          setValuations(rows);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch { /* quota */ }
        }
        setLoading(false);
      });
  }, [user, CACHE_KEY]);

  useEffect(() => { fetchValuations(); }, [fetchValuations]);

  /* Derived counts */
  const total       = valuations.length;
  const cSanction   = valuations.filter(v => getVerdictMeta(v.verdict).key === 'sanction').length;
  const cConditional = valuations.filter(v => getVerdictMeta(v.verdict).key === 'conditional').length;
  const cRisk       = valuations.filter(v => getVerdictMeta(v.verdict).key === 'risk').length;

  /* Filter + search */
  const filtered = valuations.filter(v => {
    const addr = (v.address || '').toLowerCase();
    const matchSearch = !search || addr.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || getVerdictMeta(v.verdict).key === filter;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (f) => { setFilter(f); setPage(1); };
  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };

  /* Actions */
  const handleRevalidate = (val) => {
    const r = val.full_result || {};
    onRevalidate({
      address:   r.address     || val.address || '',
      type:      r.propertyType || '',
      subtype:   r.subtype      || '',
      area:      String(r.areaSqft || r.area || ''),
      floor:     String(r.floorNumber || r.floor || ''),
      age:       r.ageBand    || r.age    || '',
      occupancy: r.occupancy  || '',
      legal:     r.legalStatus || r.legal || '',
    });
  };

  const handleViewReport = (val) => {
    const r = val.full_result;
    if (r && onViewReport) onViewReport(r);
  };

  /* ── RENDER ──────────────────────────────────────────────────────────────── */
  return (
    <div className="hs-screen">
      {/* Topbar */}
      <div className="hs-topbar">
        <button className="hs-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="hs-title">Valuation History</span>
      </div>

      {/* Summary strip */}
      {!loading && !error && total > 0 && (
        <div className="hs-summary-strip">
          <div className="hs-stat-cell">
            <span className="hs-stat-num">{total}</span>
            <span className="hs-stat-label">Total Assessments</span>
          </div>
          <div className="hs-stat-cell">
            <span className="hs-stat-num" style={{ color: '#16A34A' }}>{cSanction}</span>
            <span className="hs-stat-label">Sanction Recommended</span>
          </div>
          <div className="hs-stat-cell">
            <span className="hs-stat-num" style={{ color: '#D97706' }}>{cConditional}</span>
            <span className="hs-stat-label">Conditional Review</span>
          </div>
          <div className="hs-stat-cell">
            <span className="hs-stat-num" style={{ color: '#DC2626' }}>{cRisk}</span>
            <span className="hs-stat-label">High Risk / Reject</span>
          </div>
        </div>
      )}

      <div className="hs-body">
        {/* Loading — shimmer skeletons */}
        {loading && (
          <div className="hs-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="hs-skeleton-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="hs-skeleton-line hs-skeleton-line--title" />
                    <div className="hs-skeleton-line hs-skeleton-line--subtitle" />
                  </div>
                  <div className="hs-skeleton-line" style={{ width: '80px', height: '22px', borderRadius: '3px', flexShrink: 0 }} />
                </div>
                <div className="hs-skeleton-metrics">
                  <div className="hs-skeleton-metric" />
                  <div className="hs-skeleton-metric" />
                  <div className="hs-skeleton-metric" />
                  <div className="hs-skeleton-metric" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="hs-error-state">
            <p className="hs-error-text">Could not load valuations. Please try again.</p>
            <button className="hs-retry-btn" onClick={fetchValuations}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && total === 0 && (
          <div className="hs-empty-state">
            <HouseIllustration />
            <h2 className="hs-empty-heading">No valuations yet</h2>
            <p className="hs-empty-sub">Assess your first property to see your history here.</p>
            <button className="hs-assess-btn" onClick={onAssess || onBack}>
              Assess a property
            </button>
          </div>
        )}

        {/* List */}
        {!loading && !error && total > 0 && (
          <>
            {/* Search + filter */}
            <div className="hs-filter-row">
              <div className="hs-search-wrap">
                <svg className="hs-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <input
                  className="hs-search-input"
                  type="text"
                  placeholder="Search by address…"
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="hs-filter-pills">
                {[
                  { key: 'all',         label: 'All' },
                  { key: 'sanction',    label: 'Sanction' },
                  { key: 'conditional', label: 'Conditional' },
                  { key: 'risk',        label: 'High Risk' },
                ].map(f => (
                  <button
                    key={f.key}
                    className={`hs-filter-pill ${filter === f.key ? 'hs-filter-pill--active' : ''}`}
                    onClick={() => handleFilterChange(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {paged.length === 0 ? (
              <div className="hs-no-results">No valuations match your filter.</div>
            ) : (
              <div className="hs-list">
                {paged.map((val, i) => {
                  const r    = val.full_result || {};
                  const days = daysRemaining(val.expires_at);
                  const vm   = getVerdictMeta(val.verdict);
                  const hs   = r.collateralHealthScore;
                  const type = r.propertyType || '';
                  const sub  = r.subtype || '';
                  const mvL  = r.mv_low;
                  const mvH  = r.mv_high;
                  const rpi  = r.rpi;
                  const conf = r.confidenceScore
                    ?? (r.confidence != null ? Math.round(r.confidence * 100) : null);

                  return (
                    <div
                      key={val.id || i}
                      className="hs-card"
                      style={{ '--verdict-color': vm.color }}
                    >
                      {/* Top section */}
                      <div className="hs-card-top">
                        <div className="hs-card-left">
                          <div className="hs-address">{val.address || r.address || '—'}</div>
                          {(type || sub) && (
                            <div className="hs-type">
                              {type && (type[0].toUpperCase() + type.slice(1))}
                              {sub  && ` · ${sub[0].toUpperCase() + sub.slice(1)}`}
                            </div>
                          )}
                          <div className="hs-date">{formatDate(val.created_at)}</div>
                        </div>
                        <div className="hs-card-right">
                          <span className="hs-verdict-badge"
                            style={{ background: vm.bg, color: vm.color }}>
                            {val.verdict || '—'}
                          </span>
                          <ExpiryPill days={days} />
                        </div>
                      </div>

                      {/* Mini metrics */}
                      <div className="hs-card-metrics">
                        {(mvL || mvH) && (
                          <div className="hs-metric">
                            <span className="hs-metric-label">Market Value</span>
                            <span className="hs-metric-val">
                              {formatINR(mvL)}–{formatINR(mvH)}
                            </span>
                          </div>
                        )}
                        {rpi != null && (
                          <div className="hs-metric">
                            <span className="hs-metric-label">RPI</span>
                            <span className="hs-metric-val">{rpi}/100</span>
                          </div>
                        )}
                        {conf != null && (
                          <div className="hs-metric">
                            <span className="hs-metric-label">Confidence</span>
                            <span className="hs-metric-val">{conf}%</span>
                          </div>
                        )}
                        {hs != null && (
                          <div className="hs-metric">
                            <span className="hs-metric-label">Health Score</span>
                            <span className="hs-metric-val hs-metric-indigo">{hs}/850</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="hs-card-actions">
                        {val.full_result && (
                          <button className="hs-view-btn" onClick={() => handleViewReport(val)}>
                            View Report
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4"
                                stroke="currentColor" strokeWidth="1.4"
                                strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                        <button className="hs-revalidate-btn" onClick={() => handleRevalidate(val)}>
                          Revalidate
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5M9.5 1.5v4H5.5"
                              stroke="currentColor" strokeWidth="1.4"
                              strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="hs-pagination">
                <button className="hs-page-btn" disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}>
                  ← Previous
                </button>
                <span className="hs-page-info">Page {page} of {totalPages}</span>
                <button className="hs-page-btn" disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
