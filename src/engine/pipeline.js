/* ── COLLATIQ PIPELINE ───────────────────────────────────────────────────────
   Orchestrates all four engines in sequence and returns a single merged result.
*/

import { fetchInfrastructureSignals, fetchMarketDynamics, fetchComparableProperties, getCircleRateForLocation, circleRateFromKeyword } from './geoEngine';
import { runValuation }               from './valuationEngine';
import { computeConfidence }          from './confidenceEngine';
import { runFraudChecks }             from './fraudEngine';
import { makeDecision }               from './decisionEngine';
import { analyzePropertyImage, analyzeDocument } from './imageEngine';

export async function runCollatiqPipeline(formInput) {
  try {
    const input = { ...formInput };

    // Step 1a — resolve circle rate from coordinates (geo-based Haversine lookup)
    if (input.lat && input.lng && !input.circleRateData) {
      try {
        input.circleRateData = getCircleRateForLocation(input.lat, input.lng);
      } catch {
        // Fall through to keyword fallback below
      }
    }

    // Step 1b — keyword-based circle rate fallback if geo lookup missed or wasn't available
    if (!input.circleRateData && input.address) {
      const propType = (input.propertyType || input.type || 'residential').toLowerCase();
      const kwRate = circleRateFromKeyword(input.address, propType);
      if (kwRate && kwRate !== 4200) {
        // Keyword matched a known locality — build a circleRateData object
        const addr = (input.address || '').toLowerCase();
        const KEYWORD_ZONES = {
          indiranagar: 'Indiranagar', koramangala: 'Koramangala', whitefield: 'Whitefield',
          'hsr layout': 'HSR Layout', jayanagar: 'Jayanagar', 'jp nagar': 'JP Nagar',
          marathahalli: 'Marathahalli', hebbal: 'Hebbal', yelahanka: 'Yelahanka',
          'electronic city': 'Electronic City', bannerghatta: 'Bannerghatta Road',
          malleswaram: 'Malleshwaram', rajajinagar: 'Rajajinagar',
        };
        let zoneName = 'Bengaluru';
        for (const [kw, name] of Object.entries(KEYWORD_ZONES)) {
          if (addr.includes(kw)) { zoneName = name; break; }
        }
        input.circleRateData = {
          ratePerSqft: kwRate,
          zone: zoneName,
          confidence: 'high',
          fallback: false,
        };
      }
    }

    // Step 1c — fetch infra signals if coords present and not pre-computed
    if (input.lat && input.lng && !input.precomputedInfra) {
      try {
        input.precomputedInfra = await fetchInfrastructureSignals(input.lat, input.lng);
      } catch {
        input.precomputedInfra = {
          infraScore: 60, amenityDensity: 5, hospitalCount: 1, schoolCount: 1,
          transitCount: 1, bankCount: 1, retailCount: 1, roadDensity: 0.5,
          localityGrade: 'Developing', fallback: true,
        };
      }
    }

    // Step 1d — fetch market dynamics (supply/demand/competition) if coords present
    if (input.lat && input.lng && !input.marketDynamics) {
      try {
        input.marketDynamics = await fetchMarketDynamics(input.lat, input.lng);
      } catch {
        input.marketDynamics = {
          supplyPressure: 'medium', demandSignal: 'moderate', competitionIndex: 50,
          rentalYieldEst: 3.0, liquidityPremium: 0, fallback: true,
        };
      }
    }

    // Step 1f — fetch real comparable properties from Overpass building geometry
    if (input.lat && input.lng && !input.overpassComparables) {
      try {
        const propType    = (input.propertyType || input.type || 'residential').toLowerCase();
        const circleRate  = input.circleRateData?.ratePerSqft || 5000;
        input.overpassComparables = await fetchComparableProperties(
          input.lat, input.lng, propType, circleRate
        );
      } catch {
        input.overpassComparables = [];
      }
    }

    // Step 1e — auto image analysis via Claude Vision (if photos uploaded and not already done)
    if (!input.imageAnalysis && Array.isArray(input.images) && input.images.length > 0) {
      const firstImage = input.images[0];
      if (firstImage instanceof File || firstImage instanceof Blob) {
        try {
          const imgResult = await analyzePropertyImage(firstImage);
          if (imgResult && typeof imgResult.confidenceAdjustment === 'number') {
            input.imageAnalysis = imgResult;
          }
        } catch {
          // Image analysis is best-effort — never block the pipeline
        }
      }
    }

    // Step 1g — document OCR via Claude Vision (runs in parallel for all uploaded docs)
    if (!input.documentAnalysis && input.documents && typeof input.documents === 'object') {
      const DOC_TYPES = ['titleDeed', 'ec', 'taxReceipt', 'buildingPlan', 'khata'];
      const analysisJobs = DOC_TYPES
        .filter(dt => Array.isArray(input.documents[dt]) && input.documents[dt].length > 0)
        .filter(dt => (input.documents[dt][0] instanceof File || input.documents[dt][0] instanceof Blob))
        .map(dt => analyzeDocument(input.documents[dt][0], dt)
          .then(result => ({ dt, result }))
          .catch(() => ({ dt, result: null }))
        );

      if (analysisJobs.length > 0) {
        try {
          const results = await Promise.all(analysisJobs);
          const docAnalysis = {};
          for (const { dt, result } of results) {
            if (result && result.extracted) docAnalysis[dt] = result.extracted;
          }
          if (Object.keys(docAnalysis).length > 0) {
            input.documentAnalysis = docAnalysis;
          }
        } catch {
          // Document analysis is best-effort
        }
      }
    }

    // Step 2 — valuation
    const valuationResult = runValuation(input);

    // Step 3 — confidence
    const confidenceResult = computeConfidence(input, valuationResult);

    // Apply image analysis adjustment if provided
    if (input.imageAnalysis?.confidenceAdjustment) {
      const adj = input.imageAnalysis.confidenceAdjustment;
      confidenceResult.confidenceScore = Math.min(99, Math.max(10,
        confidenceResult.confidenceScore + Math.round(adj * 100)
      ));
      confidenceResult.confidenceDrivers = confidenceResult.confidenceDrivers || [];
      if (adj > 0) {
        confidenceResult.confidenceDrivers.push({
          factor: 'Property Photo',
          impact: 'positive',
          reason: input.imageAnalysis.summary || 'Positive visual signals from property image',
        });
      } else if (adj < 0) {
        confidenceResult.confidenceDrivers.push({
          factor: 'Property Photo',
          impact: 'negative',
          reason: input.imageAnalysis.summary || 'Negative visual signals from property image',
        });
      }
    }

    valuationResult.confidence     = confidenceResult.confidenceScore / 100; // 0-1 for arc display
    valuationResult.confidenceScore= confidenceResult.confidenceScore;        // 0-100 for UI
    valuationResult.confidenceTier = confidenceResult.confidenceTier;

    // Step 4 — fraud
    const fraudResult = runFraudChecks(input, valuationResult);

    // Step 5 — decision
    const decisionResult = makeDecision(valuationResult, confidenceResult, fraudResult);

    // Step 6 — compute Collateral Health Score (CIBIL-equivalent 50–820)
    const legalRaw = {
      clear_title: 100, clear: 100, registered_agreement: 82,
      unregistered: 60, inherited_undivided: 50, government_lease: 45,
      complex: 55, encumbered: 25, disputed: 10, unknown: 50,
    }[input.legalStatus || input.legal || ''] ?? 55;

    const fraudRaw = {
      clean: 100, low: 80, medium: 45, high: 10,
    }[fraudResult.fraudRiskLevel || 'clean'] ?? 80;

    const zoneConf = input.circleRateData?.confidence || 'medium';
    const hs_mv_low  = valuationResult.mv_low  || 0;
    const hs_mv_high = valuationResult.mv_high || 0;
    const hs_mv_mid  = (hs_mv_low + hs_mv_high) / 2;
    const rangeWidth = hs_mv_mid > 0 ? (hs_mv_high - hs_mv_low) / hs_mv_mid : 0.25;
    const valQualRaw = zoneConf === 'high' && rangeWidth < 0.15 ? 100
                     : zoneConf === 'high'   ? 82
                     : zoneConf === 'medium' ? 65 : 40;

    const baseHealth  =
      valQualRaw * 0.30 +
      (valuationResult.rpi || 50) * 0.25 +
      legalRaw   * 0.25 +
      fraudRaw   * 0.20;
    const collateralHealthScore = Math.max(50, Math.min(820, Math.round(baseHealth * 8.5)));
    const collateralHealthBand  =
      collateralHealthScore >= 750 ? 'Excellent — Strong collateral candidate.'       :
      collateralHealthScore >= 650 ? 'Good — Acceptable for standard LAP products.'   :
      collateralHealthScore >= 550 ? 'Fair — Proceed with additional verification.'   :
      collateralHealthScore >= 450 ? 'Weak — Senior review required.'                 :
                                     'Poor — High risk collateral.';

    // Step 7 — merge everything into one object
    const merged = {
      ...valuationResult,

      // Confidence
      confidence:        confidenceResult.confidenceScore / 100,
      confidenceScore:   confidenceResult.confidenceScore,
      confidenceLabel:   confidenceResult.confidenceLabel,
      confidenceTier:    confidenceResult.confidenceTier,
      confidenceDrivers: confidenceResult.confidenceDrivers,

      // Fraud
      fraudRiskLevel:    fraudResult.fraudRiskLevel,
      fraudFlags:        fraudResult.fraudFlags,
      overallFraudScore: fraudResult.overallFraudScore,

      // Decision
      verdict:           decisionResult.verdictLabel,   // human-readable for ResultsScreen
      verdictCode:       decisionResult.verdict,        // enum for Phase 5
      verdictLabel:      decisionResult.verdictLabel,
      verdictColor:      decisionResult.verdictColor,
      ltvBand:           decisionResult.ltvBand,
      ltv_band:          decisionResult.ltvBand,        // legacy compat
      recommendedAction: decisionResult.recommendedAction,
      decisionReasons:   decisionResult.decisionReasons,
      escalationFlags:   decisionResult.escalationFlags,
      decisionMemo:      decisionResult.decisionMemo,

      // Collateral Health Score
      collateralHealthScore,
      collateralHealthBand,

      // Document intelligence (Claude-extracted)
      documentAnalysis: input.documentAnalysis || null,
    };

    // Persist to sessionStorage under the valuationId
    try { sessionStorage.setItem(merged.valuationId, JSON.stringify(merged)); } catch {}

    return merged;
  } catch (err) {
    // Graceful fallback to legacy engine
    console.error('[pipeline] error, falling back:', err);
    const { computeValuation } = await import('./valuationEngine');
    return computeValuation(formInput);
  }
}
