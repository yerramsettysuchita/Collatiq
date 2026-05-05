const CIRCLE_RATES = {
  bengaluru:     { residential: 4200, commercial: 6800,  industrial: 2800 },
  mumbai:        { residential: 8500, commercial: 14000, industrial: 4500 },
  hyderabad:     { residential: 3800, commercial: 6200,  industrial: 2400 },
  chennai:       { residential: 4000, commercial: 6500,  industrial: 2600 },
  pune:          { residential: 4500, commercial: 7200,  industrial: 3000 },
  delhi:         { residential: 6200, commercial: 10500, industrial: 3800 },
  ahmedabad:     { residential: 4000, commercial: 6500,  industrial: 2600 },
  kolkata:       { residential: 4500, commercial: 7000,  industrial: 2800 },
  kochi:         { residential: 5500, commercial: 8500,  industrial: 3000 },
  nagpur:        { residential: 3500, commercial: 5500,  industrial: 2200 },
  indore:        { residential: 3800, commercial: 6000,  industrial: 2400 },
  jaipur:        { residential: 4000, commercial: 6500,  industrial: 2500 },
  lucknow:       { residential: 3500, commercial: 5500,  industrial: 2200 },
  surat:         { residential: 4200, commercial: 6800,  industrial: 2800 },
  vadodara:      { residential: 3800, commercial: 6000,  industrial: 2400 },
  chandigarh:    { residential: 5500, commercial: 8500,  industrial: 3200 },
  coimbatore:    { residential: 3800, commercial: 6000,  industrial: 2400 },
  bhopal:        { residential: 3500, commercial: 5500,  industrial: 2200 },
  visakhapatnam: { residential: 3800, commercial: 6000,  industrial: 2400 },
  default:       { residential: 3500, commercial: 5500,  industrial: 2200 },
};

const TYPE_MULTIPLIERS = {
  residential: { apartment: 1.0, villa: 1.35, plot: 0.72 },
  commercial:  { shop: 1.22, office: 1.10, warehouse: 0.84 },
  industrial:  { factory: 0.95, warehouse: 0.80, land: 0.62 },
};

const AGE_FACTORS      = { new: 1.08, mid: 0.96, old: 0.82 };
const OCCUPANCY_ADJ    = { self: 1.02, rented: 1.05, vacant: 0.90 };
const LEGAL_ADJ        = { clear: 1.0, complex: 0.88, unknown: 0.80 };
const LOCATION_MULT    = { premium: 1.45, high: 1.22, standard: 1.0, low: 0.82 };
const LIQUIDITY_DISC   = { premium: 0.15, high: 0.20, standard: 0.26, low: 0.32 };

const PREMIUM_AREAS = [
  'indiranagar','koramangala','banjara hills','jubilee hills',
  'andheri west','bandra','boat club road','anna nagar',
  'nungambakkam','defence colony','vasant vihar',
];
const HIGH_AREAS = [
  'whitefield','hsr layout','viman nagar','kothrud','t nagar',
  'adyar','madhapur','gachibowli','jayanagar','malleswaram',
];

function detectCity(address) {
  const a = address.toLowerCase();
  if (a.includes('bengaluru') || a.includes('bangalore'))                    return 'bengaluru';
  if (a.includes('mumbai')    || a.includes('bombay'))                       return 'mumbai';
  if (a.includes('hyderabad'))                                               return 'hyderabad';
  if (a.includes('chennai')   || a.includes('madras'))                       return 'chennai';
  if (a.includes('pune'))                                                    return 'pune';
  if (a.includes('delhi')     || a.includes('gurgaon') || a.includes('noida')) return 'delhi';
  if (a.includes('ahmedabad'))                                               return 'ahmedabad';
  if (a.includes('kolkata')   || a.includes('calcutta'))                     return 'kolkata';
  if (a.includes('kochi')     || a.includes('cochin'))                       return 'kochi';
  if (a.includes('nagpur'))                                                  return 'nagpur';
  if (a.includes('indore'))                                                  return 'indore';
  if (a.includes('jaipur'))                                                  return 'jaipur';
  if (a.includes('lucknow'))                                                 return 'lucknow';
  if (a.includes('surat'))                                                   return 'surat';
  if (a.includes('vadodara')  || a.includes('baroda'))                       return 'vadodara';
  if (a.includes('chandigarh'))                                              return 'chandigarh';
  if (a.includes('coimbatore'))                                              return 'coimbatore';
  if (a.includes('bhopal'))                                                  return 'bhopal';
  if (a.includes('visakhapatnam') || a.includes('vizag'))                    return 'visakhapatnam';
  return 'default';
}

function detectLocationTier(address) {
  const a = address.toLowerCase();
  if (PREMIUM_AREAS.some(z => a.includes(z))) return 'premium';
  if (HIGH_AREAS.some(z => a.includes(z)))    return 'high';
  return 'standard';
}

function computeRPI(inputs, locationTier) {
  const loc    = { premium: 90, high: 74, standard: 58, low: 42 }[locationTier];
  const sub    = inputs.subtype;
  const config = (sub === 'apartment' || sub === 'villa' || sub === 'office') ? 72
               : (sub === 'shop') ? 68 : 54;
  const demand = { premium: 84, high: 70, standard: 54, low: 38 }[locationTier];
  const legal  = { clear: 90, complex: 54, unknown: 42 }[inputs.legal] ?? 66;
  const age    = { new: 88, mid: 72, old: 54 }[inputs.age] ?? 72;
  const rental = { rented: 80, self: 64, vacant: 38 }[inputs.occupancy] ?? 64;

  return Math.round(
    loc * 0.30 + config * 0.20 + demand * 0.20 +
    legal * 0.15 + age * 0.10 + rental * 0.05
  );
}

function computeConfidence(inputs, variance, rpi) {
  let conf = 0.84;
  if (!inputs.area)                      conf -= 0.08;
  if (!inputs.floor)                     conf -= 0.03;
  if (!inputs.age)                       conf -= 0.04;
  if (inputs.legal === 'unknown')        conf -= 0.06;
  if (inputs.legal === 'complex')        conf -= 0.03;
  conf -= variance * 0.45;
  if (rpi < 45) conf -= 0.08;
  if (rpi > 75) conf += 0.04;
  const filled = [inputs.area, inputs.floor, inputs.age, inputs.occupancy, inputs.legal, inputs.subtype]
    .filter(Boolean).length;
  conf += (filled / 6) * 0.05;
  return Math.min(0.93, Math.max(0.30, parseFloat(conf.toFixed(2))));
}

function generateFlags(inputs, confidence, rpi, locationTier) {
  const flags = [];
  if (inputs.legal === 'complex') {
    flags.push({ severity: 'medium', text: 'Legal title has reported complexity. A title verification report from an empanelled advocate is recommended before sanction.' });
  }
  if (inputs.legal === 'unknown') {
    flags.push({ severity: 'high', text: 'Legal status was not provided. No sanction should proceed without a legal opinion. This is the single highest-impact action you can take to reduce risk on this file.' });
  }
  if (inputs.age === 'old') {
    flags.push({ severity: 'medium', text: 'The structure is over fifteen years old. A structural stability assessment would tighten the valuation range and reduce uncertainty.' });
  }
  if (inputs.occupancy === 'vacant') {
    flags.push({ severity: 'low', text: 'The property is currently vacant. Vacant assets in this micromarket typically take around 40 percent longer to liquidate than occupied ones.' });
  }
  if (rpi < 50) {
    flags.push({ severity: 'medium', text: 'Resale potential sits below the standard threshold for the base LTV band. Consider a reduced exposure or ask for additional collateral.' });
  }
  if (confidence < 0.60) {
    flags.push({ severity: 'medium', text: 'The engine is working with limited input data and confidence is below 0.60. A physical inspection is strongly recommended before proceeding.' });
  }
  if (locationTier === 'standard' && flags.length < 2) {
    flags.push({ severity: 'low', text: 'Micromarket competition is moderate. Around 12 to 18 comparable listings are active within one kilometre of the subject property.' });
  }
  if (flags.length === 0) {
    flags.push({ severity: 'low', text: 'No significant concerns were detected. Standard monitoring applies for this collateral category.' });
  }
  return flags;
}

function buildNarrative(inputs, locationTier, rpi, verdict) {
  const locDetail = {
    premium: 'a high-demand premium corridor with strong infrastructure access, robust civic amenities, and consistently high transaction velocity. Properties in this tier typically attract institutional and high-net-worth buyers, which supports price resilience even during broader market downturns.',
    high:    'a well-connected established locality with good amenity coverage and proven demand. The area has demonstrated stable appreciation over the past valuation cycles and has sufficient liquidity to support a timely exit under normal market conditions.',
    standard:'a developing micromarket with adequate infrastructure and steady but modest demand. Growth in this corridor is driven primarily by residential end-users rather than investors, which keeps short-term price volatility low but also limits rapid appreciation potential.',
    low:     'a lower-demand micromarket with limited infrastructure access and thin transaction volumes. Comparable sales data for this area is sparse, which increases estimation uncertainty and warrants a wider valuation band.',
  };

  const ageDetail = {
    new: 'The asset is relatively new, which supports a modest appreciation premium above the standard depreciation curve. New construction in this micromarket typically attracts a six to ten percent premium over five-year-old comparable stock, and the lower maintenance liability improves borrower affordability projections over the loan tenure.',
    mid: 'The building age falls in the mid-band, where standard depreciation applies without exceptional penalty. Assets of this vintage are the most liquid in most Indian micromarkets as they balance price competitiveness with structural soundness. No residual life concerns are anticipated within a standard ten-year loan tenure.',
    old: 'The structure is over fifteen years old and an accelerated depreciation adjustment has been built into the estimate. A structural stability and residual life assessment by an empanelled engineer is strongly recommended before sanction, as assets of this age introduce meaningful uncertainty around future maintenance costs and resale liquidity.',
  };

  const legalDetail = {
    clear:   'Title documentation has been indicated as clear, which supports the estimate at full face value and removes a common source of valuation risk. A registered sale deed and encumbrance certificate on file is the single most effective factor in supporting a higher LTV recommendation.',
    complex: 'Legal complexity has been flagged on this property and a cautious discount has been built into the estimate to reflect the additional risk and potential holding cost during resolution. A comprehensive title search covering the last thirty years along with a legal opinion from an empanelled advocate are essential prerequisites before sanction.',
    unknown: 'Legal status was not provided at assessment time and a conservative haircut has been applied to the market value to reflect this uncertainty. This is the highest-priority data gap in this file and no lending decision should proceed without a verified title report, registered sale deed, and encumbrance certificate.',
  };

  const occupancyDetail = {
    self:    'The property is self-occupied, which is the most lender-friendly occupancy profile. Owner-occupied assets in this category carry a lower probability of deferred maintenance and tend to transact faster in distress scenarios.',
    rented:  'The property is currently tenanted. While rental income provides partial income coverage, a tenanted asset may face a discount of five to twelve percent versus vacant possession in a forced sale scenario, depending on the terms of the lease agreement.',
    vacant:  'The property is currently vacant. Vacancy adds both a carrying cost risk and a liquidity discount. Assets that have been vacant for more than six months in this micromarket tier show an average fifteen to twenty percent longer time to sale versus occupied comparables.',
  };

  /* ── RPI and liquidity conclusion ─────────────────────────────────────── */
  const _rpiTier   = rpi >= 65 ? 'upper' : rpi >= 45 ? 'mid' : 'lower'; // eslint-disable-line no-unused-vars
  const rpiComment = rpi >= 65
    ? `A Resale Potential Index of ${rpi} places this asset in the upper tier for its category. In the event of a default, recovery is expected to be strong with exit achievable well within the standard six-month workout window.`
    : rpi >= 45
    ? `A Resale Potential Index of ${rpi} places this asset in the mid tier for its category. Recovery under distress is feasible within the standard window, though marketing costs and time-on-market may slightly reduce net realization versus the headline estimate.`
    : `A Resale Potential Index of ${rpi} places this asset in the lower tier for its category. Limited liquidity is the primary risk factor in this file. The recommended LTV ceiling reflects the extended time-to-liquidate and the potential need for a below-market pricing strategy to attract buyers.`;

  const paragraphs = [
    `This property sits in ${locDetail[locationTier] || locDetail.standard}`,
    `${ageDetail[inputs.age] || ageDetail.mid} ${legalDetail[inputs.legal] || legalDetail.unknown}`,
    `${occupancyDetail[inputs.occupancy] || occupancyDetail.self}`,
    rpiComment,
  ];

  return paragraphs.join('\n\n');
}

function generateValuationId() {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand  = Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `CLQ-${date}-${rand}`;
}

export function computeValuation(inputs) {
  const city         = detectCity(inputs.address || '');
  const locationTier = detectLocationTier(inputs.address || '');
  const propType     = (inputs.type || 'residential').toLowerCase();
  const subtype      = (inputs.subtype || 'apartment').toLowerCase();
  const area         = parseFloat(inputs.area) || 1000;
  const floorNum     = parseInt(inputs.floor) || 1;

  // Accept real geo-derived circle rate if provided; fall back to city table
  const circleRate   = inputs.circleRateData?.ratePerSqft
    || inputs._circleRate
    || (CIRCLE_RATES[city] || CIRCLE_RATES.default)[propType] || 3500;
  const typeMult     = TYPE_MULTIPLIERS[propType]?.[subtype] || 1.0;
  const locMult      = LOCATION_MULT[locationTier];
  const ageFactor    = AGE_FACTORS[inputs.age] || AGE_FACTORS.mid;
  const occupancyAdj = OCCUPANCY_ADJ[inputs.occupancy] || 1.0;
  const legalAdj     = LEGAL_ADJ[inputs.legal] || LEGAL_ADJ.unknown;
  const floorAdj     = floorNum === 0 ? 0.96 : (floorNum >= 2 && floorNum <= 6) ? 1.02 : floorNum > 10 ? 0.97 : 1.0;

  const baseValue = circleRate * area * locMult * typeMult * ageFactor * occupancyAdj * legalAdj * floorAdj;
  const variance  = 0.09
    + (inputs.legal === 'unknown' ? 0.04 : 0)
    + (inputs.age   === 'old'     ? 0.02 : 0)
    + (!inputs.area                ? 0.03 : 0);

  const round = (v) => Math.round(v / 100000) * 100000;
  const mv_low  = round(baseValue * (1 - variance));
  const mv_high = round(baseValue * (1 + variance));

  const liqDisc = LIQUIDITY_DISC[locationTier];
  const dv_low  = round(mv_low  * (1 - liqDisc));
  const dv_high = round(mv_high * (1 - liqDisc * 0.65));

  const rpi        = computeRPI(inputs, locationTier);
  const ttl_low    = rpi > 74 ? 30  : rpi > 59 ? 45  : rpi > 44 ? 75  : 120;
  const ttl_high   = rpi > 74 ? 60  : rpi > 59 ? 90  : rpi > 44 ? 150 : 240;
  const confidence = computeConfidence(inputs, variance, rpi);
  const flags      = generateFlags(inputs, confidence, rpi, locationTier);

  const hasHigh = flags.some(f => f.severity === 'high');

  let verdict, ltv_band;
  if (confidence >= 0.75 && rpi >= 65 && !hasHigh) {
    verdict  = 'Sanction Recommended'; ltv_band = '62–70%';
  } else if (!hasHigh && (confidence >= 0.55 || rpi >= 45)) {
    verdict  = 'Conditional Review';   ltv_band = '50–60%';
  } else {
    verdict  = 'High Risk';            ltv_band = 'Below 50% or decline';
  }

  const circleRatePerSqft = Math.round(circleRate * locMult);

  const drivers = [
    { label: 'Location tier',              impact: locationTier === 'premium' ? +22 : locationTier === 'high' ? +14 : locationTier === 'standard' ? +5 : -4,  dir: locationTier === 'low' ? -1 : 1 },
    { label: `${inputs.subtype || 'Standard'} configuration`, impact: typeMult > 1.1 ? +11 : typeMult < 0.9 ? -9 : +5, dir: typeMult < 0.9 ? -1 : 1 },
    { label: 'Infrastructure access',      impact: locationTier === 'premium' ? +9 : locationTier === 'high' ? +6 : +3, dir: 1 },
    { label: `Occupancy (${inputs.occupancy || 'self'})`, impact: occupancyAdj > 1 ? +4 : occupancyAdj < 1 ? -9 : +2, dir: occupancyAdj >= 1 ? 1 : -1 },
    { label: `Age band (${inputs.age || 'mid'})`, impact: inputs.age === 'new' ? +7 : inputs.age === 'old' ? -14 : 0, dir: inputs.age === 'old' ? -1 : inputs.age === 'new' ? 1 : 0 },
    { label: 'Micromarket competition',    impact: locationTier === 'premium' ? -5 : -9, dir: -1 },
  ];

  // Use real geo infra score if provided; fall back to location-tier estimate
  const infraScore = inputs.precomputedInfra?.infraScore
    ?? inputs._infraScore
    ?? (locationTier === 'premium' ? 84 : locationTier === 'high' ? 72 : 57);

  const infra = {
    score:       infraScore,
    competition: locationTier === 'premium' ? 'Elevated' : locationTier === 'high' ? 'Moderate' : 'Low to moderate',
  };

  const narrative = buildNarrative(inputs, locationTier, rpi, verdict);

  const peers = generatePeers(inputs, mv_low, mv_high, rpi, locationTier);

  const valuationId = generateValuationId();

  const result = {
    address: inputs.address,
    propertyType: inputs.type,
    subtype: inputs.subtype,
    area,
    mv_low, mv_high,
    dv_low, dv_high,
    rpi, ttl_low, ttl_high,
    confidence, ltv_band, verdict,
    flags, drivers, circleRatePerSqft,
    infra, narrative, peers,
    valuationId,
    modelVersion: 'v2.1.0-demo',
    timestamp: new Date().toISOString(),
    inputs,
  };

  try {
    sessionStorage.setItem(valuationId, JSON.stringify(result));
  } catch {}

  return result;
}

function generatePeers(inputs, mv_low, mv_high, rpi, locationTier) {
  const midValue = (mv_low + mv_high) / 2;
  const area     = parseFloat(inputs.area) || 1000;
  const sub      = inputs.subtype || 'apartment';

  // Generate comparables with meaningful variation
  const compAArea = Math.round(area * (0.78 + Math.random() * 0.14)); // 78-92% of subject
  const compBArea = Math.round(area * (1.10 + Math.random() * 0.18)); // 110-128% of subject
  const compASpread = 0.14 + Math.random() * 0.08; // 14-22% below
  const compBSpread = 0.06 + Math.random() * 0.12; // 6-18% above

  // Different subtypes for variety
  const altSubtypes = {
    apartment: ['apartment', 'villa'],
    villa: ['villa', 'apartment'],
    plot: ['plot', 'plot'],
    shop: ['shop', 'office'],
    office: ['office', 'shop'],
    warehouse: ['warehouse', 'warehouse'],
    factory: ['factory', 'warehouse'],
    land: ['land', 'land'],
  };
  const subtypes = altSubtypes[sub] || [sub, sub];

  // Locality names based on tier
  const locNames = {
    premium: ['Adjacent premium corridor', 'Same micro-zone, older complex'],
    high:    ['Adjoining established locality', 'Same locality, different phase'],
    standard:['Same locality, inner block', 'Parallel road, similar profile'],
    low:     ['Same ward, arterial road', 'Adjacent colony'],
  };
  const locs = locNames[locationTier] || locNames.standard;

  return [
    {
      label: 'Comparable A',
      type: inputs.type,
      subtype: subtypes[0],
      area: compAArea,
      location: locs[0],
      mv_low:  Math.round(midValue * (1 - compASpread - 0.06) / 100000) * 100000,
      mv_high: Math.round(midValue * (1 - compASpread + 0.08) / 100000) * 100000,
      rpi: Math.max(15, rpi - 8 - Math.round(Math.random() * 7)),
    },
    {
      label: 'Subject property',
      type: inputs.type,
      subtype: inputs.subtype,
      area: area,
      location: inputs.address || 'Subject',
      mv_low, mv_high, rpi,
      isSubject: true,
    },
    {
      label: 'Comparable B',
      type: inputs.type,
      subtype: subtypes[1],
      area: compBArea,
      location: locs[1],
      mv_low:  Math.round(midValue * (1 + compBSpread - 0.04) / 100000) * 100000,
      mv_high: Math.round(midValue * (1 + compBSpread + 0.10) / 100000) * 100000,
      rpi: Math.min(95, rpi + 3 + Math.round(Math.random() * 8)),
    },
  ];
}

/* ── NORMALISATION MAPS (old form values → new schema) ───────────────────── */
const AGE_NORM    = { new: 'two_to_five', mid: 'ten_to_twenty', old: 'twenty_to_thirty' };
const OCC_NORM    = { self: 'self_occupied', rented: 'rented_with_agreement', vacant: 'vacant' };
const LEGAL_NORM  = { clear: 'clear_title', complex: 'unregistered', unknown: 'unregistered' };
const SUBTYPE_NORM = {
  apartment: 'apartment_under_5cr', villa: 'villa', plot: 'residential_plot',
  shop: 'retail_shop', office: 'office_space', warehouse: 'warehouse',
  factory: 'industrial_shed', land: 'commercial_plot',
};
const AGE_NORM_BACK   = { two_to_five: 'new', under_2_years: 'new', five_to_ten: 'mid', ten_to_twenty: 'mid', twenty_to_thirty: 'old', above_thirty: 'old' };
const OCC_NORM_BACK   = { self_occupied: 'self', rented_with_agreement: 'rented', rented_without_agreement: 'rented', vacant: 'vacant', tenant_disputed: 'vacant' };
const LEGAL_NORM_BACK = { clear_title: 'clear', registered_agreement: 'clear', unregistered: 'complex', disputed: 'unknown', inherited_undivided: 'unknown', government_lease: 'unknown', encumbered: 'unknown' };

const PROPERTY_TYPE_MULTIPLIER = {
  apartment_under_5cr: 1.00, apartment_5cr_plus: 1.08, independent_house: 1.12,
  villa: 1.18, row_house: 1.06, studio: 0.92,
  office_space: 1.15, retail_shop: 1.22, showroom: 1.28, warehouse: 0.78, industrial_shed: 0.72,
  residential_plot: 0.88, commercial_plot: 0.95,
};
const AGE_ADJUSTMENT = {
  under_2_years: 1.05, two_to_five: 1.02, five_to_ten: 0.97,
  ten_to_twenty: 0.91, twenty_to_thirty: 0.84, above_thirty: 0.76,
};
const OCCUPANCY_ADJUSTMENT_V2 = {
  self_occupied: 1.00, rented_with_agreement: 0.94, rented_without_agreement: 0.88,
  vacant: 0.96, tenant_disputed: 0.82,
};
const LEGAL_ADJUSTMENT_V2 = {
  clear_title: 1.00, registered_agreement: 0.97, unregistered: 0.88,
  disputed: 0.72, inherited_undivided: 0.85, government_lease: 0.78, encumbered: 0.70,
};
const DISTRESS_DISCOUNT = {
  apartment_under_5cr: 0.75, apartment_5cr_plus: 0.75, studio: 0.75, row_house: 0.70,
  villa: 0.70, independent_house: 0.70,
  office_space: 0.65, retail_shop: 0.65, showroom: 0.65, warehouse: 0.65,
  residential_plot: 0.68, commercial_plot: 0.68,
  industrial_shed: 0.60,
};

/* ── New-field adjustment tables ────────────────────────────────────────── */
const CONSTRUCTION_ADJ = {
  rcc_frame: 1.00, load_bearing: 0.92, steel: 1.05, prefab: 0.85,
};
const FACING_ADJ = {
  east: 1.05, north: 1.03, north_east: 1.04, north_west: 1.01,
  west: 1.00, south_east: 1.01, south_west: 0.98, south: 0.97,
};
const OC_ADJ   = { present: 1.00, absent: 0.92, na: 0.98 };
const EC_ADJ   = { clear: 1.00, charges: 0.85, not_obtained: 0.95 };
const PLAN_ADJ = { approved: 1.00, not_approved: 0.80, unknown: 0.92 };

const KHATA_ADJ = {
  a_khata: 1.00, b_khata: 0.72, no_khata: 0.60, na: 1.00,
};
const BHK_FACTOR = {
  studio: 0.92, '1bhk': 0.96, '2bhk': 1.00, '3bhk': 1.08, '4bhk': 1.12, '4plus': 1.15,
};
const CONDITION_ADJ = {
  excellent: 1.10, good: 1.00, fair: 0.88, poor: 0.75,
};
const ROAD_WIDTH_ADJ = {
  lt_20: 0.88, '20_40': 1.00, '40_60': 1.12, gt_60: 1.22,
};
const LITIGATION_ADJ = {
  none: 1.00, active: 0.60, injunction: 0.45, unknown: 0.85,
};

function deriveLegalStatusFromForm(input, rawLegalStatus) {
  const ec   = input.ecStatus;
  const oc   = input.ocStatus;
  const plan = input.planApproval;
  const loan = input.existingLoan;
  if (ec === 'charges' || loan === 'yes')           return 'encumbered';
  if (plan === 'not_approved')                       return 'disputed';
  if (ec === 'clear' && oc === 'present' && plan === 'approved') return 'clear_title';
  if (ec === 'clear' && oc !== 'absent')             return 'registered_agreement';
  if (oc === 'absent' || ec === 'not_obtained')      return 'unregistered';
  return rawLegalStatus;
}

function deriveAgeBandFromYear(input, fallbackBand) {
  const yr = parseInt(input.yearOfConstruction || input._yearOfConstruction);
  if (!yr || yr < 1900) return fallbackBand;
  const age = new Date().getFullYear() - yr;
  if (age < 2)  return 'under_2_years';
  if (age < 5)  return 'two_to_five';
  if (age < 10) return 'five_to_ten';
  if (age < 20) return 'ten_to_twenty';
  if (age < 30) return 'twenty_to_thirty';
  return 'above_thirty';
}

export function runValuation(input) {
  // Normalise field names (form uses type/area/floor/age/legal; pipeline may use new names)
  const address    = input.address || '';
  const lat        = input.lat  ?? null;
  const lng        = input.lng  ?? null;
  const propType   = (input.propertyType || input.type || 'residential').toLowerCase();
  const rawSubtype = (input.subtype || 'apartment').toLowerCase().replace(/ /g, '_');
  const subtype    = SUBTYPE_NORM[rawSubtype] || rawSubtype;
  const areaSqft   = parseFloat(input.areaSqft || input.area) || 1000;
  const floorNum   = parseInt(input.floorNumber || input.floor) || 1;
  const ageBand    = deriveAgeBandFromYear(input, input.ageBand || AGE_NORM[input.age] || 'ten_to_twenty');
  const occupancy  = input.occupancy  ? (OCC_NORM[input.occupancy]   || input.occupancy)  : 'self_occupied';
  const rawLegal   = input.legalStatus || (LEGAL_NORM[input.legal] || 'unregistered');
  const legalStatus= deriveLegalStatusFromForm(input, rawLegal);

  // Circle rate
  const crd          = input.circleRateData;
  const baseRatePsf  = crd?.ratePerSqft || input._circleRate
    || (CIRCLE_RATES[detectCity(address)] || CIRCLE_RATES.default)[propType] || 3500;
  const zone           = crd?.zone       || detectCity(address);
  const zoneConfidence = crd?.confidence || 'low';

  // Infra
  const infraData     = input.precomputedInfra || {};
  const infraScore    = infraData.infraScore ?? input._infraScore ?? 65;
  const localityGrade = infraData.localityGrade || 'Developing';

  // Adjustments
  const typeMultiplier = PROPERTY_TYPE_MULTIPLIER[subtype] || 1.0;
  const ageAdj         = AGE_ADJUSTMENT[ageBand] || 0.95;

  let floorAdj = 1.0;
  if (propType === 'residential' && subtype.includes('apartment')) {
    if      (floorNum === 0)           floorAdj = 0.92;
    else if (floorNum <= 3)            floorAdj = 0.97;
    else if (floorNum <= 8)            floorAdj = 1.00;
    else if (floorNum <= 15)           floorAdj = 1.03;
    else if (floorNum <= 25)           floorAdj = 1.06;
    else                               floorAdj = 1.04;
  }

  const occupancyAdj = OCCUPANCY_ADJUSTMENT_V2[occupancy]  || 1.00;
  const legalAdj     = LEGAL_ADJUSTMENT_V2[legalStatus]    || 0.88;
  const infraAdj     = 0.88 + (infraScore / 100 * 0.24);

  // ── New field adjustments ────────────────────────────────────────────
  const constructionAdj = CONSTRUCTION_ADJ[input.constructionType] || 1.00;

  // Facing affects residential/villa only
  const facingAdj = (propType === 'residential')
    ? (FACING_ADJ[input.facing] || 1.00)
    : 1.00;

  // Corner premium — commercial only
  const cornerAdj = (propType === 'commercial' && input.cornerProperty) ? 1.10 : 1.00;

  // OC / EC / Plan approval
  const ocAdj   = OC_ADJ[input.ocStatus]      || 0.97;
  const ecAdj   = EC_ADJ[input.ecStatus]      || 0.95;
  const planAdj = PLAN_ADJ[input.planApproval] || 0.92;

  // Amenities bonus (2% per amenity, max 10%)
  const amenityCount = (input.amenities || []).length;
  const amenityAdj   = 1.00 + Math.min(0.10, amenityCount * 0.02);

  // Carpet-to-built-up ratio efficiency
  const carpetArea  = parseFloat(input.carpetArea) || 0;
  const carpetRatio = (carpetArea > 0 && areaSqft > 0) ? carpetArea / areaSqft : null;
  const carpetAdj   = carpetRatio
    ? (carpetRatio < 0.65 ? 0.95 : carpetRatio >= 0.80 ? 1.02 : 1.00)
    : 1.00;

  // Floor position relative to total floors (sweet-spot mid-floors)
  const totalFloors = parseInt(input.totalFloors) || 0;
  let totalFloorAdj = 1.00;
  if (totalFloors > 0 && floorNum > 0) {
    const ratio = floorNum / totalFloors;
    if (ratio <= 0.10)                       totalFloorAdj = 0.95; // ground-level
    else if (ratio >= 0.85)                  totalFloorAdj = 0.97; // top floor
    else if (ratio >= 0.35 && ratio <= 0.75) totalFloorAdj = 1.02; // sweet spot
  }

  // Phase 14 adjustments
  const khataAdj     = KHATA_ADJ[input.khataType]           || 1.00;
  const bhkAdj       = BHK_FACTOR[input.bhkConfig]          || 1.00;
  const conditionAdj = CONDITION_ADJ[input.propertyCondition] || 1.00;
  const roadWidthAdj = (propType === 'commercial')
    ? (ROAD_WIDTH_ADJ[input.roadWidth] || 1.00)
    : 1.00;
  const litigationAdj = LITIGATION_ADJ[input.litigation]    || 1.00;

  // Combined new-field multiplier
  const enhancedAdj = constructionAdj * facingAdj * cornerAdj * ocAdj * ecAdj * planAdj * amenityAdj * carpetAdj * totalFloorAdj * khataAdj * bhkAdj * conditionAdj * roadWidthAdj * litigationAdj;

  // Market dynamics multiplier — real supply/demand/competition signal from Overpass
  const md              = input.marketDynamics || {};
  const marketDynAdj    = 1 + (md.liquidityPremium || 0);

  // Market value
  const marketValueMid = baseRatePsf * areaSqft * typeMultiplier * ageAdj * floorAdj * occupancyAdj * legalAdj * infraAdj * enhancedAdj * marketDynAdj;
  const rangeWidth     = zoneConfidence === 'high' ? 0.08 : zoneConfidence === 'medium' ? 0.12 : 0.18;
  const mv_low  = Math.round(marketValueMid * (1 - rangeWidth) / 10000) * 10000;
  const mv_high = Math.round(marketValueMid * (1 + rangeWidth) / 10000) * 10000;
  const mv_mid  = Math.round(marketValueMid / 10000) * 10000;

  // Distress value
  const distressDiscount = DISTRESS_DISCOUNT[subtype] || 0.70;
  const dv_mid  = marketValueMid * distressDiscount;
  const dv_low  = Math.round(dv_mid * 0.94 / 10000) * 10000;
  const dv_high = Math.round(dv_mid * 1.06 / 10000) * 10000;

  // RPI
  let rpi = 50;
  rpi += Math.min(25, infraScore * 0.25);
  rpi += zoneConfidence === 'high' ? 15 : zoneConfidence === 'medium' ? 8 : 0;
  rpi += { self_occupied: 10, rented_with_agreement: 6, vacant: 4 }[occupancy] || 0;
  rpi += (legalStatus === 'clear_title' ? 10 : legalStatus === 'registered_agreement' ? 5 : -5);
  const agePenalty = { under_2_years: 0, two_to_five: 2, five_to_ten: 5, ten_to_twenty: 10, twenty_to_thirty: 18, above_thirty: 25 }[ageBand] || 0;
  rpi -= agePenalty;

  // Market dynamics signal from Overpass data
  if (!md.fallback) {
    rpi += md.demandSignal   === 'strong' ? 8 : md.demandSignal   === 'weak'   ? -8 : 0;
    rpi += md.supplyPressure === 'low'    ? 4 : md.supplyPressure === 'high'   ? -6 : 0;
    if (md.competitionIndex > 70) rpi -= 3;
  }

  // Rental yield signal — high yield = strong investor demand = better liquidity
  const monthlyRent = parseFloat(input.rentalIncome || input.monthlyRent || 0);
  let rentalYield = 0;
  if (monthlyRent > 0 && marketValueMid > 0) {
    rentalYield = (monthlyRent * 12) / marketValueMid;
    rpi += rentalYield > 0.04 ? 5 : rentalYield > 0.025 ? 2 : 1;
  }

  rpi  = Math.round(Math.max(10, Math.min(95, rpi)));

  // TTL
  let ttl_low, ttl_high;
  if      (rpi > 75) { ttl_low = 45;  ttl_high = 90; }
  else if (rpi > 60) { ttl_low = 75;  ttl_high = 150; }
  else if (rpi > 45) { ttl_low = 120; ttl_high = 240; }
  else if (rpi > 30) { ttl_low = 180; ttl_high = 365; }
  else               { ttl_low = 270; ttl_high = 540; }

  // LTV band
  let ltvNum = 65;
  if (legalAdj === 1.00)            ltvNum += 5;
  if (legalAdj < 0.85)              ltvNum -= 15;
  if (rpi > 70)                     ltvNum += 5;
  if (rpi < 45)                     ltvNum -= 10;
  if (zoneConfidence === 'medium')  ltvNum -= 5;
  if (zoneConfidence === 'low')     ltvNum -= 10;
  if (input.existingLoan === 'yes') ltvNum -= 10; // existing mortgage reduces net LTV
  if (ocAdj < 0.97)                 ltvNum -= 5;  // no OC = legal risk
  if (ecAdj < 0.95)                 ltvNum -= 8;  // charges on EC = encumbered
  if (planAdj < 0.95)               ltvNum -= 5;  // unapproved plan risk
  if (khataAdj < 1.00)              ltvNum -= Math.round((1 - khataAdj) * 30); // khata penalty
  if (conditionAdj < 1.00)          ltvNum -= Math.round((1 - conditionAdj) * 15);
  if (litigationAdj < 1.00)         ltvNum -= Math.round((1 - litigationAdj) * 40);
  ltvNum = Math.max(15, Math.min(75, ltvNum));
  const ltvBand = `${ltvNum - 5}–${ltvNum}%`;

  // Legacy compat fields (for ResultsScreen pre-Phase-5)
  const locationTier  = detectLocationTier(address);
  const legacyAge     = AGE_NORM_BACK[ageBand]    || 'mid';
  const legacyLegal   = LEGAL_NORM_BACK[legalStatus] || 'unknown';
  const legacyOcc     = OCC_NORM_BACK[occupancy]   || 'self';
  const legacyInputs  = { age: legacyAge, legal: legacyLegal, occupancy: legacyOcc, subtype: rawSubtype, type: propType, rpi };
  const flags         = generateFlags(legacyInputs, 0.7, rpi, locationTier);
  const drivers = [
    { label: 'Location zone',            impact: zoneConfidence === 'high' ? +15 : zoneConfidence === 'medium' ? +8 : -5, dir: zoneConfidence === 'low' ? -1 : 1 },
    { label: `${rawSubtype.charAt(0).toUpperCase() + rawSubtype.slice(1).replace(/_/g, ' ')} type`, impact: typeMultiplier > 1.1 ? +11 : typeMultiplier < 0.9 ? -9 : +5, dir: typeMultiplier < 0.9 ? -1 : 1 },
    { label: 'Infrastructure access',    impact: Math.round((infraAdj - 1) * 100), dir: infraAdj >= 1 ? 1 : -1 },
    { label: `Occupancy (${legacyOcc})`, impact: occupancyAdj >= 1 ? +4 : -8, dir: occupancyAdj >= 1 ? 1 : -1 },
    { label: `Asset age (${legacyAge})`, impact: ageAdj > 1 ? +7 : ageAdj < 0.9 ? -14 : 0, dir: ageAdj >= 1 ? 1 : -1 },
    { label: 'Legal & title',            impact: legalAdj === 1 ? +5 : legalAdj < 0.85 ? -15 : -5, dir: legalAdj === 1 ? 1 : -1 },
    // New field drivers
    ...(constructionAdj !== 1.00 ? [{ label: `Construction (${input.constructionType?.replace(/_/g, ' ') || ''})`, impact: Math.round((constructionAdj - 1) * 100), dir: constructionAdj >= 1 ? 1 : -1 }] : []),
    ...(facingAdj !== 1.00       ? [{ label: `Facing (${input.facing?.replace(/_/g, '-') || ''})`, impact: Math.round((facingAdj - 1) * 100), dir: facingAdj >= 1 ? 1 : -1 }] : []),
    ...(ocAdj !== 0.97           ? [{ label: 'Occupancy certificate', impact: Math.round((ocAdj - 1) * 100), dir: ocAdj >= 1 ? 1 : -1 }] : []),
    ...(ecAdj !== 0.95           ? [{ label: 'Encumbrance certificate', impact: Math.round((ecAdj - 1) * 100), dir: ecAdj >= 1 ? 1 : -1 }] : []),
    ...(planAdj !== 0.92         ? [{ label: 'Building plan approval', impact: Math.round((planAdj - 1) * 100), dir: planAdj >= 1 ? 1 : -1 }] : []),
    ...(amenityCount > 0         ? [{ label: `Amenities (${amenityCount})`, impact: Math.round((amenityAdj - 1) * 100), dir: 1 }] : []),
    ...(cornerAdj > 1            ? [{ label: 'Corner property premium', impact: +10, dir: 1 }] : []),
    ...(khataAdj !== 1.00        ? [{ label: `Khata type (${input.khataType?.replace(/_/g,' ') || ''})`, impact: Math.round((khataAdj - 1) * 100), dir: khataAdj >= 1 ? 1 : -1 }] : []),
    ...(bhkAdj !== 1.00          ? [{ label: `BHK config (${input.bhkConfig || ''})`, impact: Math.round((bhkAdj - 1) * 100), dir: bhkAdj >= 1 ? 1 : -1 }] : []),
    ...(conditionAdj !== 1.00    ? [{ label: `Property condition (${input.propertyCondition || ''})`, impact: Math.round((conditionAdj - 1) * 100), dir: conditionAdj >= 1 ? 1 : -1 }] : []),
    ...(roadWidthAdj !== 1.00    ? [{ label: `Road width (${input.roadWidth?.replace(/_/g,' ') || ''})`, impact: Math.round((roadWidthAdj - 1) * 100), dir: roadWidthAdj >= 1 ? 1 : -1 }] : []),
    ...(litigationAdj !== 1.00   ? [{ label: `Litigation (${input.litigation || ''})`, impact: Math.round((litigationAdj - 1) * 100), dir: litigationAdj >= 1 ? 1 : -1 }] : []),
    ...(md.demandSignal && !md.fallback ? [{ label: `Market demand (${md.demandSignal})`, impact: md.demandSignal === 'strong' ? +8 : md.demandSignal === 'weak' ? -8 : 0, dir: md.demandSignal === 'weak' ? -1 : 1 }] : []),
    ...(rentalYield > 0 ? [{ label: `Rental yield (${(rentalYield * 100).toFixed(1)}%)`, impact: rentalYield > 0.04 ? +5 : rentalYield > 0.025 ? +2 : +1, dir: 1 }] : []),
  ];
  const narrative     = buildNarrative(legacyInputs, locationTier, rpi, '');
  const peers         = generatePeers({ type: propType, subtype: rawSubtype, area: areaSqft, address }, mv_low, mv_high, rpi, locationTier);
  const valuationId   = `COL-${Date.now()}`;

  const result = {
    address, lat, lng,
    propertyType: propType, subtype: rawSubtype,
    areaSqft, area: areaSqft, floorNumber: floorNum,
    ageBand, occupancy, legalStatus,
    circleRatePerSqft: Math.round(baseRatePsf), baseRatePsf: Math.round(baseRatePsf),
    zone, zoneConfidence,
    infraScore, localityGrade,
    mv_low, mv_high, mv_mid,
    dv_low, dv_high,
    rpi, ttl_low, ttl_high,
    ltvBand, ltv_band: ltvBand,
    rentalYield: rentalYield > 0 ? parseFloat((rentalYield * 100).toFixed(2)) : null,
    marketDynamics: md.fallback ? null : md,
    allAdjustments: { typeMultiplier, ageAdj, floorAdj, occupancyAdj, legalAdj, infraAdj },
    flags, drivers,
    infra: { score: infraScore, competition: localityGrade },
    narrative, peers,
    valuationId, modelVersion: 'v3.0',
    timestamp: new Date().toISOString(),
    inputs: input,
  };

  try { sessionStorage.setItem(valuationId, JSON.stringify(result)); } catch {}
  return result;
}

export function applyStress(results, sensitivity) {
  const { legal = 0, occupancy = 0, demand = 0 } = sensitivity;
  const legalF    = 1.0 - legal    * 0.12;
  const occupancyF= 1.0 - occupancy* 0.11;
  const demandF   = 1.0 - demand   * 0.14;
  const sf        = legalF * occupancyF * demandF;
  const round     = (v) => Math.round(v / 100000) * 100000;

  const mv_low  = round(results.mv_low  * sf);
  const mv_high = round(results.mv_high * sf);
  const dv_low  = round(results.dv_low  * sf);
  const dv_high = round(results.dv_high * sf);
  const rpi       = Math.max(20, Math.round(results.rpi - legal * 13 - demand * 10));
  const confidence= Math.max(0.28, parseFloat((results.confidence - legal * 0.08 - demand * 0.06).toFixed(2)));
  const ttl_low   = Math.round(results.ttl_low  * (1 + demand * 0.40 + occupancy * 0.30));
  const ttl_high  = Math.round(results.ttl_high * (1 + demand * 0.40 + occupancy * 0.30));

  const hasCritical = (results.fraudFlags || []).some(f => f.severity === 'critical')
                   || (results.flags      || []).some(f => f.severity === 'high');

  let verdictLabel, verdictCode, verdictColor, ltvBand;
  if (confidence >= 0.75 && rpi >= 65 && !hasCritical) {
    verdictLabel = 'Sanction Recommended';              verdictCode = 'SANCTION_RECOMMENDED'; verdictColor = '#1A7F5A'; ltvBand = results.ltvBand || '60–70%';
  } else if (confidence >= 0.55 && rpi >= 45 && !hasCritical) {
    verdictLabel = 'Conditional Review';                verdictCode = 'CONDITIONAL_REVIEW';   verdictColor = '#C07A1A'; ltvBand = '45–55%';
  } else {
    verdictLabel = 'High Risk — Senior Review Required'; verdictCode = 'HIGH_RISK';            verdictColor = '#C0392B'; ltvBand = 'Below 40% or decline';
  }

  const confidenceScore = Math.round(confidence * 100);
  const confidenceTier  = confidence >= 0.75 ? 'high' : confidence >= 0.55 ? 'medium' : 'low';

  return {
    ...results,
    mv_low, mv_high, dv_low, dv_high,
    rpi, confidence, confidenceScore, confidenceTier,
    ttl_low, ttl_high,
    verdict: verdictLabel, verdictLabel, verdictCode, verdictColor,
    ltv_band: ltvBand, ltvBand,
  };
}
