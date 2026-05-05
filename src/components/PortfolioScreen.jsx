import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { computeValuation } from '../engine/valuationEngine';
import { circleRateFromKeyword } from '../engine/geoEngine';
import { exportValuationMemo } from '../engine/pdfExport';
import './PortfolioScreen.css';

/* ── CSV PARSING ──────────────────────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = parseLine(line);
      const row  = {};
      headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
      return row;
    });
}

function parseLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function csvRowToInputs(row) {
  return {
    address:   row.address || '',
    type:      (row.property_type || 'residential').toLowerCase(),
    subtype:   (row.sub_type || 'apartment').toLowerCase(),
    area:      row.area_sqft || '1000',
    floor:     row.floor || '1',
    age:       row.age_band || 'mid',
    occupancy: row.occupancy || 'self',
    legal:     row.legal_status || 'unknown',
  };
}

/* ── CHUNKED ASYNC PROCESSOR — no UI freeze on large files ─────────────── */
async function processAllRows(rows, onProgress) {
  const results  = [];
  const CHUNK_SZ = 30;
  for (let i = 0; i < rows.length; i += CHUNK_SZ) {
    const chunk = rows.slice(i, i + CHUNK_SZ);
    for (const row of chunk) {
      const inputs = csvRowToInputs(row);
      const cr     = circleRateFromKeyword(inputs.address, inputs.type);
      results.push(computeValuation({ ...inputs, _circleRate: cr }));
    }
    onProgress(Math.min(i + CHUNK_SZ, rows.length), rows.length);
    await new Promise(r => setTimeout(r, 0)); // yield to paint
  }
  return results;
}

/* ── CSV RESULT EXPORT ────────────────────────────────────────────────────── */
function exportResultsCSV(rows) {
  const headers = [
    'address', 'type', 'subtype', 'area_sqft',
    'market_value_low', 'market_value_high',
    'distress_value_low', 'distress_value_high',
    'rpi', 'confidence', 'ltv_band', 'verdict', 'flags'
  ];
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines  = [
    headers.join(','),
    ...rows.map(r => [
      escape(r.address), escape(r.propertyType), escape(r.subtype), escape(r.area || ''),
      r.mv_low, r.mv_high, r.dv_low, r.dv_high,
      r.rpi, r.confidence?.toFixed(2), escape(r.ltv_band), escape(r.verdict),
      escape((r.flags || []).map(f => f.text).join(' | ')),
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `collatiq-batch-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── HELPERS ──────────────────────────────────────────────────────────────── */
function riskRank(verdict) {
  if (verdict === 'High Risk')            return 0;
  if (verdict === 'Conditional Review')   return 1;
  if (verdict === 'Sanction Recommended') return 2;
  return 3;
}

function formatINR(val) {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

/* ── SAMPLE CSV — multi-city ──────────────────────────────────────────────── */
const SAMPLE_CSV = `address,property_type,sub_type,area_sqft,floor,age_band,occupancy,legal_status
12th Main Road Indiranagar Bengaluru 560038,residential,apartment,1350,4,mid,self,clear
80 Feet Road Koramangala 5th Block Bengaluru 560095,commercial,office,2800,6,new,rented,clear
Varthur Road Whitefield Bengaluru 560066,residential,villa,4200,1,mid,self,complex
HSR Layout Sector 2 Bengaluru 560102,residential,apartment,950,2,new,self,clear
Jayanagar 4th Block Bengaluru 560011,residential,plot,2400,0,mid,vacant,unknown
Bandra West Mumbai 400050,residential,apartment,1100,8,new,self,clear
Powai Hiranandani Mumbai 400076,residential,apartment,1450,12,new,rented,clear
Andheri West Mumbai 400058,commercial,office,3200,6,mid,rented,clear
Thane West Mumbai 400601,residential,apartment,950,4,mid,self,clear
Navi Mumbai Kharghar 410210,residential,apartment,1200,7,new,self,clear
Banjara Hills Road No 12 Hyderabad 500034,residential,villa,3800,1,new,self,clear
Gachibowli Hyderabad 500032,commercial,office,4500,5,new,rented,clear
Madhapur Hi-Tech City Hyderabad 500081,residential,apartment,1300,9,new,self,clear
Kondapur Hyderabad 500084,residential,apartment,1100,4,mid,rented,clear
Kukatpally Hyderabad 500072,residential,apartment,1050,3,mid,self,complex
Anna Nagar Chennai 600040,residential,apartment,1200,3,old,self,clear
T Nagar Chennai 600017,commercial,shop,650,0,new,rented,clear
Adyar Chennai 600020,residential,apartment,1400,2,mid,self,clear
Velachery Chennai 600042,residential,apartment,980,5,new,self,clear
OMR Sholinganallur Chennai 600119,residential,apartment,1100,7,new,rented,clear
Koregaon Park Pune 411001,residential,apartment,1300,4,mid,self,clear
Viman Nagar Pune 411014,residential,apartment,1050,6,new,self,clear
Hinjewadi Phase 1 Pune 411057,residential,apartment,950,3,new,rented,clear
Baner Pune 411045,residential,apartment,1150,5,new,self,clear
Kothrud Pune 411038,residential,apartment,1200,2,old,self,complex
Defence Colony New Delhi 110024,residential,apartment,1800,3,old,self,clear
Dwarka Sector 12 Delhi 110075,residential,apartment,1100,6,mid,self,clear
Gurgaon Sector 49 Haryana 122018,residential,apartment,1350,10,new,rented,clear
Noida Sector 150 Uttar Pradesh 201310,residential,apartment,1200,15,new,self,clear
Vasant Vihar New Delhi 110057,residential,villa,4200,1,old,vacant,unknown`;

/* ── SUB-COMPONENTS ───────────────────────────────────────────────────────── */
function SummaryStrip({ rows }) {
  const sanction    = rows.filter(r => r.verdict === 'Sanction Recommended').length;
  const conditional = rows.filter(r => r.verdict === 'Conditional Review').length;
  const risk        = rows.filter(r => r.verdict === 'High Risk').length;
  return (
    <div className="pf-summary-strip">
      <div className="pf-stat">
        <span className="pf-stat-num">{rows.length}</span>
        <span className="pf-stat-label">Properties assessed</span>
      </div>
      <div className="pf-stat pf-stat--green">
        <span className="pf-stat-num">{sanction}</span>
        <span className="pf-stat-label">Sanction recommended</span>
      </div>
      <div className="pf-stat pf-stat--amber">
        <span className="pf-stat-num">{conditional}</span>
        <span className="pf-stat-label">Conditional review</span>
      </div>
      <div className="pf-stat pf-stat--red">
        <span className="pf-stat-num">{risk}</span>
        <span className="pf-stat-label">High risk</span>
      </div>
    </div>
  );
}

function RpiBar({ rpi }) {
  return (
    <div className="pf-rpi-bar-wrap">
      <div className="pf-rpi-bar-track">
        <div className="pf-rpi-bar-fill" style={{ width: `${rpi}%` }} />
      </div>
      <span className="pf-rpi-num">{rpi}</span>
    </div>
  );
}

function VerdictPill({ verdict }) {
  const cls   = verdict === 'Sanction Recommended' ? 'pill--green'
              : verdict === 'Conditional Review'   ? 'pill--amber'
              : 'pill--red';
  const short = verdict === 'Sanction Recommended' ? 'Sanction'
              : verdict === 'Conditional Review'   ? 'Conditional'
              : 'High Risk';
  return <span className={`pf-pill ${cls}`}>{short}</span>;
}

function ExpandedRow({ result }) {
  return (
    <motion.div
      className="pf-expanded"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="pf-exp-inner">
        <div className="pf-exp-metrics">
          <div className="pf-exp-metric">
            <div className="pf-exp-eyebrow">Market value range</div>
            <div className="pf-exp-val">{formatINR(result.mv_low)} – {formatINR(result.mv_high)}</div>
          </div>
          <div className="pf-exp-metric">
            <div className="pf-exp-eyebrow">Distress sale value</div>
            <div className="pf-exp-val">{formatINR(result.dv_low)} – {formatINR(result.dv_high)}</div>
          </div>
          <div className="pf-exp-metric">
            <div className="pf-exp-eyebrow">Confidence</div>
            <div className="pf-exp-val">{result.confidence.toFixed(2)}</div>
          </div>
          <div className="pf-exp-metric">
            <div className="pf-exp-eyebrow">Recommended LTV</div>
            <div className="pf-exp-val pf-exp-val--signal">{result.ltv_band}</div>
          </div>
        </div>
        <div className="pf-exp-flags">
          <div className="pf-exp-eyebrow" style={{ marginBottom: '0.6rem' }}>Top risk flags</div>
          {result.flags.slice(0, 3).map((f, i) => (
            <div key={i} className={`pf-exp-flag flag--${f.severity}`}>
              <span className={`pf-flag-pill pill--${f.severity}`}>{f.severity}</span>
              <span className="pf-flag-txt">{f.text.slice(0, 80)}{f.text.length > 80 ? '…' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── UPLOAD ZONE ──────────────────────────────────────────────────────────── */
function UploadZone({ onParsed }) {
  const inputRef = useRef(null);
  const [dragging,  setDragging]  = useState(false);
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(null); // { done, total }

  const process = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rows = parseCSV(e.target.result);
        if (rows.length === 0) { setError('No data rows found in file. Check the format.'); return; }

        setProgress({ done: 0, total: rows.length });

        const results = await processAllRows(rows, (done, total) => {
          setProgress({ done, total });
        });

        setProgress(null);
        onParsed(results);
      } catch (err) {
        setProgress(null);
        setError('Could not parse the file. Check that columns match the sample format.');
      }
    };
    reader.readAsText(file);
  }, [onParsed]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    process(e.dataTransfer.files[0]);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'collatiq-sample-portfolio.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  if (progress) {
    const pct = Math.round((progress.done / progress.total) * 100);
    return (
      <div className="pf-upload-wrap">
        <div className="pf-progress-wrap">
          <div className="pf-progress-label">
            Processing {progress.done} of {progress.total} properties…
          </div>
          <div className="pf-progress-track">
            <div className="pf-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="pf-progress-pct">{pct}%</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-upload-wrap">
      <div
        className={`pf-drop-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="pf-drop-icon">
          <rect x="1" y="1" width="34" height="34" rx="4" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3"/>
          <path d="M18 24V12M12 18l6-6 6 6" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="pf-drop-label">Drop a CSV file here or click to browse</div>
        <div className="pf-drop-sub">Any number of properties. Results sorted by risk automatically.</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => process(e.target.files[0])}
        />
      </div>
      {error && <p className="pf-upload-error">{error}</p>}
      <button className="pf-sample-link" onClick={downloadSample}>
        Download sample CSV (30 properties · 6 cities · 19 supported)
      </button>
      <p className="pf-upload-hint">
        Required columns: address, property_type, sub_type, area_sqft, floor, age_band, occupancy, legal_status
      </p>
    </div>
  );
}

/* ── RESULTS TABLE ────────────────────────────────────────────────────────── */
function ResultsTable({ rows, onReset }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [pdfDone,     setPdfDone]     = useState(false);
  const [csvDone,     setCsvDone]     = useState(false);

  const sorted = [...rows].sort((a, b) => riskRank(a.verdict) - riskRank(b.verdict));

  const handleExportCSV = () => {
    exportResultsCSV(sorted);
    setCsvDone(true);
    setTimeout(() => setCsvDone(false), 2800);
  };

  const handleExportPDF = () => {
    const target = sorted.find(r => r.verdict === 'High Risk') || sorted[0];
    exportValuationMemo(target, target.inputs || {});
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 2800);
  };

  return (
    <div className="pf-results-wrap">
      <SummaryStrip rows={sorted} />

      <div className="pf-table-actions">
        <button className="pf-action-btn pf-action-btn--primary" onClick={handleExportCSV}>
          {csvDone ? 'Downloaded.' : `Export all ${sorted.length} results as CSV`}
        </button>
        <button className="pf-action-btn pf-action-btn--ghost" onClick={handleExportPDF}>
          {pdfDone ? 'PDF exported.' : 'Export highest-risk PDF memo'}
        </button>
        <button className="pf-action-btn pf-action-btn--ghost" onClick={onReset}>
          Assess another batch
        </button>
      </div>

      <div className="pf-table">
        <div className="pf-table-head">
          <div className="pf-th pf-th--rank">Rank</div>
          <div className="pf-th pf-th--addr">Address</div>
          <div className="pf-th pf-th--type">Type</div>
          <div className="pf-th pf-th--mv">Market value</div>
          <div className="pf-th pf-th--rpi">RPI</div>
          <div className="pf-th pf-th--conf">Confidence</div>
          <div className="pf-th pf-th--verdict">Verdict</div>
        </div>
        {sorted.map((row, i) => (
          <div key={row.valuationId || i}>
            <motion.div
              className={`pf-table-row ${expandedIdx === i ? 'expanded' : ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <div className="pf-td pf-td--rank">
                <span className={`pf-rank-badge rank--${row.verdict === 'High Risk' ? 'red' : row.verdict === 'Conditional Review' ? 'amber' : 'green'}`}>
                  {i + 1}
                </span>
              </div>
              <div className="pf-td pf-td--addr" title={row.address}>
                {(row.address || '').slice(0, 40)}{(row.address || '').length > 40 ? '…' : ''}
              </div>
              <div className="pf-td pf-td--type">{row.propertyType} / {row.subtype}</div>
              <div className="pf-td pf-td--mv pf-mono">
                {formatINR(row.mv_low)} – {formatINR(row.mv_high)}
              </div>
              <div className="pf-td pf-td--rpi"><RpiBar rpi={row.rpi} /></div>
              <div className="pf-td pf-td--conf pf-mono">{row.confidence.toFixed(2)}</div>
              <div className="pf-td pf-td--verdict"><VerdictPill verdict={row.verdict} /></div>
            </motion.div>
            <AnimatePresence>
              {expandedIdx === i && <ExpandedRow result={row} />}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ROOT ─────────────────────────────────────────────────────────────────── */
export default function PortfolioScreen({ onBack }) {
  const [results, setResults] = useState(null);

  return (
    <div className="pf-screen">
      <div className="pf-topbar">
        <button className="pf-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <span className="pf-topbar-title">Portfolio batch assessment</span>
        <span className="pf-topbar-sub">Upload a CSV. The engine scores every property and ranks them by risk.</span>
      </div>

      <div className="pf-body">
        {!results
          ? <UploadZone onParsed={setResults} />
          : <ResultsTable rows={results} onReset={() => setResults(null)} />
        }
      </div>
    </div>
  );
}
