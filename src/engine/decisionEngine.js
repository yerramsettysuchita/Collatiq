/* ── DECISION ENGINE ─────────────────────────────────────────────────────────
   Combines valuation, confidence, and fraud signals into a single decision.
*/

export function makeDecision(valuationResult, confidenceResult, fraudResult) {
  const { confidenceScore, confidenceTier } = confidenceResult;
  const { fraudRiskLevel, fraudFlags }      = fraudResult;
  const {
    rpi, ttl_high, ltvBand, zone, zoneConfidence,
    infraScore, legalStatus, occupancy, address,
    mv_low, mv_high, dv_low, dv_high, localityGrade,
    ageBand: _ageBand, subtype: _subtype,
  } = valuationResult;

  // ── VERDICT LOGIC (evaluated top-down, first match wins) ─────────────────
  let verdict = 'SANCTION_RECOMMENDED';

  // REJECT
  if (fraudRiskLevel === 'high') verdict = 'REJECT';
  else if (confidenceScore < 30) verdict = 'REJECT';
  else if ((legalStatus === 'disputed' || legalStatus === 'unknown') && rpi < 40) verdict = 'REJECT';

  // HIGH_RISK
  if (verdict === 'SANCTION_RECOMMENDED') {
    if (fraudRiskLevel === 'medium')                      verdict = 'HIGH_RISK';
    else if (confidenceScore < 50)                        verdict = 'HIGH_RISK';
    else if (legalStatus === 'encumbered' || legalStatus === 'disputed') verdict = 'HIGH_RISK';
    else if (rpi < 35)                                    verdict = 'HIGH_RISK';
    else if ((ttl_high || 0) > 400)                       verdict = 'HIGH_RISK';
  }

  // CONDITIONAL_REVIEW
  if (verdict === 'SANCTION_RECOMMENDED') {
    const hasWarningFraud = fraudFlags.some(f => f.severity === 'warning');
    if (confidenceScore < 70)                             verdict = 'CONDITIONAL_REVIEW';
    else if (zoneConfidence === 'low')                    verdict = 'CONDITIONAL_REVIEW';
    else if (fraudRiskLevel === 'low')                    verdict = 'CONDITIONAL_REVIEW';
    else if (hasWarningFraud)                             verdict = 'CONDITIONAL_REVIEW';
    else if (rpi < 50)                                    verdict = 'CONDITIONAL_REVIEW';
    else if (occupancy === 'rented_without_agreement' || occupancy === 'tenant_disputed') verdict = 'CONDITIONAL_REVIEW';
  }

  // ── VERDICT LABELS & COLORS ───────────────────────────────────────────────
  const VERDICTS = {
    SANCTION_RECOMMENDED: { label: 'Sanction Recommended',             color: '#1A7F5A' },
    CONDITIONAL_REVIEW:   { label: 'Conditional Review',               color: '#C07A1A' },
    HIGH_RISK:            { label: 'High Risk — Senior Review Required',color: '#C0392B' },
    REJECT:               { label: 'Reject — Do Not Proceed',          color: '#8B0000' },
  };
  const { label: verdictLabel, color: verdictColor } = VERDICTS[verdict];

  // ── LTV BAND ─────────────────────────────────────────────────────────────
  const finalLtvBand =
    verdict === 'REJECT'               ? 'Decline'           :
    verdict === 'HIGH_RISK'            ? 'Below 40% or decline' :
    verdict === 'CONDITIONAL_REVIEW'   ? ltvBand || '45–55%' : ltvBand || '60–70%';

  const recommendedAction =
    verdict === 'SANCTION_RECOMMENDED'
      ? 'This collateral is cleared for sanction at the recommended LTV. Ensure standard property documents and a valuation certificate are on file before disbursement.'
      : verdict === 'CONDITIONAL_REVIEW'
      ? 'This file should be referred to the credit committee with a risk note attached. Obtain a legal opinion and complete a field inspection before the final lending decision.'
      : verdict === 'HIGH_RISK'
      ? 'This file requires escalation to a senior credit officer. A physical inspection and an independent valuer report are mandatory before any sanction can be considered.'
      : 'Do not proceed with this collateral. The risk factors identified exceed acceptable thresholds for lending.';

  // ── DECISION REASONS (top 3 impactful factors) ────────────────────────────
  const decisionReasons = [];

  if (zoneConfidence === 'high') {
    decisionReasons.push(`The property falls within the ${zone} zone where high-quality circle rate data is available, which supports the reliability of this valuation.`);
  } else if (zoneConfidence === 'medium') {
    decisionReasons.push(`The location has been matched to the broader ${zone} sub-region as specific micromarket data for this exact address was unavailable.`);
  } else {
    decisionReasons.push('This property is located outside our standard coverage zones, which reduces valuation precision and warrants additional field verification.');
  }

  if (legalStatus === 'clear_title' || legalStatus === 'registered_agreement') {
    decisionReasons.push('The title documentation appears clean, which supports exit certainty and helps the lender recover value faster in a distress scenario.');
  } else if (legalStatus === 'disputed' || legalStatus === 'encumbered' || legalStatus === 'unknown') {
    decisionReasons.push(`The ${legalStatus.replace(/_/g, ' ')} legal status significantly increases exit risk and reduces the effective collateral value for lending purposes.`);
  } else {
    decisionReasons.push(`The ${(legalStatus || '').replace(/_/g, ' ')} legal status introduces moderate documentation risk that should be resolved before final sanction.`);
  }

  if (infraScore >= 70) {
    decisionReasons.push(`The infrastructure score for this area is ${infraScore} out of 100, indicating an established locality with reliable buyer demand and good connectivity.`);
  } else if (infraScore >= 50) {
    decisionReasons.push(`The infrastructure score for this area is ${infraScore} out of 100, reflecting developing locality dynamics with room for appreciation as the area matures.`);
  } else {
    decisionReasons.push(`The infrastructure score of ${infraScore} out of 100 indicates limited amenity access in this micromarket, which will reduce buyer interest and extend the time to liquidate.`);
  }

  // ── ESCALATION FLAGS ─────────────────────────────────────────────────────
  const escalationFlags = [];

  fraudFlags.filter(f => f.severity === 'critical').forEach(f =>
    escalationFlags.push(`Fraud Alert — ${f.description}`)
  );

  confidenceResult.confidenceDrivers
    .filter(d => d.impact === 'negative' && d.reason.length > 20)
    .slice(0, 2)
    .forEach(d => escalationFlags.push(d.reason));

  if (legalStatus && legalStatus !== 'clear_title' && legalStatus !== 'registered_agreement') {
    escalationFlags.push(`The ${(legalStatus || '').replace(/_/g, ' ')} legal status requires independent verification before any sanction is approved.`);
  }

  // ── DECISION MEMO ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtCr = (v) => v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : `₹${(v / 100000).toFixed(1)} L`;

  const decisionMemo = [
    'COLLATIQ COLLATERAL ASSESSMENT MEMO',
    `Property: ${address || 'Address not provided'}`,
    `Date: ${today}`,
    '',
    'VALUATION SUMMARY',
    `Market value range is ${fmtCr(mv_low)} to ${fmtCr(mv_high)} based on ${zone} circle rate of ₹${valuationResult.baseRatePsf?.toLocaleString('en-IN') || '—'}/sqft. ` +
    `Distress value range is ${fmtCr(dv_low)} to ${fmtCr(dv_high)} reflecting asset liquidity profile. ` +
    `All estimates are range-based with ${zoneConfidence} data confidence.`,
    '',
    'LIQUIDITY ASSESSMENT',
    `Resale Potential Index is ${rpi}/100, classifying this asset as ${localityGrade || 'Developing'}. ` +
    `Estimated time to liquidate ranges from ${valuationResult.ttl_low} to ${ttl_high} days in normal market conditions. ` +
    `Distress exit would likely recover ${fmtCr(dv_low)} to ${fmtCr(dv_high)}.`,
    '',
    'CONFIDENCE ASSESSMENT',
    `System confidence is ${confidenceScore}/100 (${confidenceResult.confidenceLabel}). ` +
    `Zone data quality is ${zoneConfidence}. Infrastructure signals are ${valuationResult.infraScore >= 60 ? 'adequate' : 'limited'} with infraScore ${infraScore}/100. ` +
    `${confidenceTier === 'low' ? 'Manual verification strongly recommended before proceeding.' : 'Data quality is sufficient for automated decisioning.'}`,
    '',
    'RISK FLAGS',
    escalationFlags.length > 0
      ? escalationFlags.map((f, i) => `${i + 1}. ${f}`).join(' ')
      : 'No material risk flags identified.',
    '',
    'RECOMMENDATION',
    `${verdictLabel}. ${recommendedAction} Recommended LTV band: ${finalLtvBand}.`,
  ].join('\n');

  return {
    verdict,
    verdictLabel,
    verdictColor,
    ltvBand: finalLtvBand,
    recommendedAction,
    decisionReasons,
    escalationFlags,
    decisionMemo,
  };
}
