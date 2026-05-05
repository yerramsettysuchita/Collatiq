import './StatusBadge.css';

const STATUS_CONFIG = {
  draft:            { label: 'Draft',            cls: 'badge--draft' },
  submitted:        { label: 'Submitted',         cls: 'badge--submitted' },
  under_review:     { label: 'Under review',      cls: 'badge--review' },
  decision_pending: { label: 'Decision pending',  cls: 'badge--pending' },
  approved:         { label: 'Approved',          cls: 'badge--approved' },
  conditional:      { label: 'Conditional',       cls: 'badge--conditional' },
  rejected:         { label: 'Rejected',          cls: 'badge--rejected' },
  closed:           { label: 'Closed',            cls: 'badge--closed' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', cls: 'badge--draft' };
  return <span className={`status-badge ${cfg.cls}`}>{cfg.label}</span>;
}
