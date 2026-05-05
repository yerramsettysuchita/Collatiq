import { jsPDF } from 'jspdf';
import { getAllAssessments } from '../lib/assessmentStorage';

/* ── RGB HELPER ───────────────────────────────────────────────────────────── */
function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/* ── FORMAT HELPERS ──────────────────────────────────────────────────────── */
function fmtINR(val) {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `Rs.${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `Rs.${(val / 100000).toFixed(1)}L`;
  return `Rs.${val.toLocaleString('en-IN')}`;
}

function fmtDate(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd  = String(d.getDate()).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${min} IST`;
}

/* ── MAIN EXPORT ─────────────────────────────────────────────────────────── */
export function exportValuationMemo(results, _formInputs) {
  const doc  = new jsPDF('p', 'mm', 'a4');
  const W    = 210;
  const ML   = 14;
  const MR   = 14;
  const TW   = W - ML - MR;
  const baseUrl = (typeof process !== 'undefined' && process.env?.REACT_APP_BASE_URL)
    || 'collatiq.vercel.app';

  let cy = 0;

  /* ── Page-break guard ── */
  function maybeNewPage(needed = 12) {
    if (cy + needed > 270) {
      doc.addPage();
      cy = 16;
    }
  }

  /* ── Eyebrow label ── */
  function eyebrow(text, x, y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...rgb('#9A9A94'));
    doc.text(text.toUpperCase(), x, y);
  }

  /* ── HR ── */
  function hr(y) {
    doc.setDrawColor(...rgb('#E8E7E1'));
    doc.setLineWidth(0.4);
    doc.line(ML, y, W - MR, y);
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 1 — HEADER BAND  (28mm)
  ════════════════════════════════════════════════════════════════════════ */
  doc.setFillColor(...rgb('#1A1A18'));
  doc.rect(0, 0, W, 28, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('COLLATIQ', ML, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...rgb('#9A9A94'));
  doc.text('Collateral Intelligence Report', ML, 20);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...rgb('#9A9A94'));
  const rX = W - MR;
  doc.text(results.valuationId || 'CLQ-XXXX', rX, 10, { align: 'right' });
  doc.text(fmtDate(results.timestamp), rX, 16, { align: 'right' });
  doc.text(`Model ${results.modelVersion || 'v2.0'}`, rX, 22, { align: 'right' });

  cy = 28;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 2 — COLLATERAL HEALTH SCORE BAND  (18mm)
  ════════════════════════════════════════════════════════════════════════ */
  const hs = results.collateralHealthScore;
  const hb = results.collateralHealthBand || '';
  let hsBg, hsText;
  if (!hs || hs >= 650)  { hsBg = '#E8F5EE'; hsText = '#1A7F5A'; }
  else if (hs >= 500)    { hsBg = '#FDF3E3'; hsText = '#C07A1A'; }
  else                   { hsBg = '#FDE8E6'; hsText = '#C0392B'; }

  doc.setFillColor(...rgb(hsBg));
  doc.rect(0, cy, W, 18, 'F');

  eyebrow('COLLATERAL HEALTH SCORE', ML, cy + 6);

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...rgb(hsText));
  doc.text(hs != null ? String(hs) : '—', ML, cy + 15);

  const scoreWidth = doc.getTextWidth(hs != null ? String(hs) : '—');
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...rgb('#9A9A94'));
  doc.text('/ 850', ML + scoreWidth + 1, cy + 15);

  const hbLines = doc.splitTextToSize(hb, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...rgb(hsText));
  doc.text(hbLines, W - MR, cy + 10, { align: 'right' });

  cy += 18;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 3 — PROPERTY DETAILS BAND  (14mm)
  ════════════════════════════════════════════════════════════════════════ */
  doc.setFillColor(...rgb('#F5F4F0'));
  doc.rect(0, cy, W, 14, 'F');

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...rgb('#1A1A18'));
  const addrLines = doc.splitTextToSize(results.address || '—', TW * 0.70);
  doc.text(addrLines[0] || '', ML, cy + 7);

  const metaParts = [
    results.propertyType ? results.propertyType.toUpperCase() : null,
    results.subtype      ? results.subtype.toUpperCase() : null,
    (results.areaSqft || results.area)
      ? `${Number(results.areaSqft || results.area).toLocaleString('en-IN')} sqft` : null,
    results.zone ? `Zone: ${results.zone}` : null,
    results.circleRatePerSqft ? `CR: Rs.${results.circleRatePerSqft}/sqft` : null,
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...rgb('#4A5568'));
  doc.text(metaParts.join('  ·  '), ML, cy + 12);

  cy += 14;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 4 — VERDICT BAND  (22mm)
  ════════════════════════════════════════════════════════════════════════ */
  const vCode = results.verdictCode || '';
  let vBg, vColor;
  if      (vCode === 'SANCTION_RECOMMENDED') { vBg = '#E8F5EE'; vColor = '#1A7F5A'; }
  else if (vCode === 'CONDITIONAL_REVIEW')   { vBg = '#FDF3E3'; vColor = '#C07A1A'; }
  else if (vCode === 'REJECT')               { vBg = '#FCC8C5'; vColor = '#8B0000'; }
  else                                       { vBg = '#FDE8E6'; vColor = '#C0392B'; }

  doc.setFillColor(...rgb(vBg));
  doc.rect(0, cy, W, 22, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...rgb(vColor));
  doc.text(results.verdictLabel || results.verdict || 'Verdict', ML, cy + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...rgb(vColor));
  doc.text(`Recommended LTV Band: ${results.ltvBand || results.ltv_band || '—'}`, ML, cy + 16);

  if (results.recommendedAction) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...rgb('#4A5568'));
    const raLines = doc.splitTextToSize(results.recommendedAction, 70);
    doc.text(raLines, W - MR, cy + 8, { align: 'right' });
  }

  cy += 22;

  hr(cy); cy += 6;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 5 — METRIC GRID  (26mm, 3 columns)
  ════════════════════════════════════════════════════════════════════════ */
  const confPct = results.confidenceScore
    ?? Math.round((results.confidence || 0) * 100);
  const colW = TW / 3;

  const metricDefs = [
    {
      label: 'MARKET VALUE RANGE',
      big:   `${fmtINR(results.mv_low)} – ${fmtINR(results.mv_high)}`,
      sub:   `Distress Value: ${fmtINR(results.dv_low)} – ${fmtINR(results.dv_high)}`,
    },
    {
      label: 'RESALE POTENTIAL',
      big:   `${results.rpi ?? '—'} / 100`,
      sub:   `Time to Exit: ${results.ttl_low ?? '—'}–${results.ttl_high ?? '—'} days`,
    },
    {
      label: 'CONFIDENCE',
      big:   `${confPct}%`,
      sub:   results.confidenceTier
        ? results.confidenceTier[0].toUpperCase() + results.confidenceTier.slice(1)
        : '',
    },
  ];

  metricDefs.forEach((m, i) => {
    const x = ML + i * colW;
    if (i > 0) {
      doc.setDrawColor(...rgb('#E8E7E1'));
      doc.setLineWidth(0.3);
      doc.line(x - 1, cy, x - 1, cy + 24);
    }
    eyebrow(m.label, x, cy + 5);

    doc.setFont('times', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...rgb('#1A1A18'));
    doc.text(m.big, x, cy + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...rgb('#4A5568'));
    doc.text(m.sub, x, cy + 21);
  });

  cy += 24;
  hr(cy); cy += 6;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 6 — DECISION REASONS
  ════════════════════════════════════════════════════════════════════════ */
  const reasons     = results.decisionReasons   || [];
  const escalations = results.escalationFlags   || [];

  if (reasons.length > 0) {
    maybeNewPage(20);
    eyebrow('WHY THIS VERDICT', ML, cy);
    cy += 5;
    reasons.forEach(r => {
      maybeNewPage(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...rgb('#1A1A18'));
      const lines = doc.splitTextToSize(`▪ ${r}`, TW - 4);
      doc.text(lines, ML + 2, cy);
      cy += lines.length * 4.5 + 1;
    });
    cy += 2;
  }

  if (escalations.length > 0) {
    maybeNewPage(14);
    eyebrow('REQUIRES HUMAN REVIEW', ML, cy);
    cy += 5;
    escalations.forEach(f => {
      maybeNewPage(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...rgb('#C07A1A'));
      const lines = doc.splitTextToSize(`⚠ ${f}`, TW - 4);
      doc.text(lines, ML + 2, cy);
      cy += lines.length * 4 + 1;
    });
    cy += 2;
  }

  hr(cy); cy += 6;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 7 — ANOMALY DETECTION
  ════════════════════════════════════════════════════════════════════════ */
  const fraudFlags = results.fraudFlags   || [];
  const fraudLevel = results.fraudRiskLevel || 'clean';

  maybeNewPage(16);
  eyebrow('ANOMALY DETECTION REPORT', ML, cy);
  cy += 5;

  if (fraudFlags.length === 0 || fraudLevel === 'clean') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...rgb('#1A7F5A'));
    doc.text('No significant anomalies detected — all checks passed.', ML, cy);
    cy += 7;
  } else {
    fraudFlags.forEach(f => {
      maybeNewPage(10);
      const sevColors = { critical: '#C0392B', warning: '#C07A1A', info: '#4A5568' };
      const sc = sevColors[f.severity] || '#4A5568';
      const sev = `[${(f.severity || 'INFO').toUpperCase()}]`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb(sc));
      doc.text(sev, ML, cy);
      const sw = doc.getTextWidth(sev);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...rgb(sc));
      const fl = doc.splitTextToSize(f.description || f.text || '', TW - sw - 4);
      doc.text(fl, ML + sw + 2, cy);
      cy += fl.length * 4 + 2;
    });
  }

  hr(cy); cy += 6;

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 8 — CONFIDENCE ANALYSIS
  ════════════════════════════════════════════════════════════════════════ */
  const drivers = results.confidenceDrivers || [];
  if (drivers.length > 0) {
    maybeNewPage(16);
    eyebrow('CONFIDENCE ANALYSIS', ML, cy);
    cy += 5;
    drivers.forEach(d => {
      maybeNewPage(7);
      const isPos  = d.impact === 'positive';
      const sign   = isPos ? '+' : '−';
      const color  = isPos ? '#1A7F5A' : '#C0392B';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb(color));
      doc.text(sign, ML, cy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...rgb('#4A5568'));
      const lines = doc.splitTextToSize(d.reason || d.factor || '', TW - 8);
      doc.text(lines, ML + 5, cy);
      cy += lines.length * 4 + 1;
    });
    cy += 2;
    hr(cy); cy += 6;
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 9 — VALUE DRIVERS TABLE
  ════════════════════════════════════════════════════════════════════════ */
  const valueDrivers = results.drivers || results.allAdjustments || [];
  if (valueDrivers.length > 0) {
    maybeNewPage(22);
    eyebrow('VALUE DRIVERS', ML, cy);
    cy += 4;

    doc.setFillColor(...rgb('#F5F4F0'));
    doc.rect(ML, cy, TW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...rgb('#4A5568'));
    doc.text('FACTOR', ML + 2, cy + 4);
    doc.text('CONTRIBUTION', ML + TW * 0.75, cy + 4);
    cy += 6;

    valueDrivers.forEach((d, i) => {
      maybeNewPage(7);
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 248);
        doc.rect(ML, cy, TW, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...rgb('#1A1A18'));
      doc.text(d.label || '', ML + 2, cy + 4);

      const dir  = d.dir ?? (d.impact > 0 ? 1 : d.impact < 0 ? -1 : 0);
      const imp  = d.impact ?? 0;
      const sign = dir >= 0 ? '+' : '';
      const ic   = imp > 0 ? '#1A7F5A' : imp < 0 ? '#C0392B' : '#4A5568';
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...rgb(ic));
      doc.text(`${sign}${imp}%`, ML + TW * 0.75, cy + 4);
      cy += 6;
    });

    cy += 3;
    hr(cy); cy += 6;
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 10 — DECISION MEMO
  ════════════════════════════════════════════════════════════════════════ */
  const memo = results.decisionMemo || '';
  if (memo) {
    maybeNewPage(16);
    eyebrow('CREDIT COMMITTEE MEMO', ML, cy);
    cy += 5;

    memo.split('\n').forEach(line => {
      if (!line.trim()) { cy += 2; return; }
      maybeNewPage(8);

      const isHeader = line.trim() === line.trim().toUpperCase()
        && line.trim().length > 3
        && !line.trim().endsWith('.');

      if (isHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...rgb('#4A5568'));
        doc.text(line.trim(), ML, cy);
        cy += 5;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...rgb('#1A1A18'));
        const wrapped = doc.splitTextToSize(line, TW);
        doc.text(wrapped, ML, cy);
        cy += wrapped.length * 4.2;
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 10a — LIQUIDITY SIGNALS
     Split confidence drivers into top positive / top negative signals.
  ════════════════════════════════════════════════════════════════════════ */
  const allDrivers = results.confidenceDrivers || [];
  const posDrivers = allDrivers.filter(d => d.impact === 'positive').slice(0, 4);
  const negDrivers = allDrivers.filter(d => d.impact === 'negative').slice(0, 4);

  if (posDrivers.length > 0 || negDrivers.length > 0) {
    maybeNewPage(24);
    eyebrow('LIQUIDITY SIGNALS', ML, cy);
    cy += 5;

    posDrivers.forEach(d => {
      maybeNewPage(7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb('#1A7F5A'));
      doc.text('+ ', ML, cy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...rgb('#1A1A18'));
      const lines = doc.splitTextToSize(d.reason || d.factor || '', TW - 8);
      doc.text(lines, ML + 6, cy);
      cy += lines.length * 4.2 + 1;
    });

    negDrivers.forEach(d => {
      maybeNewPage(7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb('#C0392B'));
      doc.text('− ', ML, cy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...rgb('#1A1A18'));
      const lines = doc.splitTextToSize(d.reason || d.factor || '', TW - 8);
      doc.text(lines, ML + 6, cy);
      cy += lines.length * 4.2 + 1;
    });

    hr(cy); cy += 6;
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 10b — NOTES
     Look up user-saved notes from assessmentStorage by valuationId.
  ════════════════════════════════════════════════════════════════════════ */
  let savedNotes = '';
  try {
    const entries  = getAllAssessments();
    const matched  = entries.find(e => e.id === results.valuationId);
    savedNotes     = matched?.notes || '';
  } catch {}

  if (savedNotes.trim()) {
    maybeNewPage(20);
    eyebrow('NOTES', ML, cy);
    cy += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...rgb('#4A5568'));
    const noteLines = doc.splitTextToSize(savedNotes.trim(), TW);
    doc.text(noteLines, ML, cy);
    cy += noteLines.length * 4.5 + 2;
    hr(cy); cy += 6;
  }

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 10c — DISCLAIMER (inline, before fixed footer)
  ════════════════════════════════════════════════════════════════════════ */
  maybeNewPage(36);
  eyebrow('DISCLAIMER', ML, cy);
  cy += 5;

  const discPoints = [
    'This report is a model-generated estimate based on available data signals, not a certified property valuation.',
    'It should not be used as the sole basis for a lending decision. Physical inspection is recommended for Conditional Review and High Risk verdicts.',
    'Confidence scores and value ranges reflect data quality and market signal availability at the time of assessment.',
    'Coverage and accuracy vary by locality. Circle rates are sourced from published government records and may not reflect recent revisions.',
  ];
  discPoints.forEach(pt => {
    maybeNewPage(10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...rgb('#4A5568'));
    const lines = doc.splitTextToSize(`▪  ${pt}`, TW - 4);
    doc.text(lines, ML + 2, cy);
    cy += lines.length * 4.2 + 2;
  });

  /* ════════════════════════════════════════════════════════════════════════
     SECTION 11 — FOOTER BAND  (fixed at bottom of last page)
  ════════════════════════════════════════════════════════════════════════ */
  const footY = 279;
  doc.setFillColor(...rgb('#F5F4F0'));
  doc.rect(0, footY, W, 18, 'F');
  hr(footY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...rgb('#4A5568'));
  doc.text('For decision-support use only. Not a certified valuation.', ML, footY + 6);

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...rgb('#1A1A18'));
  doc.text('Powered by Collatiq', W - MR, footY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...rgb('#9A9A94'));
  doc.text(baseUrl, W - MR, footY + 13, { align: 'right' });

  /* ── Save ──────────────────────────────────────────────────────────────── */
  const addrWord = (results.address || 'Property').split(/[\s,]/)[0].replace(/[^a-zA-Z0-9]/g, '');
  const vid = (results.valuationId || 'report').replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`Collatiq-Report-${addrWord}-${vid}.pdf`);
}
