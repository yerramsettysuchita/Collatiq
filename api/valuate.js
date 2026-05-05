/* Vercel serverless function — inline property valuation REST endpoint.
   POST /api/valuate  →  { address, areaSqft, propertyType, subtype, ageBand, occupancy, legalStatus, ... }
   Returns a clean JSON valuation response without importing from src/. */

// ── Circle rates (₹ per sqft) by city keyword ──────────────────────────────
const CIRCLE_RATES = {
  bengaluru: 4200, bangalore: 4200, mumbai: 8500, bombay: 8500,
  hyderabad: 3800, chennai: 4000, madras: 4000, pune: 4500,
  delhi: 6200, gurgaon: 6200, noida: 6200, ahmedabad: 4000,
  kolkata: 4500, calcutta: 4500, kochi: 5500, cochin: 5500,
  nagpur: 3500, indore: 3800, jaipur: 4000, lucknow: 3500,
  surat: 4200, vadodara: 3800, baroda: 3800, chandigarh: 5500,
  coimbatore: 3800, bhopal: 3500, visakhapatnam: 3800, vizag: 3800,
  default: 3500,
};

const LOCALITY_RATES = {
  koramangala: 8500, indiranagar: 9500, whitefield: 7200, 'hsr layout': 7800,
  'bandra': 22000, 'andheri': 14500, 'juhu': 20000, 'powai': 13000, 'worli': 25000,
  'banjara hills': 12000, 'jubilee hills': 13000, 'gachibowli': 8500, 'madhapur': 9200,
  'anna nagar': 9500, 't nagar': 12000, 'adyar': 10500, 'nungambakkam': 13000,
  'koregaon park': 12000, 'viman nagar': 8800, 'kothrud': 9500,
  'defence colony': 18000, 'vasant vihar': 16000, 'greater kailash': 15000,
  'navrangpura': 9500, 'satellite': 9000, 'alipore': 18000, 'ballygunge': 14000,
  'marine drive kochi': 12000, 'palarivattom': 9500, 'sitabuldi': 9000,
  'c-scheme': 12000, 'malviya nagar': 7500, 'hazratganj': 12000, 'gomti nagar': 6500,
  'athwa lines': 9000, 'alkapuri': 8000, 'sector 17': 14000, 'race course': 8000,
  'arera colony': 7000, 'mvp colony': 8000, 'dwaraka nagar': 7500,
};

// ── Adjustment tables ───────────────────────────────────────────────────────
const TYPE_MULTIPLIER = {
  apartment: 1.0, villa: 1.18, plot: 0.88,
  office_space: 1.15, retail_shop: 1.22, warehouse: 0.78,
  residential: 1.0, commercial: 1.1,
};

const AGE_ADJ = {
  under_2_years: 1.05, two_to_five: 1.02, five_to_ten: 0.97,
  ten_to_twenty: 0.91, twenty_to_thirty: 0.84, above_thirty: 0.76,
};

const OCC_ADJ = {
  self_occupied: 1.00, rented_with_agreement: 0.94, vacant: 0.96,
};

const LEGAL_ADJ = {
  clear_title: 1.00, registered_agreement: 0.97,
  unregistered: 0.88, disputed: 0.72, encumbered: 0.70,
};

const AGE_RPI_PENALTY = {
  under_2_years: 0, two_to_five: 2, five_to_ten: 5,
  ten_to_twenty: 10, twenty_to_thirty: 18, above_thirty: 25,
};

// ── Rate lookup ─────────────────────────────────────────────────────────────
function lookupRate(address) {
  if (!address) return { rate: CIRCLE_RATES.default, zone: 'unknown', zoneConfidence: 'low' };
  const addr = address.toLowerCase();

  // Check locality rates first (higher specificity)
  for (const [key, rate] of Object.entries(LOCALITY_RATES)) {
    if (addr.includes(key)) {
      return { rate, zone: key, zoneConfidence: 'high' };
    }
  }

  // Then city rates
  for (const [key, rate] of Object.entries(CIRCLE_RATES)) {
    if (key !== 'default' && addr.includes(key)) {
      return { rate, zone: key, zoneConfidence: 'medium' };
    }
  }

  return { rate: CIRCLE_RATES.default, zone: 'unknown', zoneConfidence: 'low' };
}

// ── CORS headers ────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    // Validation
    if (!body.address || typeof body.address !== 'string' || body.address.trim().length < 3) {
      return res.status(400).json({ error: 'Validation failed', message: 'address is required (min 3 characters)' });
    }
    const areaSqft = parseFloat(body.areaSqft);
    if (!areaSqft || areaSqft <= 0 || areaSqft > 1000000) {
      return res.status(400).json({ error: 'Validation failed', message: 'areaSqft must be a positive number' });
    }

    // Inputs with defaults
    const address     = body.address.trim();
    const propType    = (body.propertyType || 'residential').toLowerCase();
    const subtype     = (body.subtype      || 'apartment').toLowerCase();
    const ageBand     = body.ageBand     || 'five_to_ten';
    const occupancy   = body.occupancy   || 'self_occupied';
    const legalStatus = body.legalStatus || 'clear_title';

    // Rate lookup
    const { rate: baseRate, zone, zoneConfidence } = lookupRate(address);

    // Multipliers
    const typeMultiplier = TYPE_MULTIPLIER[subtype] || TYPE_MULTIPLIER[propType] || 1.0;
    const ageAdj         = AGE_ADJ[ageBand]         || 1.0;
    const occAdj         = OCC_ADJ[occupancy]        || 1.0;
    const legalAdj       = LEGAL_ADJ[legalStatus]    || 1.0;

    // Market value
    const mvMid  = baseRate * areaSqft * typeMultiplier * ageAdj * occAdj * legalAdj;
    const range  = zoneConfidence === 'high' ? 0.08 : zoneConfidence === 'medium' ? 0.12 : 0.18;
    const mv_low  = Math.round(mvMid * (1 - range) / 10000) * 10000;
    const mv_high = Math.round(mvMid * (1 + range) / 10000) * 10000;

    // Distress value
    const distressDiscount = subtype === 'plot' ? 0.65 : subtype === 'warehouse' ? 0.60 : 0.70;
    const dvMid  = mvMid * distressDiscount;
    const dv_low  = Math.round(dvMid * 0.94 / 10000) * 10000;
    const dv_high = Math.round(dvMid * 1.06 / 10000) * 10000;

    // RPI
    let rpi = 50;
    rpi += zoneConfidence === 'high' ? 15 : zoneConfidence === 'medium' ? 8 : 0;
    rpi += { self_occupied: 10, rented_with_agreement: 6, vacant: 4 }[occupancy] || 0;
    rpi += legalStatus === 'clear_title' ? 10 : legalStatus === 'registered_agreement' ? 5 : -5;
    rpi -= AGE_RPI_PENALTY[ageBand] || 0;
    rpi  = Math.round(Math.max(10, Math.min(95, rpi)));

    // TTL bands
    let ttl_low, ttl_high;
    if      (rpi > 75) { ttl_low = 45;  ttl_high = 90; }
    else if (rpi > 60) { ttl_low = 75;  ttl_high = 150; }
    else if (rpi > 45) { ttl_low = 120; ttl_high = 240; }
    else if (rpi > 30) { ttl_low = 180; ttl_high = 365; }
    else               { ttl_low = 270; ttl_high = 540; }

    // LTV band
    let ltvNum = 65;
    if (legalAdj === 1.00) ltvNum += 5;
    if (legalAdj < 0.85)   ltvNum -= 15;
    if (rpi > 70)          ltvNum += 5;
    if (rpi < 45)          ltvNum -= 10;
    if (zoneConfidence === 'medium') ltvNum -= 5;
    if (zoneConfidence === 'low')    ltvNum -= 10;
    ltvNum = Math.max(15, Math.min(75, ltvNum));
    const ltvBand = `${ltvNum - 5}–${ltvNum}%`;

    // Confidence score
    let conf = 0.60;
    if (zoneConfidence === 'high')   conf += 0.15;
    if (zoneConfidence === 'medium') conf += 0.07;
    if (legalAdj === 1.00)           conf += 0.08;
    if (legalAdj < 0.80)             conf -= 0.12;
    conf = Math.max(0.25, Math.min(0.98, parseFloat(conf.toFixed(2))));
    const confidenceScore = Math.round(conf * 100);

    // Verdict
    let verdict, verdictLabel;
    if (rpi > 65 && legalAdj === 1.00) {
      verdict      = 'SANCTION_RECOMMENDED';
      verdictLabel = 'Sanction Recommended';
    } else if (rpi > 45) {
      verdict      = 'CONDITIONAL_REVIEW';
      verdictLabel = 'Conditional Review';
    } else {
      verdict      = 'HIGH_RISK';
      verdictLabel = 'High Risk — Senior Review Required';
    }

    const valuationId = `COL-API-${Date.now()}`;

    return res.status(200).json({
      valuationId,
      timestamp:       new Date().toISOString(),
      address,
      areaSqft,
      propertyType:    propType,
      subtype,
      zone,
      mv_low,
      mv_high,
      dv_low,
      dv_high,
      rpi,
      ttl_low,
      ttl_high,
      ltvBand,
      verdict,
      verdictLabel,
      confidenceScore,
      modelVersion:    'v3.0-api',
    });

  } catch (err) {
    console.error('[valuate] unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
