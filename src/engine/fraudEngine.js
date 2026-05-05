/* ── FRAUD & ANOMALY DETECTION ENGINE ────────────────────────────────────── */

export function runFraudChecks(input, valuationResult) {
  const flags = [];

  const areaSqft    = parseFloat(input.areaSqft  || input.area)  || 0;
  const propType    = (input.propertyType || input.type || '').toLowerCase();
  const subtype     = (valuationResult.subtype || input.subtype  || '').toLowerCase();
  const legalStatus = valuationResult.legalStatus || input.legalStatus || input.legal || '';
  const occupancy   = valuationResult.occupancy   || input.occupancy   || '';
  const ageBand     = valuationResult.ageBand     || input.ageBand     || input.age   || '';
  const zone        = (valuationResult.zone || '').toLowerCase();

  // ── CHECK 1: Area sanity ─────────────────────────────────────────────────
  if (subtype.includes('apartment') && areaSqft > 0 && areaSqft < 200) {
    flags.push({
      checkName: 'Minimum area',
      severity: 'critical',
      description: 'Declared area below minimum viable residential unit for Bengaluru.',
    });
  }
  if (subtype.includes('apartment') && areaSqft > 15000) {
    flags.push({
      checkName: 'Maximum area',
      severity: 'warning',
      description: 'Declared area unusually large for apartment category — verify unit type.',
    });
  }
  if ((subtype === 'residential_plot' || subtype === 'plot') && areaSqft > 0 && areaSqft < 100) {
    flags.push({
      checkName: 'Plot minimum area',
      severity: 'warning',
      description: 'Declared plot area is unusually small — verify survey measurements.',
    });
  }
  if ((subtype === 'office_space' || subtype === 'office') && areaSqft > 0 && areaSqft < 150) {
    flags.push({
      checkName: 'Office minimum area',
      severity: 'info',
      description: 'Office area below typical minimum for commercial lending.',
    });
  }

  // ── CHECK 2: Value-per-sqft sanity ───────────────────────────────────────
  const declaredPsf = input.declaredValue && areaSqft
    ? parseFloat(input.declaredValue) / areaSqft : null;
  const circlePsf   = valuationResult.baseRatePsf || valuationResult.circleRatePerSqft || 0;

  if (declaredPsf && circlePsf > 0) {
    if (declaredPsf > circlePsf * 2.5) {
      flags.push({
        checkName: 'Value inflation',
        severity: 'critical',
        description: 'Declared value significantly exceeds circle rate benchmark — potential inflation detected.',
      });
    }
    if (declaredPsf < circlePsf * 0.4) {
      flags.push({
        checkName: 'Value understatement',
        severity: 'warning',
        description: 'Declared value significantly below circle rate — potential undervaluation for stamp duty purposes.',
      });
    }
  }

  // ── CHECK 3: Location–type mismatch ──────────────────────────────────────
  const highDensityZones = ['mg road', 'brigade road', 'cunningham road', 'richmond town'];
  const isVillaType      = subtype === 'villa' || subtype === 'independent_house';

  if (isVillaType && highDensityZones.some(z => zone.includes(z))) {
    flags.push({
      checkName: 'Location type mismatch',
      severity: 'warning',
      description: 'Villa or independent house in high-density commercial zone is atypical — verify property classification.',
    });
  }

  const premiumResZones = ['indiranagar', 'koramangala', 'malleshwaram'];
  if ((subtype === 'industrial_shed' || subtype === 'factory') && premiumResZones.some(z => zone.includes(z))) {
    flags.push({
      checkName: 'Industrial zone mismatch',
      severity: 'warning',
      description: 'Industrial classification in premium residential zone requires verification.',
    });
  }

  // ── CHECK 4: Legal & occupancy conflict ───────────────────────────────────
  if ((legalStatus === 'disputed' || legalStatus === 'unknown') && occupancy === 'self_occupied') {
    flags.push({
      checkName: 'Legal–occupancy conflict',
      severity: 'warning',
      description: 'Self-occupied status on disputed title property requires explanation.',
    });
  }
  if ((legalStatus === 'government_lease') && propType === 'commercial') {
    flags.push({
      checkName: 'Government lease commercial',
      severity: 'info',
      description: 'Government lease commercial properties have restricted transferability.',
    });
  }

  // ── CHECK 5: Age & type conflict ──────────────────────────────────────────
  const isNew    = ageBand === 'under_2_years' || ageBand === 'two_to_five' || ageBand === 'new';
  const isOld    = ageBand === 'above_thirty'  || ageBand === 'twenty_to_thirty' || ageBand === 'old';
  const isPremium = subtype === 'apartment_5cr_plus';

  if (isNew && legalStatus === 'inherited_undivided') {
    flags.push({
      checkName: 'New construction title conflict',
      severity: 'warning',
      description: 'New construction with inherited undivided title is unusual — verify acquisition chain.',
    });
  }
  if (isOld && isPremium) {
    flags.push({
      checkName: 'Age–premium conflict',
      severity: 'info',
      description: 'Premium apartment classification on 30 year old structure warrants condition verification.',
    });
  }

  // ── SCORE & LEVEL ─────────────────────────────────────────────────────────
  let overallFraudScore = 0;
  for (const f of flags) {
    if (f.severity === 'critical') overallFraudScore += 30;
    else if (f.severity === 'warning') overallFraudScore += 15;
    else if (f.severity === 'info')    overallFraudScore += 5;
  }
  overallFraudScore = Math.min(100, overallFraudScore);

  const fraudRiskLevel =
    overallFraudScore === 0  ? 'clean'  :
    overallFraudScore <= 20  ? 'low'    :
    overallFraudScore <= 50  ? 'medium' : 'high';

  return { fraudRiskLevel, fraudFlags: flags, overallFraudScore };
}
