# Collatiq — Collateral Intelligence for Indian NBFCs

> **Hackathon Prototype · Final Version**
> AI-powered collateral assessment engine that replaces 3-day broker visits with a 30-second intelligence report.

---

## Live Demo

| Resource | Link |
|---|---|
| Deployed Website |https://collatiq.vercel.app/|
| Prototype Walkthrough Video |https://youtu.be/3BJnMP33e6M|
| Pitch Deck (PDF) |https://drive.google.com/file/d/1cEBW49eRoTcNQG1D7a8yfBiLI0CK9mYd/view?usp=sharing|

---

## The Problem

Indian NBFCs, HFCs, and banks process thousands of property loan applications every month. The collateral assessment step is taken for deciding whether a property is worth lending against and at what LTV it is:

- **3–7 days** waiting for a physical valuer
- **₹3,000–₹8,000** per report in broker fees
- **Inconsistent** — two valuers on the same property give different numbers
- **Black-box** — lenders can't see what drove the number
- **Fraud-blind** — paper-based processes miss systematic inconsistencies

For small-ticket MSME and housing loans below ₹50L, the valuation fee is often 1–2% of the loan itself. That's not a process problem, it's a cost-of-credit problem.

---

## The Solution

Collatiq runs a **4-engine pipeline** client-side in under 30 seconds:

```
Address → [Geo Engine] → [Valuation Engine] → [Confidence Engine] → [Decision Engine]
                ↓                ↓                     ↓                     ↓
         Coordinates +      Market Value +         Confidence          Sanction /
         Circle Rate +     Distress Value +          Score +         Conditional /
         Infra Score        RPI + TTL band         Fraud Flags          Decline
```

The output is a **lender-grade report** with every number explained in plain language and there is no black box.

---

## How It Works (Full Pipeline)

### Step 1 — Address Resolution
- User types the property address in free text
- **Nominatim (OpenStreetMap)** geocodes it to lat/lng in real time
- Map pin appears immediately; user confirms before proceeding

### Step 2 — Circle Rate Lookup
- Haversine distance is computed from the resolved coordinates against a database of **34 Bengaluru micromarket zones** + Mumbai, Hyderabad, Chennai, Pune, Delhi zones
- The nearest matching zone returns the **government circle rate per sq ft**
- Fallback: keyword matching on address string for localities not in the coordinate table

### Step 3 — Infrastructure Signals
- **Overpass API (OpenStreetMap)** is queried live for amenities within 2 km:
  - School / college count
  - Hospital / clinic count
  - Transit nodes (bus stops, metro stations)
  - Bank / retail density
- An **infra score (0–100)** is computed; this feeds directly into the valuation multiplier

### Step 4 — Valuation Engine
Twelve adjustments are applied on top of the base circle rate:

| Factor | Adjustment |
|---|---|
| Property type (flat / plot / villa / commercial) | ±0–25% |
| Building age (depreciation curve) | −0–35% |
| Floor position (ground/top floor penalty) | ±0–8% |
| Legal status (clear / disputed / unknown) | −0–20% |
| Occupancy (self-occupied / rented / vacant) | ±0–5% |
| Road width | ±0–5% |
| Khata type (A/B/revenue) | −0–15% |
| Construction type | ±0–8% |
| OC/Plan approval status | −0–10% |
| Litigation flag | −10–20% |
| Infra score (from Step 3) | ±0–15% |
| RPI (liquidity premium) | ±0–8% |

Output: **Market Value band (low–high)** and **Distress Value band** (forced-sale haircut)

### Step 5 — Confidence & Anomaly Engine
- Scores each input field for data quality (present / estimated / missing)
- Penalises missing legal status, unknown age, unresolved address
- Detects anomalies: area-price inconsistencies, age–condition mismatches, legal conflicts
- Outputs: **Confidence Score (0–100%)**, **Confidence Tier**, top fraud flags

### Step 6 — Decision Engine
Maps the confidence + LTV calculation to a final verdict:
- **Sanction Recommended** — clean title, adequate LTV headroom, high confidence
- **Conditional Review** — needs senior sign-off on specific flags
- **High Risk / Decline** — critical flags, low confidence, or distress value below threshold

---

## Output Report Sections

| Section | What It Shows |
|---|---|
| **Verdict Hero** | Single verdict + LTV band + health score (0–850) |
| **Market Value** | Low–high band, distress value, per-sq-ft rate, circle rate |
| **Resale Potential Index** | 0–100 liquidity score with time-to-liquidate band |
| **Valuation Waterfall** | Bar chart of every adjustment, + or − with % impact |
| **Narrative** | Plain-language paragraphs explaining every number |
| **Confidence Intelligence** | Data quality score broken down by dimension |
| **Anomaly Detection** | Every flag with severity (critical / warning / info) |
| **Decision Memo** | Formal credit memo text, exportable |
| **Peer Comparison** | 5 comparable properties with estimated price bands |
| **Sensitivity Analysis** | Slider: what happens to LTV if legal/demand/occupancy changes |
| **Property Map** | Leaflet map with live amenity overlay (schools, hospitals, transit) |
| **PDF Export** | One-click lender-grade report download |

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + Create React App |
| Animations | Framer Motion |
| 3D Scene | Three.js + React Three Fiber |
| Maps | Leaflet + react-leaflet |
| Geocoding | OpenStreetMap Nominatim (free, no API key) |
| Amenity Data | Overpass API (OpenStreetMap, free) |
| PDF Export | jsPDF |
| Auth | Supabase Auth (email magic link) |
| Persistence | localStorage (scores) + IndexedDB (photos/docs) |
| Deployment | Vercel / Netlify (static build) |
| Backend schema | Supabase Postgres (profiles, orgs, assessments) |

**Zero paid APIs required to run.** Everything works with free-tier or open-source data.

---

## Architecture

```
collatiq-app/
├── src/
│   ├── engine/
│   │   ├── pipeline.js          ← Orchestrates all engines in sequence
│   │   ├── geoEngine.js         ← Nominatim geocoding + Haversine zone lookup + Overpass infra
│   │   ├── valuationEngine.js   ← 12-factor valuation model + narrative generator
│   │   ├── confidenceEngine.js  ← Data quality scoring + anomaly detection
│   │   ├── fraudEngine.js       ← Flag extraction and severity classification
│   │   ├── decisionEngine.js    ← Verdict + LTV band + health score
│   │   └── pdfExport.js         ← jsPDF report generator
│   │
│   ├── components/
│   │   ├── InputScreen          ← 25-field property intake form
│   │   ├── ProcessingScreen     ← Live pipeline progress with 3D building
│   │   ├── ResultsScreen        ← Full 10-section report view
│   │   ├── PropertyMap          ← Leaflet map + amenity layer toggle
│   │   └── BengaluruHeatmap     ← City-level micromarket heatmap
│   │
│   ├── screens/
│   │   ├── AuthScreen           ← Supabase email auth
│   │   ├── RecentAssessments    ← History with compare mode + search
│   │   └── ComparisonView       ← Side-by-side assessment comparison
│   │
│   └── lib/
│       ├── assessmentStorage.js ← localStorage persistence + deduplication
│       ├── fileStorage.js       ← IndexedDB for photos/documents
│       ├── hydrateInput.js      ← Re-run pre-fill from saved assessment
│       └── supabase.js          ← Supabase client
│
└── supabase/
    └── migrations/
        └── 001_dual_user_schema.sql  ← Profiles, orgs, assessments schema
```

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/yerramsettysuchita/Collatiq.git
cd Collatiq

# 2. Install dependencies
npm install

# 3. Set environment variables (optional — app works without Supabase)
# Create a .env.local file and add:
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
# If left blank, auth is bypassed and all features work anonymously

# 4. Start dev server
npm start
# Opens at http://localhost:3000
```

---

## Deploying to Vercel

```bash
# Option A — CLI
npm i -g vercel
npm run build
vercel --prod

# Option B — Connect GitHub repo in Vercel dashboard
# Auto-detects Create React App, no config needed
# Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel environment variables
```

---

## Database Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** in your project dashboard
3. Paste and run `supabase/migrations/001_dual_user_schema.sql`
4. Copy your **Project URL** and **anon key** into `.env.local`

Schema creates: `profiles`, `organizations`, `organization_members`, `valuations` tables with Row Level Security.

---

## Key Features

- **No paid APIs** — runs entirely on OpenStreetMap + Nominatim + Overpass (all free)
- **Works offline** — uses in-memory geo cache; once loaded, no internet needed for reuse
- **Deduplication** — re-running the same property updates the existing record, never creates duplicates
- **Full history** — recent assessments with search, notes, compare side-by-side
- **PDF export** — one-click lender-grade report download
- **Sensitivity sliders** — real-time LTV impact when you change legal/occupancy/demand assumptions
- **Borrower view** — simplified report card for sharing directly with the loan applicant
- **Mobile responsive** — accordion layout on phones, full sidebar on desktop

---

## Target Users

| User | Use Case |
|---|---|
| **Credit Officer (NBFC/HFC)** | Pre-sanction check in 30 seconds before sending a physical valuer |
| **Branch Manager** | Same-day collateral screening for walk-in loan customers |
| **Risk Reviewer** | Portfolio-level view of collateral quality across cases |
| **Borrower** | Understand what their property is worth before applying |

---

## Honest Limitations (Prototype Scope)

- Circle rate data covers **Bengaluru (34 zones), Mumbai, Hyderabad, Chennai, Pune, Delhi/NCR**. Other cities fall back to a conservative national estimate.
- Valuation model is **rule-based**, not ML-trained on transaction data. Accuracy improves with real comparables.
- Legal title verification is **flagged but not automated** — the app surfaces missing legal data as risk but does not connect to CERSAI or EC databases.
- Photo/document upload is **UI-ready** but not connected to OCR/CV analysis yet.

---

## Roadmap

- [ ] CERSAI API for encumbrance verification
- [ ] EC / mutation certificate OCR via Anthropic Vision API
- [ ] Expand circle rate database to all 500+ registration districts
- [ ] ML-trained comparable sales model on real transaction data
- [ ] Multi-user org dashboard with team-level case assignment

---

## Built By

**Suchita Yerramsetty**
[GitHub](https://github.com/yerramsettysuchita) · [Email](mailto:suchitayerramsetty999@gmail.com) · [LinkedIn](https://linkedin.com/in/yerramsetty-sai-venkata-suchita-suchi1234)

---

## License

MIT — free to use, fork, and build on.

---

*All valuations are model-generated estimates. Not a certified property valuation. Should not be used as the sole basis for a lending decision.*

