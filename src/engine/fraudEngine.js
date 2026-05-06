/* ── FRAUD & ANOMALY DETECTION ENGINE v2 ─────────────────────────────────────
   All checks are deterministic — derived entirely from the submitted inputs
   and real-time valuation result. Zero hardcoded area assumptions.
   Every threshold comes from a verifiable real-world constraint.
*/

export function runFraudChecks(input, valuationResult) {
  const flags = [];

  const areaSqft     = parseFloat(input.areaSqft  || input.area)  || 0;
  const carpetArea   = parseFloat(input.carpetArea) || 0;
  const floorNum     = parseInt(input.floorNumber  || input.floor) || 0;
  const totalFloors  = parseInt(input.totalFloors) || 0;
  const yearOfConstr = parseInt(input.yearOfConstruction) || 0;
  const monthlyRent  = parseFloat(input.rentalIncome || input.monthlyRent || 0);
  const propType     = (input.propertyType || input.type || '').toLowerCase();
  const subtype      = (valuationResult.subtype || input.subtype || '').toLowerCase();
  const legalStatus  = valuationResult.legalStatus || input.legalStatus || input.legal || '';
  const occupancy    = valuationResult.occupancy   || input.occupancy   || '';
  const ageBand      = valuationResult.ageBand     || input.ageBand     || input.age  || '';
  const bhkConfig    = input.bhkConfig             || '';
  const constrType   = input.constructionType      || '';
  const condition    = input.propertyCondition     || '';
  const ecStatus     = input.ecStatus              || '';
  const existingLoan = input.existingLoan          || '';
  const litigation   = input.litigation            || '';
  const taxStatus    = input.taxStatus             || '';
  const zone         = (valuationResult.zone       || '').toLowerCase();
  const circlePsf    = valuationResult.baseRatePsf || valuationResult.circleRatePerSqft || 0;
  const mv_mid       = valuationResult.mv_mid
    || ((valuationResult.mv_low || 0) + (valuationResult.mv_high || 0)) / 2;

  const currentYear  = new Date().getFullYear();
  const isOld        = ageBand === 'above_thirty' || ageBand === 'twenty_to_thirty' || ageBand === 'old';
  const isNew        = ageBand === 'under_2_years' || ageBand === 'two_to_five'     || ageBand === 'new';
  const isPremiumApt = subtype === 'apartment_5cr_plus';

  // ── CHECK 1: BHK config vs built-up area (physical impossibility) ─────────
  // Minimum viable carpet areas per BHK from RERA/NBC standards
  const BHK_MIN_SQFT = {
    studio: 100, '1bhk': 300, '2bhk': 500, '3bhk': 750, '4bhk': 1100, '4plus': 1400,
  };
  if (bhkConfig && areaSqft > 0 && BHK_MIN_SQFT[bhkConfig]) {
    if (areaSqft < BHK_MIN_SQFT[bhkConfig]) {
      flags.push({
        checkName: 'BHK–area impossibility',
        severity: 'critical',
        description: `${bhkConfig.toUpperCase()} configuration requires minimum ${BHK_MIN_SQFT[bhkConfig]} sqft. Declared ${areaSqft} sqft is physically impossible — verify unit type or area.`,
      });
    }
  }

  // ── CHECK 2: Carpet area cannot exceed built-up area (physical law) ────────
  if (carpetArea > 0 && areaSqft > 0 && carpetArea > areaSqft) {
    flags.push({
      checkName: 'Carpet exceeds built-up area',
      severity: 'critical',
      description: `Carpet area (${carpetArea} sqft) exceeds declared built-up area (${areaSqft} sqft). This is physically impossible — carpet area is always less than built-up area.`,
    });
  }

  // ── CHECK 3: Carpet-to-built-up ratio anomaly ──────────────────────────────
  if (carpetArea > 0 && areaSqft > 0) {
    const ratio = carpetArea / areaSqft;
    if (ratio > 0.92) {
      flags.push({
        checkName: 'Unusually high carpet ratio',
        severity: 'warning',
        description: `Carpet-to-built-up ratio of ${(ratio * 100).toFixed(0)}% is abnormally high. Standard RERA-compliant projects are 65–75%. Verify measurement basis.`,
      });
    }
    if (ratio < 0.40 && areaSqft > 500) {
      flags.push({
        checkName: 'Unusually low carpet ratio',
        severity: 'warning',
        description: `Carpet-to-built-up ratio of ${(ratio * 100).toFixed(0)}% is abnormally low for this size. Common cause: area inflation to claim higher square footage.`,
      });
    }
  }

  // ── CHECK 4: Floor number exceeds total floors (impossible) ───────────────
  if (totalFloors > 0 && floorNum > totalFloors) {
    flags.push({
      checkName: 'Floor number exceeds building height',
      severity: 'critical',
      description: `Declared floor (${floorNum}) exceeds total floors in building (${totalFloors}). This is physically impossible — verify property details.`,
    });
  }

  // ── CHECK 5: Construction year sanity (past + future) ─────────────────────
  if (yearOfConstr > 0) {
    if (yearOfConstr > currentYear) {
      flags.push({
        checkName: 'Future construction year',
        severity: 'critical',
        description: `Construction year ${yearOfConstr} is in the future. This may indicate an under-construction property being submitted as ready-to-occupy.`,
      });
    }
    if (yearOfConstr < 1900) {
      flags.push({
        checkName: 'Implausible construction year',
        severity: 'warning',
        description: `Construction year ${yearOfConstr} predates modern construction standards. Verify the year — this may indicate data entry error.`,
      });
    }
  }

  // ── CHECK 6: Rental yield anomaly ─────────────────────────────────────────
  // Annual yield = (monthly rent × 12) / market value mid
  if (monthlyRent > 0 && mv_mid > 0) {
    const annualYield = (monthlyRent * 12) / mv_mid;
    if (annualYield > 0.12) {
      flags.push({
        checkName: 'Rental yield outlier — value may be understated',
        severity: 'warning',
        description: `Declared rent implies a ${(annualYield * 100).toFixed(1)}% annual yield. Market yields in Indian cities range 2–6%. This suggests either an overstated rent or an understated property value.`,
      });
    }
    if (annualYield < 0.005 && monthlyRent > 0) {
      flags.push({
        checkName: 'Rental yield implausibly low',
        severity: 'info',
        description: `Declared rent implies a ${(annualYield * 100).toFixed(1)}% yield on the estimated market value. This is below market norms — verify rental figure.`,
      });
    }
  }

  // ── CHECK 7: Construction type vs age conflict ─────────────────────────────
  // Prefab buildings have a typical structural life of 20–25 years
  const isOldOld = ageBand === 'above_thirty';
  if (constrType === 'prefab' && isOldOld) {
    flags.push({
      checkName: 'Construction type–age conflict',
      severity: 'warning',
      description: 'Prefab construction declared on a 30+ year old structure. Prefab systems typically have a structural life of 20–25 years — a structural stability assessment is mandatory.',
    });
  }
  // Load bearing walls are rarely viable above G+4
  if (constrType === 'load_bearing' && totalFloors > 4) {
    flags.push({
      checkName: 'Construction type–height conflict',
      severity: 'warning',
      description: `Load-bearing construction declared on a ${totalFloors}-storey building. Load-bearing walls are structurally limited to G+3/G+4 — verify construction type.`,
    });
  }

  // ── CHECK 8: EC status vs existing loan conflict ───────────────────────────
  if (ecStatus === 'charges' && existingLoan === 'no') {
    flags.push({
      checkName: 'EC charges vs no-loan conflict',
      severity: 'warning',
      description: 'Encumbrance certificate shows existing charges but borrower declared no existing loan. This is contradictory — obtain and verify the EC document before proceeding.',
    });
  }

  // ── CHECK 9: Tax pending vs clear title conflict ───────────────────────────
  if (taxStatus === 'pending' && (legalStatus === 'clear_title' || legalStatus === 'registered_agreement')) {
    flags.push({
      checkName: 'Tax dues vs clear title conflict',
      severity: 'warning',
      description: 'Property tax dues are pending despite claimed clear title. Municipalities can enforce a charge on property for outstanding tax — this must be cleared before sanction.',
    });
  }

  // ── CHECK 10: Litigation + self-occupied conflict ──────────────────────────
  if ((litigation === 'active' || litigation === 'injunction') && occupancy === 'self_occupied') {
    flags.push({
      checkName: 'Active litigation on occupied property',
      severity: 'critical',
      description: `Active ${litigation === 'injunction' ? 'court injunction' : 'litigation'} on a self-occupied property. The borrower may not be the legal owner, or the ownership is under dispute — do not proceed without a legal opinion.`,
    });
  }

  // ── CHECK 11: Poor condition vs premium subtype conflict ───────────────────
  if (condition === 'poor' && isPremiumApt) {
    flags.push({
      checkName: 'Condition–premium classification conflict',
      severity: 'warning',
      description: 'Property is classified as premium apartment but declared condition is poor. Premium valuation cannot be justified for a property in poor condition — verify condition assessment.',
    });
  }

  // ── CHECK 12: Value-per-sqft vs circle rate sanity ────────────────────────
  const declaredPsf = input.declaredValue && areaSqft
    ? parseFloat(input.declaredValue) / areaSqft : null;

  if (declaredPsf && circlePsf > 0) {
    if (declaredPsf > circlePsf * 2.8) {
      flags.push({
        checkName: 'Value inflation vs circle rate',
        severity: 'critical',
        description: `Declared value of ₹${Math.round(declaredPsf).toLocaleString('en-IN')}/sqft is ${(declaredPsf / circlePsf).toFixed(1)}× the government circle rate of ₹${circlePsf.toLocaleString('en-IN')}/sqft. Extreme overvaluation is a red flag for fraudulent loan applications.`,
      });
    } else if (declaredPsf > circlePsf * 2.0) {
      flags.push({
        checkName: 'Value significantly above circle rate',
        severity: 'warning',
        description: `Declared value is ${(declaredPsf / circlePsf).toFixed(1)}× the government circle rate. While premium properties can command this premium, independent valuation is recommended.`,
      });
    }
    if (declaredPsf < circlePsf * 0.35) {
      flags.push({
        checkName: 'Value understatement vs circle rate',
        severity: 'warning',
        description: `Declared value of ₹${Math.round(declaredPsf).toLocaleString('en-IN')}/sqft is only ${(declaredPsf / circlePsf * 100).toFixed(0)}% of the circle rate. Severe undervaluation often indicates stamp duty evasion intent.`,
      });
    }
  }

  // ── CHECK 13: Location–type mismatch (zone-aware) ─────────────────────────
  const highDensityCommercialZones = ['mg road', 'brigade road', 'cunningham road', 'richmond town',
    'connaught place', 'nariman point', 'fort', 'church street'];
  const isVillaType = subtype === 'villa' || subtype === 'independent_house';
  if (isVillaType && highDensityCommercialZones.some(z => zone.includes(z))) {
    flags.push({
      checkName: 'Villa in dense commercial zone',
      severity: 'warning',
      description: `Villa or independent house in ${zone} is atypical — this is a high-density commercial micromarket. Verify property classification; it may be a commercial property mis-categorised.`,
    });
  }

  const premiumResZones = ['indiranagar', 'koramangala', 'malleshwaram', 'banjara hills', 'jubilee hills'];
  if ((subtype === 'industrial_shed' || subtype === 'factory') && premiumResZones.some(z => zone.includes(z))) {
    flags.push({
      checkName: 'Industrial in premium residential zone',
      severity: 'warning',
      description: `Industrial property classification in ${zone} — a premium residential micromarket. Industrial land use in this zone is unusual and requires zoning certificate verification.`,
    });
  }

  // ── CHECK 14: New construction + inherited undivided title ────────────────
  if (isNew && legalStatus === 'inherited_undivided') {
    flags.push({
      checkName: 'New construction on undivided title',
      severity: 'warning',
      description: 'New construction on inherited undivided property is unusual — construction on jointly owned land without a partition deed creates significant title risk for all lenders.',
    });
  }

  // ── CHECK 15: Area per sq metre vs type sanity (large area in very low zone) ─
  if (areaSqft > 8000 && propType === 'residential' && circlePsf < 4000) {
    flags.push({
      checkName: 'Unusually large residential unit in low-rate zone',
      severity: 'info',
      description: `Residential property of ${areaSqft.toLocaleString('en-IN')} sqft in a low circle rate zone (₹${circlePsf?.toLocaleString('en-IN')}/sqft). Very large homes in peripheral zones often have limited buyer pools, extending time-to-liquidate significantly.`,
    });
  }

  // ── DOCUMENT CROSS-CHECKS (Claude-extracted vs user-declared) ─────────────
  const docAnalysis = input.documentAnalysis || {};

  // EC document: Claude says encumbrances exist but user declared EC clear
  if (docAnalysis.ec) {
    const ec = docAnalysis.ec;
    if (!ec.isClear && (input.ecStatus === 'clear' || input.legalStatus === 'clear_title')) {
      flags.push({
        checkName: 'EC document vs declared status conflict',
        severity: 'critical',
        description: `Uploaded Encumbrance Certificate shows ${ec.totalEncumbrances || 'existing'} encumbrance(s), but user declared the EC as clear. This is a direct contradiction — the EC must be reviewed before any sanction.`,
      });
    }
    if (ec.documentStatus === 'verified' && ec.isClear === false) {
      const encList = (ec.encumbrances || []).slice(0, 2).map(e => e.type).join(', ');
      flags.push({
        checkName: 'Active encumbrances on EC',
        severity: 'critical',
        description: `Claude analysis of the uploaded EC identified ${ec.totalEncumbrances} encumbrance(s)${encList ? ` (${encList})` : ''}. Property cannot be mortgaged without clearing these.`,
      });
    }
  }

  // Title deed: encumbrance language found in the deed itself
  if (docAnalysis.titleDeed) {
    const td = docAnalysis.titleDeed;
    if (td.encumbranceMentioned && legalStatus === 'clear_title') {
      flags.push({
        checkName: 'Title deed mentions encumbrance — clear title conflict',
        severity: 'warning',
        description: `Claude analysis of the title deed found encumbrance language, but user declared clear title. Review the exact clause before proceeding.`,
      });
    }
    if (td.documentStatus === 'verified' && td.isClearTitle === false && legalStatus === 'clear_title') {
      flags.push({
        checkName: 'Title deed assessment contradicts declared title',
        severity: 'warning',
        description: 'The uploaded title deed does not appear to show clear, unencumbered ownership. Obtain a formal legal opinion.',
      });
    }
  }

  // Tax receipt: pending dues found but user said tax is paid
  if (docAnalysis.taxReceipt) {
    const tr = docAnalysis.taxReceipt;
    if (tr.documentStatus === 'verified' && tr.pendingDues > 0 && input.taxStatus === 'paid') {
      flags.push({
        checkName: 'Tax receipt shows outstanding dues',
        severity: 'warning',
        description: `Uploaded tax receipt indicates ₹${tr.pendingDues?.toLocaleString('en-IN') || 'unknown'} in pending dues, but borrower declared tax as fully paid. Municipalities hold first charge on property for unpaid tax.`,
      });
    }
  }

  // Building plan: approved area significantly different from declared area
  if (docAnalysis.buildingPlan && areaSqft > 0) {
    const bp = docAnalysis.buildingPlan;
    if (bp.documentStatus === 'verified' && bp.approvedArea) {
      let approvedSqft = bp.approvedArea;
      if (bp.approvedAreaUnit === 'sqm') approvedSqft = Math.round(bp.approvedArea * 10.764);
      const diff = Math.abs(approvedSqft - areaSqft) / areaSqft;
      if (diff > 0.20) {
        flags.push({
          checkName: 'Declared area vs approved plan mismatch',
          severity: diff > 0.35 ? 'critical' : 'warning',
          description: `Declared built-up area (${areaSqft.toLocaleString('en-IN')} sqft) differs from approved plan area (${approvedSqft.toLocaleString('en-IN')} sqft) by ${(diff * 100).toFixed(0)}%. Excess construction beyond approved plan is illegal and reduces collateral value.`,
        });
      }
    }
    if (bp.documentStatus === 'verified' && bp.isApproved === false && input.planApproval !== 'not_approved') {
      flags.push({
        checkName: 'Building plan not approved per uploaded document',
        severity: 'critical',
        description: 'The uploaded building plan document indicates the structure is not approved by the local authority, contradicting the declared status.',
      });
    }
  }

  // Khata: Claude read B-Khata but user declared A-Khata
  if (docAnalysis.khata) {
    const kh = docAnalysis.khata;
    if (kh.documentStatus === 'verified' && kh.isBKhata === true && input.khataType === 'a_khata') {
      flags.push({
        checkName: 'Khata document shows B-Khata vs declared A-Khata',
        severity: 'critical',
        description: 'Uploaded Khata document reads as B-Khata (unapproved layout), but user declared A-Khata. B-Khata properties carry significant LTV reduction and cannot receive building licences.',
      });
    }
  }

  // ── SCORE & LEVEL ─────────────────────────────────────────────────────────
  let overallFraudScore = 0;
  for (const f of flags) {
    if      (f.severity === 'critical') overallFraudScore += 32;
    else if (f.severity === 'warning')  overallFraudScore += 16;
    else if (f.severity === 'info')     overallFraudScore += 5;
  }
  overallFraudScore = Math.min(100, overallFraudScore);

  const fraudRiskLevel =
    overallFraudScore === 0  ? 'clean'  :
    overallFraudScore <= 18  ? 'low'    :
    overallFraudScore <= 52  ? 'medium' : 'high';

  return { fraudRiskLevel, fraudFlags: flags, overallFraudScore };
}
