import './SummaryCard.css';

export default function SummaryCard({ label, value, sub, accent, onClick }) {
  return (
    <div className={`summary-card${accent ? ' summary-card--accent' : ''}${onClick ? ' summary-card--clickable' : ''}`} onClick={onClick}>
      <div className="sc-label">{label}</div>
      <div className="sc-value">{value}</div>
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );
}
