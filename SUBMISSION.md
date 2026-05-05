# Collatiq — TenzorX 2026 Submission

## Submission Details

| Field | Value |
|---|---|
| Team name | Collatiq |
| Problem statement | PS4-A — Collateral Valuation Intelligence |
| Live demo URL | https://collatiq.vercel.app |
| GitHub repository URL | https://github.com/YOUR_USERNAME/collatiq |
| Video demo URL | *(to be added)* |
| Submission date | 2026-05-03 |

## What We Built

Collatiq is a production-grade AI collateral intelligence platform that helps Indian NBFCs assess property-backed collateral in under 30 seconds. The system produces a Collateral Health Score on the CIBIL-equivalent 850 scale, a market value range with 12-factor hedonic model, a Resale Potential Index, time-to-liquidate estimate, confidence score with documented deductions, fraud and anomaly detection, and a credit committee decision memo. Every assessment is saved to a secure database with a full compliance audit trail.

## Technical Architecture

- **React 19** with Framer Motion and Three.js for the frontend — animated screen transitions, 3D property visualisations, live confidence arc
- **Supabase** for Google OAuth authentication and managed PostgreSQL database with Row Level Security
- **OpenStreetMap Nominatim and Overpass API** for real-time geospatial data — zero proprietary data dependencies
- **34-zone Bengaluru circle rate system** based on Karnataka SRO 2024 benchmarks, with Haversine micromarket matching
- **Four-engine pipeline:** Valuation Engine (12 adjustment factors), Confidence Engine (documented deductions), Fraud Engine (5 anomaly checks), Decision Engine (priority-ordered verdict matrix)
- **Anthropic Claude** (via OpenRouter) for property image analysis — construction quality, maintenance condition, red flags — proxied via Vercel serverless function so the API key never reaches the browser
- **Vercel** for deployment with automatic GitHub integration and serverless function hosting

## Key Differentiators

- **D1 — Liquidity as a First-Class Output:** Every report includes a Resale Potential Index (0–100) and a Time-to-Liquidate estimate (day range). No competing system models how fast the asset exits the bank's books in a stress scenario.
- **D2 — Ranges with Calibrated Confidence:** Output is a value range (not a single point) paired with a confidence score that reflects input completeness, legal clarity, location data quality, and variance width — statistical maturity, not false precision.
- **D3 — Explainability as a Design Priority:** Every report includes a SHAP-style waterfall chart showing exactly how each input factor moved the value, plus a plain-language narrative readable by a credit committee. A black box cannot be deployed in a regulated lending environment.
- **D4 — Real-Time Sensitivity Testing:** Three interactive sliders (Legal Status, Occupancy, Market Demand) recompute the full valuation and verdict live — answering "what is the worst case we're underwriting against?" No other competing system builds this.
- **D5 — Fraud Detection as a System Layer:** Z-score on declared built-up area, location–type mismatch detection, and configuration plausibility rules run automatically on every file and surface as risk flags before sanction.

## Production Readiness

- Real Google OAuth authentication with Supabase session management — no demo credentials, no mock auth
- Every valuation persisted to PostgreSQL with full audit trail including Collateral Health Score, expiry date, and complete result JSON
- Compliance JSON export for regulatory review — every output field documented and traceable to a specific model input
- Graceful degradation when external APIs are unavailable — confidence adjusts automatically and the report flags exactly what was estimated vs. observed

## Live Demo Instructions

1. Open the live demo at **https://collatiq.vercel.app**
2. Click **Continue with Google** and sign in with your Google account
3. On the landing page, type any Bengaluru property address in the quick estimate field and click **Get quick estimate** to see a partial result without the full assessment flow
4. After signing in, click **Assess a property** and follow the full assessment flow — the engine runs in 7 steps with real geocoding and infrastructure data
5. Use the preset address **14B, 3rd Cross, Indiranagar 12th Main, Bengaluru 560038** for a representative demo if needed — this is the Demo Mode pre-fill used for testing

---

*Built for Poonawalla Fincorp TenzorX 2026 — Collatiq 2026*
