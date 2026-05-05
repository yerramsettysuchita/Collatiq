import { motion } from 'framer-motion';
import {
  compareAssessments,
  summarizeComparison,
} from '../lib/compareAssessments';
import './ComparisonView.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function verdictBadgeClass(v) {
  if (!v) return '';
  const lc = (v || '').toLowerCase();
  if (lc.includes('sanction'))    return 'cv-verdict-badge--green';
  if (lc.includes('conditional')) return 'cv-verdict-badge--amber';
  return 'cv-verdict-badge--red';
}

/* ── Metric definitions ──────────────────────────────────────────────────── */
const METRICS = [
  { key: 'mv',         label: 'Market value'     },
  { key: 'dv',         label: 'Distress value'   },
  { key: 'rpi',        label: 'Resale potential' },
  { key: 'ttl',        label: 'Time to liquidate'},
  { key: 'confidence', label: 'Confidence'       },
  { key: 'flags',      label: 'Risk flags'       },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PropertyPanel({ entry, side, onLoad, onRerun }) {
  const vclass     = verdictBadgeClass(entry.verdictCode || entry.verdict);
  const labelClass = side === 'A' ? 'cv-panel-label--a' : 'cv-panel-label--b';

  return (
    <div className="cv-panel">
      <div className="cv-panel-head">
        <div className={`cv-panel-label ${labelClass}`}>Assessment {side}</div>
        <div className="cv-panel-address">{entry.address || 'Unknown address'}</div>
        <div className="cv-panel-meta">
          {entry.city && <span>{entry.city}</span>}
          {entry.city && entry.propertyType && <span className="cv-panel-meta-sep"> · </span>}
          {entry.propertyType && (
            <span>
              {entry.propertyType}
              {entry.subtype ? ` · ${entry.subtype}` : ''}
            </span>
          )}
          {entry.areaSqft > 0 && (
            <>
              <span className="cv-panel-meta-sep"> · </span>
              <span>{entry.areaSqft.toLocaleString('en-IN')} sq ft</span>
            </>
          )}
        </div>
        {entry.verdict && (
          <div>
            <span className={`cv-verdict-badge ${vclass}`}>{entry.verdict}</span>
          </div>
        )}
        {entry.ltvBand && (
          <div className="cv-panel-ltv">LTV {entry.ltvBand}</div>
        )}
        <div className="cv-panel-timestamp">{fmtDate(entry.timestamp)}</div>
      </div>

      <div className="cv-panel-actions">
        <button className="cv-load-btn" onClick={() => onLoad(entry)}>
          Load this version <ArrowIcon />
        </button>
        <button className="cv-rerun-btn" onClick={() => onRerun(entry)}>
          Re-run with edits
        </button>
      </div>
    </div>
  );
}

function MetricRow({ row, delta }) {
  if (!delta) return null;

  const aBetter = delta.direction === 'a_better';
  const bBetter = delta.direction === 'b_better';
  const equal   = delta.direction === 'equal';

  const aClass     = aBetter ? 'cv-metric-val--better' : bBetter ? 'cv-metric-val--worse' : '';
  const bClass     = bBetter ? 'cv-metric-val--better' : aBetter ? 'cv-metric-val--worse' : '';
  const badgeClass = aBetter ? 'cv-delta-badge--a' : bBetter ? 'cv-delta-badge--b' : 'cv-delta-badge--eq';
  const badgeText  = equal ? '=' : aBetter ? '↑ A' : '↑ B';

  return (
    <div className="cv-metric-row">
      <span className="cv-metric-name">{row.label}</span>
      <span className={`cv-metric-val ${aClass}`}>{delta.fmtA || '—'}</span>
      <div className="cv-delta">
        <span className={`cv-delta-badge ${badgeClass}`}>{badgeText}</span>
        {delta.deltaLabel && (
          <span className="cv-delta-label">{delta.deltaLabel}</span>
        )}
      </div>
      <span className={`cv-metric-val cv-metric-val--b ${bClass}`}>{delta.fmtB || '—'}</span>
    </div>
  );
}

function FlagsPanel({ entry, side }) {
  const labelClass = side === 'A' ? 'cv-flags-col-label--a' : 'cv-flags-col-label--b';
  const flags = entry.topFlags || [];

  return (
    <div className="cv-flags-col">
      <div className={`cv-flags-col-label ${labelClass}`}>Assessment {side}</div>
      {flags.length === 0 ? (
        <span className="cv-flag cv-flag--none">No flags recorded</span>
      ) : (
        flags.map((f, i) => {
          const icon = f.severity === 'critical' ? '⛔' : f.severity === 'warning' ? '⚠' : 'ℹ';
          return (
            <span key={i} className={`cv-flag cv-flag--${f.severity || 'info'}`}>
              {icon} {f.text}
            </span>
          );
        })
      )}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ onBack }) {
  return (
    <div className="cv-screen">
      <div className="cv-topbar">
        <button className="cv-back" onClick={onBack}><BackIcon /> Back</button>
        <span className="cv-topbar-title">Assessment comparison</span>
      </div>
      <div className="cv-body">
        <div className="cv-empty">
          <svg className="cv-empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="16" height="28" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="26" y="10" width="16" height="28" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M20 24h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <h3 className="cv-empty-title">Select two assessments to compare</h3>
          <p className="cv-empty-sub">
            Go to Recent assessments, enable Compare mode, select exactly two entries, and tap Compare.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function ComparisonView({ entries, onBack, onLoadVersion, onRerun }) {
  if (!entries || entries.length < 2) {
    return <EmptyState onBack={onBack} />;
  }

  const [a, b]   = entries;
  const cmp      = compareAssessments(a, b);
  const summary  = summarizeComparison(a, b);

  return (
    <motion.div
      className="cv-screen"
      initial={{ opacity: 0, x: '5%' }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.16,1,0.3,1] } }}
      exit={{ opacity: 0, x: '5%', transition: { duration: 0.25 } }}
    >
      {/* Topbar */}
      <div className="cv-topbar">
        <button className="cv-back" onClick={onBack}><BackIcon /> Back</button>
        <span className="cv-topbar-title">Assessment comparison</span>
      </div>

      {/* Summary sentence */}
      <div className="cv-summary-band">
        <p className="cv-summary-text">{summary}</p>
      </div>

      <div className="cv-body">
        {/* Property panels */}
        <div className="cv-panels">
          <PropertyPanel entry={a} side="A" onLoad={onLoadVersion} onRerun={onRerun} />
          <div className="cv-vs">VS</div>
          <PropertyPanel entry={b} side="B" onLoad={onLoadVersion} onRerun={onRerun} />
        </div>

        {/* Metric table */}
        <div className="cv-metric-section">
          <div className="cv-metric-head">
            <span className="cv-metric-col-hdr">Metric</span>
            <span className="cv-metric-col-hdr cv-metric-col-hdr--a">Assessment A</span>
            <span className="cv-metric-col-hdr">Delta</span>
            <span className="cv-metric-col-hdr cv-metric-col-hdr--b">Assessment B</span>
          </div>
          {METRICS.map(row => (
            <MetricRow key={row.key} row={row} delta={cmp[row.key]} />
          ))}
        </div>

        {/* Risk flags */}
        <div className="cv-flags-section">
          <div className="cv-flags-head">Risk flags</div>
          <div className="cv-flags-body">
            <FlagsPanel entry={a} side="A" />
            <FlagsPanel entry={b} side="B" />
          </div>
        </div>

        <div className="cv-footer-note">
          Comparison is based on saved assessment data. Results reflect market conditions at the time each assessment was run.
        </div>
      </div>
    </motion.div>
  );
}
