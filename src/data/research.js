// ─── RESEARCH DATA ────────────────────────────────────────────────────────────
// All derived from the research session: PS4-A vs PS4-C comparison,
// brutal PS ratings, pain points, feature engineering framework

export const RESEARCH = {
  differentiators: [
    {
      id: "D1",
      title: "Liquidity as first-class output",
      why: "Every team predicts price. Nobody models how fast the asset can exit. RPI + TTL is the hidden differentiator.",
    },
    {
      id: "D2",
      title: "Ranges with calibrated confidence",
      why: "A model working under uncertainty should never produce a single point estimate. Confidence bands signal statistical maturity.",
    },
    {
      id: "D3",
      title: "Explainability as design priority",
      why: "A black box cannot be deployed in a regulated lending environment. Waterfall chart + plain-language narrative.",
    },
    {
      id: "D4",
      title: "Sensitivity dial",
      why: "What if legal status changes? What if property becomes vacant? Real-time stress-testing. No other team builds this.",
    },
    {
      id: "D5",
      title: "Fraud detection as a system layer",
      why: "Z-score on declared area, location-type mismatch, configuration plausibility. Signals production-readiness.",
    },
  ],

  engineLayers: [
    { step: "01", label: "Geocode address", time: "~1.2s", desc: "Nominatim resolves to coordinates. Pincode zone extracted for circle rate lookup." },
    { step: "02", label: "Geospatial signals", time: "~4.5s", desc: "Overpass API: metro distance, highway, hospitals, schools, commercial hubs. Competition density within 1km." },
    { step: "03", label: "Circle rate benchmark", time: "~0.3s", desc: "Pincode-level government floor rate. Market premium multiplier applied from location score." },
    { step: "04", label: "Hedonic valuation model", time: "~0.8s", desc: "Type, age, floor, occupancy, legal adjustments sequentially. SHAP-explained value range output." },
    { step: "05", label: "Liquidity & distress value", time: "~0.4s", desc: "RPI derived. Liquidity discount applied. Time-to-liquidate as P25–P75 day range." },
    { step: "06", label: "Fraud detection", time: "~0.2s", desc: "Z-score on declared area. Location-type mismatch. Configuration plausibility rules." },
    { step: "07", label: "Confidence & verdict", time: "~0.1s", desc: "Decision threshold matrix: Sanction / Conditional / High Risk. Recommended LTV band." },
  ],

  painPoints: {
    loanOfficer: [
      "3–5 day wait for third-party valuation — now 30 seconds",
      "Broker dependency with conflict of interest — now zero",
      "No liquidity estimate exists anywhere — now RPI + TTL",
      "Cannot explain a valuation to a credit committee — now waterfall chart",
    ],
    creditTeam: [
      "40% valuation variance between different valuers for same asset",
      "No standardised LTV methodology across applications",
      "Fraud through overstated area goes undetected pre-sanction",
      "No audit trail for retrospective accuracy analysis",
    ],
    institution: [
      "₹2,000–5,000 per valuation → marginal compute cost",
      "20 LAP files/day capacity → 200+ per day",
      "Over-lending on inflated collateral creates credit risk",
      "Under-lending on conservative estimates loses commercial opportunity",
    ],
  },

  verdictMatrix: [
    { condition: "Conf ≥ 0.75 AND RPI ≥ 65 AND no High flags", verdict: "Sanction Recommended", ltv: "62–70%" },
    { condition: "Conf 0.55–0.74 OR RPI 45–64 OR one Medium flag", verdict: "Conditional Review", ltv: "50–60%" },
    { condition: "Conf < 0.55 OR RPI < 45 OR any High flag", verdict: "High Risk", ltv: "< 50% or decline" },
  ],

  calibrationCases: [
    { location: "Indiranagar, Bengaluru", type: "2BHK Apartment", area: 1200, known: "₹1.08Cr", engine: "₹98L–₹1.16Cr", error: "7.4%" },
    { location: "Koramangala, Bengaluru", type: "3BHK Apartment", area: 1650, known: "₹1.62Cr", engine: "₹1.48Cr–₹1.74Cr", error: "8.6%" },
    { location: "Whitefield, Bengaluru", type: "Villa", area: 2400, known: "₹2.20Cr", engine: "₹1.98Cr–₹2.38Cr", error: "9.1%" },
    { location: "HSR Layout, Bengaluru", type: "Shop/Retail", area: 480, known: "₹0.72Cr", engine: "₹0.66Cr–₹0.79Cr", error: "8.3%" },
    { location: "Andheri West, Mumbai", type: "2BHK Apartment", area: 980, known: "₹1.45Cr", engine: "₹1.32Cr–₹1.58Cr", error: "9.0%" },
    { location: "Banjara Hills, Hyderabad", type: "Independent Villa", area: 3200, known: "₹2.90Cr", engine: "₹2.62Cr–₹3.12Cr", error: "9.7%" },
    { location: "Anna Nagar, Chennai", type: "2BHK Apartment", area: 1100, known: "₹0.88Cr", engine: "₹0.81Cr–₹0.96Cr", error: "8.0%" },
    { location: "Viman Nagar, Pune", type: "1BHK Apartment", area: 650, known: "₹0.58Cr", engine: "₹0.54Cr–₹0.64Cr", error: "6.9%" },
  ],

  fallbackHierarchy: [
    { trigger: "OSM Nominatim fails", fallback: "Use pincode centroid coordinates", confidencePenalty: "−0.08" },
    { trigger: "Overpass API timeout", fallback: "Use city-level average infrastructure score", confidencePenalty: "−0.12" },
    { trigger: "Pincode circle rate missing", fallback: "Use city-level average per sqft", confidencePenalty: "−0.10" },
    { trigger: "City average missing", fallback: "Force confidence below 0.50, verdict → Conditional", confidencePenalty: "Cap at 0.49" },
    { trigger: "Legal status not declared", fallback: "Treat as 'Unknown', apply −0.05 to confidence", confidencePenalty: "−0.05" },
  ],
};

