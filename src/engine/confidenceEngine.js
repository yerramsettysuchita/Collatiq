/* ── CONFIDENCE ENGINE ───────────────────────────────────────────────────────
   Scores input completeness, data quality, and signal agreement.
   Returns a 0-100 score with labelled drivers.
*/

export function computeConfidence(input, valuationResult) {
  let score    = 100;
  const drivers = [];

  const areaSqft      = parseFloat(input.areaSqft || input.area) || 0;
  const propType      = (input.propertyType || input.type || '').toLowerCase();
  const legalStatus   = valuationResult.legalStatus || input.legalStatus || input.legal || '';
  const occupancy     = valuationResult.occupancy   || input.occupancy || '';
  const ageBand       = valuationResult.ageBand     || input.ageBand   || input.age || '';
  const zoneConf      = valuationResult.zoneConfidence || 'low';
  const infraFallback = (input.precomputedInfra?.fallback !== false);

  // ── INPUT COMPLETENESS ────────────────────────────────────────────────────
  if (!areaSqft) {
    score -= 20;
    drivers.push({ factor: 'Property area', impact: 'negative', reason: 'Property area not provided.' });
  }
  if (!propType) {
    score -= 10;
    drivers.push({ factor: 'Property type', impact: 'negative', reason: 'Property type not specified.' });
  }
  if (!legalStatus) {
    score -= 8;
    drivers.push({ factor: 'Legal status', impact: 'negative', reason: 'Legal status not provided.' });
  }
  if (!occupancy) {
    score -= 5;
    drivers.push({ factor: 'Occupancy', impact: 'negative', reason: 'Occupancy status not provided.' });
  }
  if (!ageBand) {
    score -= 5;
    drivers.push({ factor: 'Property age', impact: 'negative', reason: 'Property age not provided.' });
  }

  // ── DATA QUALITY ──────────────────────────────────────────────────────────
  if (zoneConf === 'low') {
    score -= 15;
    drivers.push({ factor: 'Zone coverage', impact: 'negative', reason: 'Property location outside standard coverage zones.' });
  } else if (zoneConf === 'medium') {
    score -= 7;
    drivers.push({ factor: 'Zone coverage', impact: 'negative', reason: 'Location matched to broad sub-region, not specific micromarket.' });
  }
  if (infraFallback) {
    score -= 8;
    drivers.push({ factor: 'Infrastructure data', impact: 'negative', reason: 'Infrastructure signals unavailable, using estimates.' });
  }

  // ── LEGAL RISK ────────────────────────────────────────────────────────────
  if (legalStatus === 'disputed' || legalStatus === 'unknown') {
    score -= 20;
    drivers.push({ factor: 'Title dispute', impact: 'negative', reason: 'Disputed title significantly reduces valuation reliability.' });
  } else if (legalStatus === 'encumbered') {
    score -= 15;
    drivers.push({ factor: 'Encumbrance', impact: 'negative', reason: 'Encumbrance on property reduces exit certainty.' });
  } else if (legalStatus === 'inherited_undivided' || legalStatus === 'complex') {
    score -= 12;
    drivers.push({ factor: 'Undivided title', impact: 'negative', reason: 'Undivided inherited property has exit complexity.' });
  } else if (legalStatus === 'unregistered') {
    score -= 10;
    drivers.push({ factor: 'Unregistered agreement', impact: 'negative', reason: 'Unregistered agreement increases legal risk.' });
  }

  // ── OCCUPANCY RISK ────────────────────────────────────────────────────────
  if (occupancy === 'tenant_disputed') {
    score -= 15;
    drivers.push({ factor: 'Tenant dispute', impact: 'negative', reason: 'Tenant dispute creates exit and possession risk.' });
  } else if (occupancy === 'rented_without_agreement') {
    score -= 8;
    drivers.push({ factor: 'Informal tenancy', impact: 'negative', reason: 'Rental without agreement reduces fungibility.' });
  }

  // ── AGE RISK ─────────────────────────────────────────────────────────────
  if (ageBand === 'above_thirty' || ageBand === 'old') {
    score -= 10;
    drivers.push({ factor: 'Property age', impact: 'negative', reason: 'Property age above 30 years increases structural uncertainty.' });
  } else if (ageBand === 'twenty_to_thirty') {
    score -= 5;
    drivers.push({ factor: 'Property age', impact: 'negative', reason: 'Property age 20 to 30 years warrants structural verification.' });
  }

  // ── SIGNAL AGREEMENT ─────────────────────────────────────────────────────
  const infraScore = valuationResult.infraScore ?? 65;
  const zone       = (valuationResult.zone || '').toLowerCase();
  const premiumZones = ['mg road', 'brigade road', 'richmond town', 'koramangala', 'indiranagar', 'cunningham road'];
  const peripheralZones = ['outside bengaluru', 'hoskote', 'devanahalli'];

  if (premiumZones.some(z => zone.includes(z)) && infraScore < 55) {
    score -= 8;
    drivers.push({ factor: 'Signal mismatch', impact: 'negative', reason: 'Infrastructure signals inconsistent with premium zone classification.' });
  }
  if (peripheralZones.some(z => zone.includes(z)) && infraScore > 75) {
    score -= 5;
    drivers.push({ factor: 'Signal mismatch', impact: 'negative', reason: 'Strong infrastructure signals inconsistent with peripheral zone.' });
  }

  // ── DOCUMENT COMPLETENESS ─────────────────────────────────────────────────
  const docs          = input.documents || {};
  const criticalKeys  = ['titleDeed', 'ec', 'taxReceipt'];
  const suppKeys      = ['buildingPlan', 'khata'];
  const criticalCount = criticalKeys.filter(k => docs[k]).length;
  const suppCount     = suppKeys.filter(k => docs[k]).length;

  if (criticalCount === 3) {
    score += 12;
    drivers.push({ factor: 'Document completeness', impact: 'positive', reason: 'All 3 critical documents provided — title deed, EC, and tax receipt.' });
  } else if (criticalCount === 2) {
    score += 6;
    drivers.push({ factor: 'Document completeness', impact: 'positive', reason: '2 of 3 critical documents provided.' });
  } else if (criticalCount === 1) {
    score -= 4;
    drivers.push({ factor: 'Document completeness', impact: 'negative', reason: 'Only 1 critical document uploaded. Title deed, EC, and tax receipt all recommended.' });
  }
  if (suppCount > 0) {
    score += suppCount * 2;
    drivers.push({ factor: 'Supplementary documents', impact: 'positive', reason: `${suppCount} supplementary document(s) provided.` });
  }

  // ── OC / EC / PLAN / TAX STATUS ──────────────────────────────────────────
  const ocStatus     = input.ocStatus;
  const ecStatus     = input.ecStatus;
  const planStatus   = input.planApproval;
  const taxStatus    = input.taxStatus;
  const existingLoan = input.existingLoan;

  if (ocStatus === 'present') {
    score += 6;
    drivers.push({ factor: 'Occupancy certificate', impact: 'positive', reason: 'OC available — property is legally certifiable for occupation.' });
  } else if (ocStatus === 'absent') {
    score -= 12;
    drivers.push({ factor: 'Occupancy certificate', impact: 'negative', reason: 'No OC — legal occupancy uncertain. Exit risk elevated.' });
  }

  if (ecStatus === 'clear') {
    score += 8;
    drivers.push({ factor: 'Encumbrance status', impact: 'positive', reason: 'EC clear — no charges, mortgages, or liens in last 13 years.' });
  } else if (ecStatus === 'charges') {
    score -= 20;
    drivers.push({ factor: 'Encumbrance status', impact: 'negative', reason: 'Existing charges on EC — property appears already mortgaged.' });
  } else if (ecStatus === 'not_obtained') {
    score -= 8;
    drivers.push({ factor: 'Encumbrance status', impact: 'negative', reason: 'EC not obtained. Encumbrance cannot be confirmed.' });
  }

  if (planStatus === 'approved') {
    score += 5;
    drivers.push({ factor: 'Building plan', impact: 'positive', reason: 'Building plan approved by local authority.' });
  } else if (planStatus === 'not_approved') {
    score -= 15;
    drivers.push({ factor: 'Building plan', impact: 'negative', reason: 'Unapproved structure — significant legal and resale risk.' });
  } else if (planStatus === 'unknown') {
    score -= 5;
    drivers.push({ factor: 'Building plan', impact: 'negative', reason: 'Plan approval status unknown — verification recommended.' });
  }

  if (taxStatus === 'paid') {
    score += 3;
    drivers.push({ factor: 'Property tax', impact: 'positive', reason: 'Tax paid up-to-date — confirms active ownership.' });
  } else if (taxStatus === 'pending') {
    score -= 6;
    drivers.push({ factor: 'Property tax', impact: 'negative', reason: 'Tax dues pending — ownership or payment uncertainty.' });
  }

  if (existingLoan === 'yes') {
    score -= 8;
    drivers.push({ factor: 'Existing loan', impact: 'negative', reason: 'Property already mortgaged. NOC required before new lending.' });
  } else if (existingLoan === 'no') {
    score += 3;
    drivers.push({ factor: 'Encumbrance-free', impact: 'positive', reason: 'No existing loan — full LTV range available.' });
  }

  // ── KHATA TYPE ────────────────────────────────────────────────────────────
  const khataType = input.khataType;
  if (khataType === 'a_khata') {
    score += 6;
    drivers.push({ factor: 'Khata type', impact: 'positive', reason: 'A-Khata — approved BBMP layout. Full LTV range applicable.' });
  } else if (khataType === 'b_khata') {
    score -= 15;
    drivers.push({ factor: 'Khata type', impact: 'negative', reason: 'B-Khata — unapproved layout. Significant LTV reduction applies.' });
  } else if (khataType === 'no_khata') {
    score -= 20;
    drivers.push({ factor: 'Khata type', impact: 'negative', reason: 'No Khata — property lacks municipal record. Extreme legal risk for lending.' });
  }

  // ── LITIGATION ────────────────────────────────────────────────────────────
  const litigation = input.litigation;
  if (litigation === 'active') {
    score -= 18;
    drivers.push({ factor: 'Litigation', impact: 'negative', reason: 'Active litigation — cannot legally mortgage until resolved.' });
  } else if (litigation === 'injunction') {
    score -= 25;
    drivers.push({ factor: 'Litigation', impact: 'negative', reason: 'Court injunction — lending on this property carries extreme legal risk.' });
  } else if (litigation === 'none') {
    score += 4;
    drivers.push({ factor: 'Litigation', impact: 'positive', reason: 'No litigation declared — title appears free from court encumbrance.' });
  }

  // ── PROPERTY CONDITION ────────────────────────────────────────────────────
  const condition = input.propertyCondition;
  if (condition === 'excellent') {
    score += 5;
    drivers.push({ factor: 'Property condition', impact: 'positive', reason: 'Excellent condition — maximises realisable value and liquidity.' });
  } else if (condition === 'fair') {
    score -= 5;
    drivers.push({ factor: 'Property condition', impact: 'negative', reason: 'Fair condition — reduced marketability; inspection recommended.' });
  } else if (condition === 'poor') {
    score -= 12;
    drivers.push({ factor: 'Property condition', impact: 'negative', reason: 'Poor condition — structural survey required before lending.' });
  }

  // ── CONSTRUCTION & AMENITIES SIGNALS ─────────────────────────────────────
  const ctType = input.constructionType;
  if (ctType === 'rcc_frame' || ctType === 'steel') {
    score += 3;
    drivers.push({ factor: 'Construction quality', impact: 'positive', reason: `${ctType === 'steel' ? 'Steel frame' : 'RCC frame'} — durable and insurable.` });
  } else if (ctType === 'prefab') {
    score -= 4;
    drivers.push({ factor: 'Construction quality', impact: 'negative', reason: 'Prefab construction — limited secondary market demand.' });
  }

  const amenityCount = (input.amenities || []).length;
  if (amenityCount >= 4) {
    score += 4;
    drivers.push({ factor: 'Amenities', impact: 'positive', reason: `${amenityCount} amenities improve marketability and resale liquidity.` });
  } else if (amenityCount >= 1) {
    score += 2;
    drivers.push({ factor: 'Amenities', impact: 'positive', reason: `${amenityCount} amenity/amenities declared.` });
  }

  if (input.yearOfConstruction && parseInt(input.yearOfConstruction) > 1900) {
    score += 3;
    drivers.push({ factor: 'Construction year', impact: 'positive', reason: `Exact year ${input.yearOfConstruction} provided — reduces age band uncertainty.` });
  }

  // ── POSITIVE DRIVERS ─────────────────────────────────────────────────────
  drivers.push({ factor: 'Data source', impact: 'positive', reason: 'Circle rate anchored to govt. SRO 2024 data across 19 Indian cities.' });
  drivers.push({ factor: 'Output method', impact: 'positive', reason: 'Range-based output reduces point estimate risk.' });

  // ── FINAL SCORE ───────────────────────────────────────────────────────────
  const confidenceScore = Math.round(Math.max(15, Math.min(97, score)));

  let confidenceLabel, confidenceTier;
  if (confidenceScore >= 85)      { confidenceLabel = 'High Confidence';                           confidenceTier = 'high'; }
  else if (confidenceScore >= 70) { confidenceLabel = 'Moderate-High Confidence';                  confidenceTier = 'high'; }
  else if (confidenceScore >= 55) { confidenceLabel = 'Moderate Confidence';                       confidenceTier = 'medium'; }
  else if (confidenceScore >= 40) { confidenceLabel = 'Low-Moderate Confidence';                   confidenceTier = 'medium'; }
  else                            { confidenceLabel = 'Low Confidence — Manual Review Required';   confidenceTier = 'low'; }

  return { confidenceScore, confidenceLabel, confidenceTier, confidenceDrivers: drivers };
}
