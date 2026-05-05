import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './MonitoringScreen.css';

/* ── ILLUSTRATIVE FALLBACK PROPERTIES ─────────────────────────────────────── */
const ILLUSTRATIVE = [
  {
    id: 'demo-1',
    address: '14B Indiranagar 12th Main, Bengaluru',
    daysAgo: 78,
    mv_mid: 10500000,
    rpi: 74,
    healthScore: 698,
    annualRate: 0.08,
    zone: 'Premium',
    fullResult: null,
  },
  {
    id: 'demo-2',
    address: 'Flat 9A Bandra West, Mumbai',
    daysAgo: 145,
    mv_mid: 18400000,
    rpi: 71,
    healthScore: 672,
    annualRate: -0.055,
    zone: 'Established',
    fullResult: null,
  },
  {
    id: 'demo-3',
    address: 'Plot 22 Banjara Hills Road No 12, Hyderabad',
    daysAgo: 210,
    mv_mid: 14600000,
    rpi: 62,
    healthScore: 598,
    annualRate: 0.04,
    zone: 'Developing',
    fullResult: null,
  },
];

/* ── HELPERS ──────────────────────────────────────────────────────────────── */
function zoneToRate(zone) {
  const z = (zone || '').toLowerCase();
  if (z.includes('premium'))     return 0.08;
  if (z.includes('established')) return 0.065;
  if (z.includes('developing'))  return 0.02;
  if (z.includes('emerging'))    return 0.0;
  return -0.01;
}

function driftDirection(rate) {
  if (rate > 0.02)  return 'UP';
  if (rate < -0.01) return 'DOWN';
  return 'STABLE';
}

function computeCurrentValue(mvMid, daysAgo, annualRate) {
  return Math.round(mvMid * (1 + annualRate * (daysAgo / 365)));
}

function formatINR(val) {
  if (!val) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

/* ── SPARKLINE ────────────────────────────────────────────────────────────── */
function Sparkline({ mvMid, annualRate, daysAgo, direction }) {
  const POINTS = 8;
  const H = 48;
  const VW = 260;

  const interval = Math.max(Math.ceil(daysAgo / (POINTS - 1)), 10);
  const vals = Array.from({ length: POINTS }, (_, i) => {
    const d = Math.min(i * interval, daysAgo);
    return mvMid * (1 + annualRate * (d / 365));
  });

  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = max - min || mvMid * 0.01;

  const toX = (i) => 5 + (i / (POINTS - 1)) * (VW - 10);
  const toY = (v) => (H - 8) - ((v - min) / range) * (H - 16);

  const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const strokeColor = direction === 'UP' ? '#16A34A' : direction === 'DOWN' ? '#DC2626' : '#9A9A94';
  const lastX = toX(POINTS - 1);
  const lastY = toY(vals[POINTS - 1]);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="4" fill={strokeColor}/>
    </svg>
  );
}

/* ── DRIFT PILL ───────────────────────────────────────────────────────────── */
function DriftPill({ direction }) {
  if (direction === 'UP')
    return <span className="mon-drift-pill mon-drift-pill--up">↑ Value Appreciating</span>;
  if (direction === 'DOWN')
    return <span className="mon-drift-pill mon-drift-pill--down">↓ Value Declining</span>;
  return <span className="mon-drift-pill mon-drift-pill--stable">→ Stable</span>;
}

/* ── MONITORING CARD ──────────────────────────────────────────────────────── */
function MonitoringCard({ prop, onRevalue, onViewReport }) {
  const { address, daysAgo, mv_mid, healthScore, annualRate, fullResult } = prop;
  const currentMv  = computeCurrentValue(mv_mid, daysAgo, annualRate);
  const direction  = driftDirection(annualRate);
  const driftPct   = (annualRate * (daysAgo / 365) * 100).toFixed(1);
  const isOverdue  = daysAgo > 180;

  return (
    <div className="mon-card">
      <div className="mon-card-top">
        <div className="mon-card-address">{address}</div>
        <DriftPill direction={direction} />
      </div>

      {isOverdue && (
        <div className="mon-overdue-alert">
          This property is due for mandatory revaluation. Original assessment is over 180 days old.
        </div>
      )}

      <div className="mon-metrics">
        <div className="mon-metric">
          <span className="mon-metric-label">Original Value</span>
          <span className="mon-metric-val">{formatINR(mv_mid)}</span>
        </div>
        <div className="mon-metric">
          <span className="mon-metric-label">Current Estimate</span>
          <span className="mon-metric-val">{formatINR(currentMv)}</span>
          <span className={`mon-drift-pct mon-drift-pct--${direction.toLowerCase()}`}>
            {parseFloat(driftPct) >= 0 ? '+' : ''}{driftPct}%
          </span>
        </div>
        <div className="mon-metric">
          <span className="mon-metric-label">Days Monitored</span>
          <span className="mon-metric-val">{daysAgo}d</span>
        </div>
        <div className="mon-metric">
          <span className="mon-metric-label">Collateral Health</span>
          <span className="mon-metric-val">{healthScore}{typeof healthScore === 'number' ? ' / 850' : ''}</span>
        </div>
      </div>

      <div className="mon-sparkline-wrap">
        <div className="mon-sparkline-label">Value trend since sanction</div>
        <Sparkline mvMid={mv_mid} annualRate={annualRate} daysAgo={daysAgo} direction={direction} />
      </div>

      <div className="mon-card-actions">
        <button className="mon-btn-primary" onClick={() => onRevalue(prop)}>
          Revalue Now
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5M9.5 1.5v4H5.5"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {fullResult && (
          <button className="mon-btn-ghost" onClick={() => onViewReport(fullResult)}>
            View Original Report
          </button>
        )}
      </div>
    </div>
  );
}

/* ── MAIN COMPONENT ───────────────────────────────────────────────────────── */
export default function MonitoringScreen({ user, onBack, onRevalidate, onViewReport }) {
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('valuations')
      .select('*')
      .eq('user_id', user.id)
      .ilike('verdict', '%sanction%')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error: err }) => {
        if (err) {
          setProperties(ILLUSTRATIVE);
          setUsingFallback(true);
          setLoading(false);
          return;
        }
        const real = (data || []).map(row => {
          const r        = row.full_result || {};
          const daysAgo  = Math.max(1, Math.floor((Date.now() - new Date(row.created_at)) / 86400000));
          const mv_mid   = r.mv_mid || Math.round(((r.mv_low || 0) + (r.mv_high || 0)) / 2) || 0;
          const zone     = r.zone || r.localityGrade || '';
          const annualRate = zoneToRate(zone);
          return {
            id:          row.id,
            address:     row.address || r.address || '—',
            daysAgo,
            mv_mid,
            rpi:         r.rpi || 50,
            healthScore: r.collateralHealthScore || '—',
            annualRate,
            fullResult:  r,
          };
        });

        const combined = [...real];
        if (combined.length < 3) {
          combined.push(...ILLUSTRATIVE.slice(0, Math.max(0, 3 - combined.length)));
        }

        setProperties(combined);
        setLoading(false);
      });
  }, [user]);

  const totalUp   = properties.filter(p => driftDirection(p.annualRate) === 'UP').length;
  const totalDown = properties.filter(p => driftDirection(p.annualRate) === 'DOWN').length;

  const handleRevalue = (prop) => {
    const r = prop.fullResult || {};
    onRevalidate({
      address:   prop.address,
      type:      r.propertyType || '',
      subtype:   r.subtype      || '',
      area:      String(r.areaSqft || r.area || ''),
      floor:     String(r.floorNumber || r.floor || ''),
      age:       r.ageBand    || r.age    || '',
      occupancy: r.occupancy  || '',
      legal:     r.legalStatus || r.legal || '',
    });
  };

  return (
    <div className="mon-screen">
      <div className="mon-topbar">
        <button className="mon-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="mon-topbar-title">Portfolio Monitoring</span>
      </div>

      <div className="mon-body">
        <div className="mon-page-header">
          <h1 className="mon-heading">Portfolio Monitoring</h1>
          <p className="mon-subheading">
            Tracking collateral value and liquidity drift across your sanctioned portfolio
          </p>
        </div>

        {usingFallback && (
          <div className="mon-fallback-banner" role="status">
            Showing illustrative data. Connect to view your actual portfolio.
          </div>
        )}

        {!loading && (
          <div className="mon-summary-strip">
            <div className="mon-stat">
              <span className="mon-stat-num">{properties.length}</span>
              <span className="mon-stat-label">Properties Monitored</span>
            </div>
            <div className="mon-stat">
              <span className="mon-stat-num mon-stat-num--up">{totalUp}</span>
              <span className="mon-stat-label">Positive Drift</span>
            </div>
            <div className="mon-stat">
              <span className="mon-stat-num mon-stat-num--down">{totalDown}</span>
              <span className="mon-stat-label">Negative Drift</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mon-loading">Loading your sanctioned portfolio…</div>
        ) : (
          <div className="mon-list">
            {properties.map(prop => (
              <MonitoringCard
                key={prop.id}
                prop={prop}
                onRevalue={handleRevalue}
                onViewReport={onViewReport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
