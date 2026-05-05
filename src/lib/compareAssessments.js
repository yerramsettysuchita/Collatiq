/* ── COMPARISON HELPERS ─────────────────────────────────────────────────────
   All functions are deterministic and rule-based — no AI-generated text.
*/

function fmtINR(val) {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

/** Return mid-point of a range pair. */
function mid(low, high) {
  if (low == null && high == null) return null;
  return ((low ?? 0) + (high ?? 0)) / 2;
}

/**
 * For each comparable metric produce a delta object:
 *   { valA, valB, delta, direction: 'a_better' | 'b_better' | 'equal', badge, color }
 */
export function formatDelta(metric, a, b) {
  const directions = {
    mv:         { higherIsBetter: true  },
    dv:         { higherIsBetter: true  },
    rpi:        { higherIsBetter: true  },
    ttl:        { higherIsBetter: false }, // lower TTL = faster exit = better
    confidence: { higherIsBetter: true  },
    flags:      { higherIsBetter: false }, // fewer flags = better
  };

  const pref = directions[metric] ?? { higherIsBetter: true };

  let valA, valB, fmtA, fmtB;

  switch (metric) {
    case 'mv':
      valA = mid(a.mv_low, a.mv_high);
      valB = mid(b.mv_low, b.mv_high);
      fmtA = `${fmtINR(a.mv_low)} – ${fmtINR(a.mv_high)}`;
      fmtB = `${fmtINR(b.mv_low)} – ${fmtINR(b.mv_high)}`;
      break;
    case 'dv':
      valA = mid(a.dv_low, a.dv_high);
      valB = mid(b.dv_low, b.dv_high);
      fmtA = `${fmtINR(a.dv_low)} – ${fmtINR(a.dv_high)}`;
      fmtB = `${fmtINR(b.dv_low)} – ${fmtINR(b.dv_high)}`;
      break;
    case 'rpi':
      valA = a.rpi ?? 0;
      valB = b.rpi ?? 0;
      fmtA = `${a.rpi ?? '—'} / 100`;
      fmtB = `${b.rpi ?? '—'} / 100`;
      break;
    case 'ttl':
      valA = mid(a.ttl_low, a.ttl_high);
      valB = mid(b.ttl_low, b.ttl_high);
      fmtA = `${a.ttl_low ?? '—'}–${a.ttl_high ?? '—'} days`;
      fmtB = `${b.ttl_low ?? '—'}–${b.ttl_high ?? '—'} days`;
      break;
    case 'confidence':
      valA = a.confidenceScore ?? 0;
      valB = b.confidenceScore ?? 0;
      fmtA = `${a.confidenceScore ?? '—'}%`;
      fmtB = `${b.confidenceScore ?? '—'}%`;
      break;
    case 'flags':
      valA = (a.topFlags ?? []).length;
      valB = (b.topFlags ?? []).length;
      fmtA = `${valA} flag${valA !== 1 ? 's' : ''}`;
      fmtB = `${valB} flag${valB !== 1 ? 's' : ''}`;
      break;
    default:
      return null;
  }

  if (valA == null || valB == null) return { fmtA, fmtB, direction: 'equal', badge: '—', color: '#9B9B95' };

  const diff  = valA - valB;
  const tol   = Math.abs(valA + valB) * 0.03; // 3% tolerance = "equal"

  let direction;
  if (Math.abs(diff) <= tol) {
    direction = 'equal';
  } else {
    const aIsHigher = diff > 0;
    direction = (aIsHigher === pref.higherIsBetter) ? 'a_better' : 'b_better';
  }

  let badge = '=';
  let color = '#9B9B95';
  if (direction === 'a_better') { badge = '↑ A'; color = '#1A7F5A'; }
  if (direction === 'b_better') { badge = '↑ B'; color = '#2D3A8C'; }

  // Numeric delta label
  let deltaLabel = '';
  if (metric === 'mv' || metric === 'dv') {
    const d = Math.abs(valA - valB);
    deltaLabel = d >= 100000 ? `${(d / 100000).toFixed(1)}L diff` : '';
  } else if (metric === 'rpi') {
    deltaLabel = `${Math.abs(Math.round(diff))} pts`;
  } else if (metric === 'ttl') {
    deltaLabel = `${Math.abs(Math.round(diff))} days`;
  } else if (metric === 'confidence') {
    deltaLabel = `${Math.abs(Math.round(diff))}%`;
  }

  return { fmtA, fmtB, direction, badge, color, deltaLabel };
}

/**
 * Full comparison object across all key metrics.
 */
export function compareAssessments(a, b) {
  const metrics = ['mv', 'dv', 'rpi', 'ttl', 'confidence', 'flags'];
  const result  = {};
  for (const m of metrics) result[m] = formatDelta(m, a, b);
  return result;
}

/**
 * Deterministic one-sentence summary.
 */
export function summarizeComparison(a, b) {
  const mvA   = mid(a.mv_low,  a.mv_high)  ?? 0;
  const mvB   = mid(b.mv_low,  b.mv_high)  ?? 0;
  const rpiA  = a.rpi            ?? 0;
  const rpiB  = b.rpi            ?? 0;
  const ttlA  = mid(a.ttl_low,  a.ttl_high) ?? 999;
  const ttlB  = mid(b.ttl_low,  b.ttl_high) ?? 999;
  const confA = a.confidenceScore ?? 0;
  const confB = b.confidenceScore ?? 0;
  const flagsA = (a.topFlags ?? []).length;
  const flagsB = (b.topFlags ?? []).length;

  const verdictRank = v => {
    if (!v) return 2;
    const lc = v.toLowerCase();
    if (lc.includes('sanction')) return 0;
    if (lc.includes('conditional')) return 1;
    return 2;
  };
  const vrA = verdictRank(a.verdict);
  const vrB = verdictRank(b.verdict);

  // Score system: each signal contributes +1 for A or +1 for B
  let scoreA = 0, scoreB = 0;

  if (mvA    > mvB)    scoreA++; else if (mvB > mvA)    scoreB++;
  if (rpiA   > rpiB)   scoreA++; else if (rpiB > rpiA)  scoreB++;
  if (ttlA   < ttlB)   scoreA++; else if (ttlB < ttlA)  scoreB++;
  if (confA  > confB)  scoreA++; else if (confB > confA) scoreB++;
  if (flagsA < flagsB) scoreA++; else if (flagsB < flagsA) scoreB++;
  if (vrA    < vrB)    scoreA++; else if (vrB < vrA)    scoreB++;

  const lbl = (entry, tag) => {
    const _city = entry.city || ''; // eslint-disable-line no-unused-vars
    const addr = (entry.address || '').split(',')[0].trim();
    return tag ? `Assessment ${tag}` : (addr || 'this property');
  };

  const aLabel = lbl(a, 'A');
  const bLabel = lbl(b, 'B');

  if (scoreA === scoreB) {
    return `Both assessments show broadly similar collateral profiles with mixed trade-offs.`;
  }

  const winner = scoreA > scoreB ? aLabel : bLabel;
  const _loser = scoreA > scoreB ? bLabel : aLabel; // eslint-disable-line no-unused-vars

  // Build reason
  const reasons = [];
  if (scoreA > scoreB) {
    if (rpiA   > rpiB)  reasons.push('stronger resale liquidity');
    if (ttlA   < ttlB)  reasons.push('shorter expected liquidation time');
    if (confA  > confB) reasons.push('higher confidence in the estimate');
    if (flagsA < flagsB) reasons.push('fewer risk flags');
    if (vrA    < vrB)   reasons.push('stronger lending verdict');
  } else {
    if (rpiB   > rpiA)  reasons.push('stronger resale liquidity');
    if (ttlB   < ttlA)  reasons.push('shorter expected liquidation time');
    if (confB  > confA) reasons.push('higher confidence in the estimate');
    if (flagsB < flagsA) reasons.push('fewer risk flags');
    if (vrB    < vrA)   reasons.push('stronger lending verdict');
  }

  const topReasons = reasons.slice(0, 2).join(' and ');
  return `${winner} presents a stronger collateral position due to ${topReasons || 'overall better signal quality'}.`;
}
