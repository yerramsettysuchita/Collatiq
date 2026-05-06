/* ── CONFIDENCE ENGINE v2 — BUILD-UP APPROACH ───────────────────────────────
   Starts at 32 (base for having an address) and ADDS points for each data
   element provided. Maximum theoretical ~108, hard-capped at 82.
   Problem-statement sample shows 0.68 for a moderately complete file.
   Without any optional fields: ~55–61. With full data + docs: ~76–82.
*/

/* ── LIVE PREVIEW (runs synchronously from form state, no valuationResult) ── */
export function previewConfidence(formState) {
  let score = 32;

  const {
    address, propertyType, areaSqft, area,
    ageBand, yearOfConstruction,
    occupancy, floorNumber, floor,
    legalStatus, legal,
    ocStatus, ecStatus, planApproval, taxStatus,
    existingLoan, litigation, khataType,
    propertyCondition, constructionType,
    documents = {}, images = [],
    amenities = [],
  } = formState || {};

  // ── MANDATORY FIELDS ────────────────────────────────────────────────────
  if (propertyType)                               score += 5;
  const sz = parseFloat(areaSqft || area) || 0;
  if (sz > 0)                                     score += 7;
  const yr = parseInt(yearOfConstruction);
  if ((ageBand && ageBand !== '') || (yr > 1900)) score += 6;
  if (occupancy)                                  score += 4;
  if (parseInt(floorNumber || floor) >= 0)        score += 2;
  const ls = legalStatus || legal || '';
  if (ls)                                         score += 4;

  // ── LEGAL QUALITY ───────────────────────────────────────────────────────
  if (ls === 'clear' || ls === 'clear_title')          score += 8;
  else if (ls === 'registered_agreement')               score += 5;
  else if (ls === 'complex' || ls === 'unregistered')   score += 2;
  else if (ls === 'disputed' || ls === 'encumbered')    score -= 4;

  // ── OC / EC / PLAN / TAX ────────────────────────────────────────────────
  if (ocStatus === 'present')         score += 5;
  else if (ocStatus === 'absent')     score -= 3;

  if (ecStatus === 'clear')           score += 6;
  else if (ecStatus === 'charges')    score -= 6;
  else if (ecStatus === 'not_obtained') score -= 2;

  if (planApproval === 'approved')    score += 4;
  else if (planApproval === 'not_approved') score -= 5;

  if (taxStatus === 'paid')           score += 2;
  else if (taxStatus === 'pending')   score -= 2;

  if (existingLoan === 'no')          score += 2;
  else if (existingLoan === 'yes')    score -= 3;

  if (litigation === 'none')          score += 3;
  else if (litigation === 'active')   score -= 6;
  else if (litigation === 'injunction') score -= 10;

  if (khataType === 'a_khata')        score += 3;
  else if (khataType === 'b_khata')   score -= 5;
  else if (khataType === 'no_khata')  score -= 8;

  // ── DOCUMENTS ───────────────────────────────────────────────────────────
  const criticalDocs = ['titleDeed', 'ec', 'taxReceipt'];
  const suppDocs     = ['buildingPlan', 'khata'];
  const critCount = criticalDocs.filter(k => documents[k]?.length > 0).length;
  const suppCount = suppDocs.filter(k => documents[k]?.length > 0).length;
  score += critCount * 4;
  score += suppCount * 2;

  // ── PHOTOS ──────────────────────────────────────────────────────────────
  if ((images?.length || 0) >= 3) score += 4;
  else if ((images?.length || 0) >= 1) score += 2;

  // ── PROPERTY CONDITION ──────────────────────────────────────────────────
  if (propertyCondition === 'excellent')      score += 3;
  else if (propertyCondition === 'fair')      score -= 1;
  else if (propertyCondition === 'poor')      score -= 4;

  // ── AMENITIES ───────────────────────────────────────────────────────────
  if ((amenities?.length || 0) >= 4) score += 2;
  else if ((amenities?.length || 0) >= 1) score += 1;

  return Math.round(Math.max(20, Math.min(82, score)));
}

/* ── WHAT ADDING NEXT WOULD GAIN ─────────────────────────────────────────── */
export function getConfidenceHints(formState) {
  const hints = [];
  const {
    propertyType, areaSqft, area, ageBand, yearOfConstruction,
    occupancy, legalStatus, legal,
    ocStatus, ecStatus, planApproval,
    existingLoan, litigation,
    documents = {}, images = [],
  } = formState || {};

  if (!propertyType)
    hints.push({ gain: 5, text: 'Select a property type' });
  if (!parseFloat(areaSqft || area))
    hints.push({ gain: 7, text: 'Enter the built-up area' });
  if (!ageBand && !parseInt(yearOfConstruction))
    hints.push({ gain: 6, text: 'Add year of construction' });
  if (!occupancy)
    hints.push({ gain: 4, text: 'Select occupancy status' });
  const ls = legalStatus || legal || '';
  if (!ls)
    hints.push({ gain: 4, text: 'Declare legal status' });
  if (ls && ls !== 'clear' && ls !== 'clear_title')
    hints.push({ gain: 8, text: 'Clear title adds the most confidence' });
  if (!ocStatus || ocStatus !== 'present')
    hints.push({ gain: 5, text: 'Add Occupancy Certificate status' });
  if (!ecStatus || ecStatus !== 'clear')
    hints.push({ gain: 6, text: 'Clear Encumbrance Certificate adds +6' });
  if (!planApproval || planApproval !== 'approved')
    hints.push({ gain: 4, text: 'Approved building plan adds +4' });
  if (!existingLoan)
    hints.push({ gain: 2, text: 'Declare existing loan status' });
  if (!litigation)
    hints.push({ gain: 3, text: 'Declare litigation status' });

  const critCount = ['titleDeed', 'ec', 'taxReceipt']
    .filter(k => (documents[k]?.length || 0) > 0).length;
  if (critCount < 3)
    hints.push({ gain: (3 - critCount) * 4, text: `Upload ${3 - critCount} more key document(s)` });
  if ((images?.length || 0) < 1)
    hints.push({ gain: 2, text: 'Add at least 1 property photo' });

  return hints.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

/* ── FULL CONFIDENCE (used in pipeline after valuation) ──────────────────── */
export function computeConfidence(input, valuationResult) {
  let score    = 32;
  const drivers = [];

  const areaSqft      = parseFloat(input.areaSqft || input.area) || 0;
  const propType      = (input.propertyType || input.type || '').toLowerCase();
  const legalStatus   = input.legalStatus || input.legal || '';
  const occupancy     = input.occupancy || '';
  const ageBand       = input.ageBand || input.age || '';
  const zoneConf      = valuationResult?.zoneConfidence || input.circleRateData?.confidence || 'low';
  const infraFallback = (input.precomputedInfra?.fallback !== false);
  const address       = (input.address || '').toLowerCase();

  // ── CONTEXT FLAGS (city + property type) ─────────────────────────────────
  const isKarnataka   = address.includes('bengaluru') || address.includes('bangalore') ||
                        address.includes('mysuru')    || address.includes('mangaluru');
  const isMaharashtra = address.includes('mumbai')    || address.includes('pune') ||
                        address.includes('nashik')    || address.includes('aurangabad') ||
                        address.includes('nagpur');
  const isResidential = propType === 'residential';
  const isCommercial  = propType === 'commercial';
  const isPlot        = (input.subtype || '').includes('plot') || (input.subtype || '').includes('land');

  // Infra richness bonus — real data vs fallback is now graded, not binary
  const infra = input.precomputedInfra || {};
  const hasRichInfra = !infraFallback && (infra.nearestHospitalDistM !== undefined);

  // ── MANDATORY COMPLETENESS ───────────────────────────────────────────────
  if (propType) {
    score += 5;
    drivers.push({ factor: 'Property type', impact: 'positive', reason: 'Property classification provided.' });
  } else {
    drivers.push({ factor: 'Property type', impact: 'negative', reason: 'Property type not specified — classification missing.' });
  }

  if (areaSqft > 0) {
    score += 7;
    drivers.push({ factor: 'Property area', impact: 'positive', reason: `Area of ${areaSqft.toLocaleString('en-IN')} sqft provided.` });
  } else {
    drivers.push({ factor: 'Property area', impact: 'negative', reason: 'Built-up area not provided — single biggest data gap.' });
  }

  const yr = parseInt(input.yearOfConstruction);
  if ((ageBand && ageBand !== '') || (yr > 1900)) {
    score += 6;
    drivers.push({ factor: 'Asset age', impact: 'positive', reason: yr > 1900 ? `Construction year ${yr} provided.` : 'Age band declared.' });
  } else {
    drivers.push({ factor: 'Asset age', impact: 'negative', reason: 'Construction year not provided — depreciation is estimated.' });
  }

  if (occupancy) {
    score += 4;
    drivers.push({ factor: 'Occupancy', impact: 'positive', reason: `Occupancy status: ${occupancy}.` });
  } else {
    drivers.push({ factor: 'Occupancy', impact: 'negative', reason: 'Occupancy status not declared.' });
  }

  const floorNum = parseInt(input.floorNumber || input.floor);
  if (floorNum >= 0 && !isNaN(floorNum)) {
    score += 2;
    drivers.push({ factor: 'Floor level', impact: 'positive', reason: `Floor ${floorNum} declared.` });
  }

  if (legalStatus) {
    score += 4;
    drivers.push({ factor: 'Legal status declared', impact: 'positive', reason: 'Legal status has been provided.' });
  } else {
    drivers.push({ factor: 'Legal status', impact: 'negative', reason: 'Legal status not provided — highest priority gap.' });
  }

  // ── LEGAL QUALITY ───────────────────────────────────────────────────────
  if (legalStatus === 'clear' || legalStatus === 'clear_title') {
    score += 8;
    drivers.push({ factor: 'Clear title', impact: 'positive', reason: 'Clear title — strongest legal signal for lending.' });
  } else if (legalStatus === 'registered_agreement') {
    score += 5;
    drivers.push({ factor: 'Registered agreement', impact: 'positive', reason: 'Registered agreement on record.' });
  } else if (legalStatus === 'complex' || legalStatus === 'unregistered') {
    score += 2;
    drivers.push({ factor: 'Legal complexity', impact: 'negative', reason: 'Legal complexity limits confidence in exit certainty.' });
  } else if (legalStatus === 'disputed' || legalStatus === 'encumbered') {
    score -= 4;
    drivers.push({ factor: 'Title dispute / encumbrance', impact: 'negative', reason: 'Disputed or encumbered title severely limits collateral reliability.' });
  } else if (legalStatus === 'inherited_undivided') {
    score -= 2;
    drivers.push({ factor: 'Undivided title', impact: 'negative', reason: 'Inherited undivided property has exit complexity.' });
  }

  // ── GEO DATA QUALITY ────────────────────────────────────────────────────
  if (zoneConf === 'high') {
    score += 7;
    drivers.push({ factor: 'Zone precision', impact: 'positive', reason: 'Address matched to a verified government circle rate zone with high accuracy.' });
  } else if (zoneConf === 'medium') {
    score += 3;
    drivers.push({ factor: 'Zone precision', impact: 'positive', reason: 'Address matched to broad sub-region circle rate — micromarket rate may vary.' });
  } else {
    score -= 2;
    drivers.push({ factor: 'Zone precision', impact: 'negative', reason: 'Location outside verified zone coverage — circle rate is a national estimate. Field verification adds significant value.' });
  }

  if (hasRichInfra) {
    // Bonus scales with data richness: metro distance, hospital distance all real
    const infraBonus = infra.nearestMetroDistM !== null ? 6 : 4;
    score += infraBonus;
    const highlights = [];
    if (infra.nearestHospitalDistM !== null) highlights.push(`nearest hospital ${infra.nearestHospitalDistM}m`);
    if (infra.nearestMetroDistM    !== null) highlights.push(`metro ${infra.nearestMetroDistM}m`);
    drivers.push({ factor: 'Infrastructure data', impact: 'positive', reason: `Live OSM signals confirmed (${highlights.join(', ')}).` });
  } else if (!infraFallback) {
    score += 3;
    drivers.push({ factor: 'Infrastructure data', impact: 'positive', reason: 'Live OSM infrastructure signals retrieved for this location.' });
  } else {
    drivers.push({ factor: 'Infrastructure data', impact: 'negative', reason: 'Infrastructure signals unavailable for this location — live data could not be fetched.' });
  }

  // ── OC / EC / PLAN / TAX / LOAN / LITIGATION ────────────────────────────
  const ocStatus   = input.ocStatus;
  const ecStatus   = input.ecStatus;
  const planStatus = input.planApproval;
  const taxStatus  = input.taxStatus;
  const existLoan  = input.existingLoan;
  const litigation = input.litigation;
  const khataType  = input.khataType;

  if (ocStatus === 'present') {
    score += 5;
    drivers.push({ factor: 'Occupancy certificate', impact: 'positive', reason: 'OC present — property legally certifiable for occupation.' });
  } else if (ocStatus === 'absent') {
    score -= 3;
    drivers.push({ factor: 'Occupancy certificate', impact: 'negative', reason: 'No OC — legal occupancy uncertain, exit risk elevated.' });
  }

  if (ecStatus === 'clear') {
    score += 6;
    drivers.push({ factor: 'Encumbrance certificate', impact: 'positive', reason: 'EC clear — no charges or liens in the last 13 years.' });
  } else if (ecStatus === 'charges') {
    score -= 6;
    drivers.push({ factor: 'Encumbrance certificate', impact: 'negative', reason: 'Existing charges on EC — property appears already mortgaged.' });
  } else if (ecStatus === 'not_obtained') {
    score -= 2;
    drivers.push({ factor: 'Encumbrance certificate', impact: 'negative', reason: 'EC not obtained — encumbrance cannot be confirmed.' });
  }

  if (planStatus === 'approved') {
    score += 4;
    drivers.push({ factor: 'Building plan', impact: 'positive', reason: 'Plan approved by local authority.' });
  } else if (planStatus === 'not_approved') {
    score -= 5;
    drivers.push({ factor: 'Building plan', impact: 'negative', reason: 'Unapproved structure — significant legal and resale risk.' });
  }

  if (taxStatus === 'paid') {
    score += 2;
    drivers.push({ factor: 'Property tax', impact: 'positive', reason: 'Tax paid up-to-date — confirms active ownership.' });
  } else if (taxStatus === 'pending') {
    score -= 2;
    drivers.push({ factor: 'Property tax', impact: 'negative', reason: 'Tax dues pending.' });
  }

  if (existLoan === 'no') {
    score += 2;
    drivers.push({ factor: 'Encumbrance-free', impact: 'positive', reason: 'No existing loan — full LTV range available.' });
  } else if (existLoan === 'yes') {
    score -= 3;
    drivers.push({ factor: 'Existing loan', impact: 'negative', reason: 'Property already mortgaged — NOC required.' });
  }

  if (litigation === 'none') {
    score += 3;
    drivers.push({ factor: 'Litigation', impact: 'positive', reason: 'No litigation — title appears free from court encumbrance.' });
  } else if (litigation === 'active') {
    score -= 6;
    drivers.push({ factor: 'Litigation', impact: 'negative', reason: 'Active litigation — cannot legally mortgage until resolved.' });
  } else if (litigation === 'injunction') {
    score -= 10;
    drivers.push({ factor: 'Court injunction', impact: 'negative', reason: 'Court injunction — lending on this property carries extreme risk.' });
  }

  // Khata is Karnataka-specific — only score it if the property is in Karnataka
  if (khataType && isKarnataka) {
    if (khataType === 'a_khata') {
      score += 4;
      drivers.push({ factor: 'Khata (Karnataka)', impact: 'positive', reason: 'A-Khata confirmed — BBMP/BDA approved layout, strongest municipal record.' });
    } else if (khataType === 'b_khata') {
      score -= 6;
      drivers.push({ factor: 'Khata (Karnataka)', impact: 'negative', reason: 'B-Khata: unapproved layout. BBMP does not grant construction licences on B-Khata — LTV reduction mandatory.' });
    } else if (khataType === 'no_khata') {
      score -= 9;
      drivers.push({ factor: 'Khata (Karnataka)', impact: 'negative', reason: 'No Khata record — no municipal recognition of ownership. Extreme legal risk for any lending decision.' });
    }
  } else if (khataType && !isKarnataka) {
    // Khata declared for non-Karnataka property — it doesn't apply, not a signal
    drivers.push({ factor: 'Khata', impact: 'positive', reason: 'Khata document referenced — note: this document is Karnataka-specific and does not apply to this location.' });
  }

  // ── LIVE INFRA SIGNALS AS CONFIDENCE BOOSTERS ────────────────────────────
  // If real distances are available, use them to confirm location quality
  if (hasRichInfra) {
    if (infra.nearestMetroDistM !== null && infra.nearestMetroDistM < 1000) {
      score += 2;
      drivers.push({ factor: 'Metro connectivity', impact: 'positive', reason: `Metro station within ${infra.nearestMetroDistM}m — confirms urban location with high buyer demand.` });
    }
    if (infra.walkabilityScore >= 70) {
      score += 2;
      drivers.push({ factor: 'Walkability', impact: 'positive', reason: `Walkability score ${infra.walkabilityScore}/100 — high POI density supports resale demand.` });
    }
    if (infra.industrialCount > 2 && isResidential) {
      score -= 3;
      drivers.push({ factor: 'Industrial proximity', impact: 'negative', reason: `${infra.industrialCount} industrial land parcels detected within 1km — reduces residential desirability and resale velocity.` });
    }
  }

  // ── DOCUMENTS ───────────────────────────────────────────────────────────
  const docs       = input.documents || {};
  const critical   = ['titleDeed', 'ec', 'taxReceipt'];
  const supp       = ['buildingPlan', 'khata'];
  const critCount  = critical.filter(k => (docs[k]?.length || 0) > 0).length;
  const suppCount  = supp.filter(k => (docs[k]?.length || 0) > 0).length;

  // Document intelligence — Claude-verified docs score higher than just uploaded
  const docAnalysis  = input.documentAnalysis || {};
  const verifiedCrit = critical.filter(k => docAnalysis[k]?.documentStatus === 'verified').length;
  const verifiedSupp = supp.filter(k => docAnalysis[k]?.documentStatus === 'verified').length;

  // Score: verified = +6 per doc, uploaded only = +4 per doc, missing = 0
  const docScore = (verifiedCrit * 6) + ((critCount - verifiedCrit) * 4);
  score += Math.min(18, docScore);

  if (verifiedCrit > 0) {
    // Check for any document contradictions found
    const hasEcConflict  = docAnalysis.ec?.isClear === false && input.ecStatus === 'clear';
    const hasKhataConflict = docAnalysis.khata?.isBKhata === true && input.khataType === 'a_khata';
    if (hasEcConflict || hasKhataConflict) {
      score -= 8;
      drivers.push({ factor: 'Document verification conflict', impact: 'negative', reason: `Claude analysis of uploaded documents found contradictions with declared status — EC or Khata discrepancy detected.` });
    } else {
      drivers.push({ factor: 'Document verification', impact: 'positive', reason: `${verifiedCrit} critical document(s) verified by Claude Vision — extracted data confirms declared status.` });
    }
  } else if (critCount === 3) {
    score += 0; // already scored above
    drivers.push({ factor: 'Document completeness', impact: 'positive', reason: 'All 3 critical documents uploaded. AI verification pending or unavailable.' });
  } else if (critCount === 2) {
    drivers.push({ factor: 'Document completeness', impact: 'positive', reason: '2 of 3 critical documents provided.' });
  } else if (critCount === 1) {
    drivers.push({ factor: 'Document completeness', impact: 'negative', reason: 'Only 1 critical document uploaded. Upload title deed, EC, and tax receipt to maximise confidence.' });
  } else {
    drivers.push({ factor: 'Document completeness', impact: 'negative', reason: 'No documents uploaded. Verified critical documents can add up to 18 confidence points.' });
  }

  if (suppCount > 0) {
    const suppBonus = verifiedSupp * 3 + (suppCount - verifiedSupp) * 2;
    score += Math.min(6, suppBonus);
    drivers.push({ factor: 'Supplementary documents', impact: 'positive', reason: `${suppCount} supplementary document(s)${verifiedSupp > 0 ? `, ${verifiedSupp} verified by Claude` : ' uploaded'}.` });
  }

  // ── PHOTOS ──────────────────────────────────────────────────────────────
  const imgCount = (input.images || []).length;
  if (imgCount >= 3) {
    score += 4;
    drivers.push({ factor: 'Property photos', impact: 'positive', reason: `${imgCount} photos enable visual quality assessment.` });
  } else if (imgCount >= 1) {
    score += 2;
    drivers.push({ factor: 'Property photos', impact: 'positive', reason: `${imgCount} photo(s) provided.` });
  }

  // ── CONDITION & CONSTRUCTION ─────────────────────────────────────────────
  const condition = input.propertyCondition;
  if (condition === 'excellent') {
    score += 3;
    drivers.push({ factor: 'Property condition', impact: 'positive', reason: 'Excellent condition — maximises realisable value.' });
  } else if (condition === 'fair') {
    score -= 1;
    drivers.push({ factor: 'Property condition', impact: 'negative', reason: 'Fair condition — reduced marketability.' });
  } else if (condition === 'poor') {
    score -= 4;
    drivers.push({ factor: 'Property condition', impact: 'negative', reason: 'Poor condition — structural survey required before lending.' });
  }

  const ctType = input.constructionType;
  if (ctType === 'rcc_frame' || ctType === 'steel') {
    score += 2;
    drivers.push({ factor: 'Construction type', impact: 'positive', reason: `${ctType === 'steel' ? 'Steel frame' : 'RCC frame'} — durable and insurable.` });
  } else if (ctType === 'prefab') {
    score -= 2;
    drivers.push({ factor: 'Construction type', impact: 'negative', reason: 'Prefab construction — limited secondary market demand.' });
  }

  const amenityCount = (input.amenities || []).length;
  if (amenityCount >= 4) {
    score += 2;
    drivers.push({ factor: 'Amenities', impact: 'positive', reason: `${amenityCount} amenities improve marketability.` });
  } else if (amenityCount >= 1) {
    score += 1;
    drivers.push({ factor: 'Amenities', impact: 'positive', reason: `${amenityCount} amenity/amenities declared.` });
  }

  // ── DATA ANCHORS (always present) ────────────────────────────────────────
  drivers.push({ factor: 'Data source', impact: 'positive', reason: 'Circle rate anchored to govt. SRO 2024–25 data across 34 Indian cities, 200+ micromarket zones.' });
  drivers.push({ factor: 'Output method', impact: 'positive', reason: 'Range-based output reduces point-estimate risk.' });

  // ── FINAL SCORE ───────────────────────────────────────────────────────────
  // Hard cap: 82 max (some uncertainty always exists in any real estate valuation)
  // Hard floor: 20 (we always have an address and can derive something)
  const confidenceScore = Math.round(Math.max(20, Math.min(82, score)));

  let confidenceLabel, confidenceTier;
  if (confidenceScore >= 75)      { confidenceLabel = 'High Confidence';                           confidenceTier = 'high'; }
  else if (confidenceScore >= 62) { confidenceLabel = 'Moderate Confidence';                       confidenceTier = 'medium'; }
  else if (confidenceScore >= 48) { confidenceLabel = 'Low-Moderate — Verify Key Fields';          confidenceTier = 'medium'; }
  else                            { confidenceLabel = 'Low Confidence — Manual Review Required';   confidenceTier = 'low'; }

  return { confidenceScore, confidenceLabel, confidenceTier, confidenceDrivers: drivers };
}
