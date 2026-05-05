# Collatiq System Architecture

## Overview

Collatiq is a browser-based collateral intelligence platform that combines real-time geospatial data from OpenStreetMap with a four-engine valuation pipeline to produce a complete collateral decision object in under 30 seconds. The system uses Supabase for authentication and data persistence and Vercel for deployment.

## Engine Pipeline

The four engines run in sequence on every assessment:

**Valuation Engine** — Applies 12 sequential adjustment factors to a government circle rate baseline to produce a market value range and distress sale range. Factors include location tier, property sub-type, building age, occupancy status, legal status, floor number, infrastructure score, and competition density. The output is a low/high market value band and a low/high distress sale band, both rounded to the nearest ₹1 lakh.

**Confidence Engine** — Scores input completeness, data quality, and signal agreement to produce a 0–100 confidence score with documented deductions. Deductions are applied for missing fields (area, floor, age), adverse legal status, high valuation variance, low RPI, and Overpass API fallback. Bonuses are applied for complete inputs and high RPI. The score drives the LTV band recommendation.

**Fraud Engine** — Runs 5 structured anomaly checks on every submission: area sanity (Z-score on declared built-up area vs. property type norms), value sanity (price-per-sqft vs. zone benchmark), location–type mismatch (e.g. industrial property in a premium residential zone), legal–occupancy conflict (vacant property with clear title in high-demand zone warrants scrutiny), and age–type conflict (new construction in a zone with no recent development activity). Each check produces a flag at High, Medium, or Low severity.

**Decision Engine** — Combines all three engine outputs using a priority-ordered verdict logic to produce one of four verdicts with documented reasons: Sanction Recommended (confidence ≥ 0.75, RPI ≥ 65, no High flags), Conditional Review (confidence 0.55–0.74 or RPI 45–64 or one Medium flag), High Risk (confidence < 0.55 or RPI < 45 or any High flag), or Insufficient Data. Each verdict carries a recommended LTV band and a plain-language rationale for the credit committee.

## Data Sources

| Source | Purpose | API |
|---|---|---|
| OSM Nominatim | Address geocoding — resolves property address to lat/lng coordinates | `https://nominatim.openstreetmap.org/search` |
| Overpass API | Infrastructure signals — hospitals, schools, transit, banks, retail within 1,200m radius | `https://overpass-api.de/api/interpreter` |
| Karnataka SRO benchmarks | Circle rate lookup — 34 Bengaluru micromarket zones with ₹/sqft rates | Local zone table (Karnataka Sub-Registrar Office 2024 rates) |
| Anthropic Claude (via OpenRouter) | Property image analysis — construction quality, maintenance condition, visible amenities, red flags | Proxied via Vercel serverless function at `/api/analyze-image` |

## Security

- **Authentication:** Google OAuth via Supabase Auth. No passwords stored. Session tokens managed by Supabase client SDK and stored in browser memory only.
- **Database access:** Row Level Security (RLS) enabled on all tables. Users can only read, insert, and delete their own rows. `auth.uid() = user_id` enforced at the database level.
- **API key security:** The Anthropic/OpenRouter API key is stored as a Vercel environment variable (`OPENROUTER_API_KEY`) and accessed only by the serverless function at `api/analyze-image.js`. It is never included in the browser bundle or exposed to the client.
- **Storage policy:** No sensitive data is stored in localStorage or sessionStorage beyond Supabase session tokens. Valuation results are stored in sessionStorage by opaque UUID for deep-link sharing and cleared on session end. The offline sync queue in localStorage stores only the valuation row object (no credentials or keys).

## Deployment

- **Frontend:** React 19 SPA deployed on Vercel. Automatic deployments trigger on every push to the `main` branch. SPA routing handled by `vercel.json` rewrite rule (`/(.*) → /`).
- **Database:** Supabase managed PostgreSQL. Hosts the `valuations` table with RLS, expiry tracking, and a Collateral Health Score column. Supabase Auth handles Google OAuth token exchange and session management.
- **Serverless function:** `api/analyze-image.js` deployed as a Vercel serverless function. Receives `{ imageBase64, mediaType }` from the browser, validates the payload, and proxies to the OpenRouter API with the server-side key. Returns the parsed JSON analysis to the client.

## Request Flow

```
Browser
  │
  ├─ GET / ──────────────────────────────────► Vercel CDN (static React bundle)
  │
  ├─ POST /api/analyze-image ────────────────► Vercel Serverless Function
  │                                               └─ POST https://openrouter.ai/api/v1/...
  │
  ├─ GET https://nominatim.openstreetmap.org ─► OSM Nominatim (geocoding)
  │
  ├─ POST https://overpass-api.de ───────────► Overpass API (infra signals)
  │
  └─ Supabase Client SDK
       ├─ Auth: Google OAuth token exchange
       └─ Data: valuations table (INSERT / SELECT with RLS)
```
