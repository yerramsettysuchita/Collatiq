import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RESEARCH } from '../data/research';
import IndiaCitiesMap from './IndiaCitiesMap';
import './Sections.css';

/* ── SCROLL-REVEAL HOOK ──────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ══════════════════════════════════════════════════════════
   SECTION 1 — MARKET CONTEXT BAND  (light — location prices)
   ══════════════════════════════════════════════════════════ */
const TICKER_ITEMS = [
  { loc: 'Whitefield · BLR',      val: '₹8,240/sqft',  delta: '+2.1%', up: true  },
  { loc: 'Koramangala · BLR',     val: '₹11,800/sqft', delta: '+0.8%', up: true  },
  { loc: 'Bandra West · MUM',     val: '₹42,500/sqft', delta: '-0.3%', up: false },
  { loc: 'Powai · MUM',           val: '₹18,900/sqft', delta: '+1.4%', up: true  },
  { loc: 'Defence Colony · DEL',  val: '₹18,200/sqft', delta: '+1.1%', up: true  },
  { loc: 'Dwarka · DEL',          val: '₹8,100/sqft',  delta: '+0.5%', up: true  },
  { loc: 'Gachibowli · HYD',      val: '₹7,650/sqft',  delta: '+2.8%', up: true  },
  { loc: 'Jubilee Hills · HYD',   val: '₹12,500/sqft', delta: '+0.7%', up: true  },
  { loc: 'Indiranagar · BLR',     val: '₹14,300/sqft', delta: '+1.9%', up: true  },
  { loc: 'Anna Nagar · CHN',      val: '₹8,900/sqft',  delta: '+1.2%', up: true  },
  { loc: 'T Nagar · CHN',         val: '₹11,600/sqft', delta: '+0.9%', up: true  },
  { loc: 'Koregaon Park · PUN',   val: '₹11,200/sqft', delta: '+2.3%', up: true  },
  { loc: 'Hinjewadi · PUN',       val: '₹6,400/sqft',  delta: '+1.8%', up: true  },
  { loc: 'Worli · MUM',           val: '₹24,800/sqft', delta: '-0.2%', up: false },
  { loc: 'Banjara Hills · HYD',   val: '₹11,800/sqft', delta: '+1.5%', up: true  },
  { loc: 'Viman Nagar · PUN',     val: '₹8,500/sqft',  delta: '+2.0%', up: true  },
];

export function MarketContextBand() {
  return (
    <div className="market-ticker" aria-hidden="true">
      <div className="market-ticker-label">Live market context</div>
      <div className="market-ticker-wrap">
        <div className="market-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div className="ticker-item" key={i}>
              <span className="ticker-loc">{item.loc}</span>
              <span className="ticker-val">{item.val}</span>
              <span className={`ticker-delta ${item.up ? 'up' : 'down'}`}>{item.delta}</span>
              <span className="ticker-sep">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 2 — DARK STATS TICKER  (industry context)
   ══════════════════════════════════════════════════════════ */
const DARK_TICKER_ITEMS = [
  { label: 'Indian LAP market size',       value: '₹14 lakh crore' },
  { label: 'Cost of one broker visit',     value: '₹2,000 to ₹5,000' },
  { label: 'Typical industry turnaround',  value: '3 to 5 working days' },
  { label: 'Collatiq turnaround',          value: 'Under 30 seconds' },
  { label: 'Valuer disagreement rate',     value: 'Up to 40% on the same asset' },
  { label: 'Cities covered',               value: 'BLR · MUM · HYD · CHN · PUN · DEL · AMD · CCU · JAI · +9 more' },
  { label: 'Circle rate data source',      value: 'Govt. SRO 2024–25 · 10 states' },
  { label: 'Average model accuracy',       value: '8.5% mean error' },
  { label: 'Fraud checks per file',        value: '5 independent rules' },
  { label: 'LTV recommendation',           value: 'Adjusted for data confidence' },
];

export function StatsStrip() {
  return (
    <div className="dark-ticker" aria-hidden="true">
      <div className="dark-ticker-wrap">
        <div className="dark-ticker-track">
          {[...DARK_TICKER_ITEMS, ...DARK_TICKER_ITEMS].map((item, i) => (
            <div className="dark-ticker-item" key={i}>
              <span className="dti-label">{item.label}</span>
              <span className="dti-value">{item.value}</span>
              <span className="dti-rule" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 3 — FEATURES  (alternating rows + SVG visuals)
   ══════════════════════════════════════════════════════════ */

function GeoVisual() {
  // center (190,135); inner r=55, mid r=95, outer r=120
  // Dots — inner: top(190,80), br(238,163), bl(142,163)
  //        mid: tr(238,53), left(95,135), bottom(238,217)
  //        outer: right(310,135), bl(105,220)
  return (
    <svg viewBox="0 0 380 270" className="eng-visual">
      {/* Range circles */}
      <circle cx="190" cy="135" r="55"  fill="none" stroke="#AEAEA6" strokeWidth="1.5" strokeDasharray="5 4"/>
      <circle cx="190" cy="135" r="95"  fill="none" stroke="#AEAEA6" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6"/>
      <circle cx="190" cy="135" r="120" fill="none" stroke="#AEAEA6" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.35"/>
      {/* Inner ring dots */}
      <circle cx="190" cy="80"  r="5" fill="#5B6EF5"/>
      <circle cx="238" cy="163" r="5" fill="#5B6EF5"/>
      <circle cx="142" cy="163" r="5" fill="#5B6EF5"/>
      {/* Middle ring dots */}
      <circle cx="238" cy="53"  r="5" fill="#5B6EF5"/>
      <circle cx="95"  cy="135" r="5" fill="#5B6EF5"/>
      <circle cx="238" cy="217" r="5" fill="#5B6EF5"/>
      {/* Outer ring dots */}
      <circle cx="310" cy="135" r="5" fill="#5B6EF5"/>
      <circle cx="105" cy="220" r="5" fill="#5B6EF5"/>
      {/* Labels — placed clear of dots */}
      <text x="248" y="51"  style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#6B6B66'}}>School</text>
      <text x="248" y="168" style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#6B6B66'}}>Metro</text>
      <text x="82"  y="130" textAnchor="end" style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#6B6B66'}}>Hospital</text>
      {/* Center pin */}
      <circle cx="190" cy="135" r="10" fill="#5B6EF5"/>
      <circle cx="190" cy="135" r="4"  fill="#fff"/>
      {/* Radius label bottom-left */}
      <text x="10" y="258" style={{fontFamily:"'DM Mono',monospace",fontSize:'12px',fill:'#AEAEA6'}}>1,200 m radius</text>
    </svg>
  );
}

function WaterfallVisual() {
  // Labels LEFT of baseline (x=150), bars extend RIGHT
  const bars = [
    { label: 'Circle rate', w: 100, color: '#5B6EF5', opacity: 0.90 },
    { label: 'Location +',  w:  72, color: '#5B6EF5', opacity: 0.80 },
    { label: 'Infra +',     w:  52, color: '#5B6EF5', opacity: 0.65 },
    { label: 'Age —',       w:  30, color: '#D97706', opacity: 0.85 },
    { label: 'Config +',    w:  44, color: '#5B6EF5', opacity: 0.70 },
    { label: 'Legal —',     w:  24, color: '#D97706', opacity: 0.80 },
  ];
  const ys = [22, 58, 94, 130, 166, 202];
  const BAR_H = 24;
  return (
    <svg viewBox="0 0 380 242" className="eng-visual">
      {/* Header top-right */}
      <text x="374" y="14" textAnchor="end"
        style={{fontFamily:"'DM Mono',monospace",fontSize:'12px',fill:'#9B9B95'}}>Market value</text>
      <text x="374" y="32" textAnchor="end"
        style={{fontFamily:"'DM Serif Display',serif",fontSize:'16px',fill:'#5B6EF5'}}>₹95L – ₹1.15Cr</text>
      {/* Baseline */}
      <line x1="152" y1="14" x2="152" y2="232" stroke="#AEAEA6" strokeWidth="1.5"/>
      {/* Bars — labels to the LEFT, bar to the RIGHT */}
      {bars.map((b, i) => (
        <g key={i}>
          <text x="146" y={ys[i] + BAR_H * 0.68} textAnchor="end"
            style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#6B6B66'}}>
            {b.label}
          </text>
          <rect x="152" y={ys[i]} width={b.w} height={BAR_H}
            fill={b.color} opacity={b.opacity} rx="3"/>
        </g>
      ))}
    </svg>
  );
}

function LiquidityVisual() {
  // Center (190,140), r=110. sweep-flag=1 draws the TOP semicircle (through y=30).
  // 33% pt: (134,45)  67% pt: (246,45)  Needle tip (72%): (244,75)
  // All text is below y=160 — well clear of the arc which ends at y=140.
  return (
    <svg viewBox="0 0 380 280" className="eng-visual">
      {/* Background track — sweep-flag=1 = TOP arc */}
      <path d="M 80 140 A 110 110 0 0 1 300 140"
        fill="none" stroke="#E8E7E1" strokeWidth="22" strokeLinecap="butt"/>
      {/* Red 0–33% */}
      <path d="M 80 140 A 110 110 0 0 1 134 45"
        fill="none" stroke="#DC2626" strokeWidth="22" strokeLinecap="butt" opacity="0.9"/>
      {/* Amber 33–67% */}
      <path d="M 134 45 A 110 110 0 0 1 246 45"
        fill="none" stroke="#D97706" strokeWidth="22" strokeLinecap="butt" opacity="0.9"/>
      {/* Green 67–100% */}
      <path d="M 246 45 A 110 110 0 0 1 300 140"
        fill="none" stroke="#16A34A" strokeWidth="22" strokeLinecap="butt" opacity="0.9"/>
      {/* Needle */}
      <line x1="190" y1="140" x2="244" y2="75"
        stroke="#5B6EF5" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="190" cy="140" r="6" fill="#5B6EF5"/>
      {/* Value — below the arc, no overlap possible */}
      <text x="190" y="192" textAnchor="middle"
        style={{fontFamily:"'DM Serif Display',serif",fontSize:'52px',fill:'#0C0C0B'}}>72</text>
      <text x="190" y="220" textAnchor="middle"
        style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#9B9B95'}}>/100</text>
      <text x="190" y="240" textAnchor="middle"
        style={{fontFamily:"'DM Mono',monospace",fontSize:'12px',fill:'#AEAEA6'}}>Resale Potential Index</text>
    </svg>
  );
}

function ConfidenceVisual() {
  // Header row first (y=0–24), then 5 data rows starting at y=34.
  // Badge at TOP-LEFT — track starts at x=210, so zero overlap possible.
  const rows = [
    { label: 'Location zone',  fill: 122, color: '#16A34A' },
    { label: 'Clear title',    fill: 101, color: '#16A34A' },
    { label: 'Area confirmed', fill:  84, color: '#16A34A' },
    { label: 'Age penalty',    fill:  59, color: '#DC2626' },
    { label: 'Low infra zone', fill:  42, color: '#DC2626' },
  ];
  // Row tops: start at 52 (24px breathing room after line at y=28)
  const ys = rows.map((_, i) => 52 + i * 44);
  return (
    <svg viewBox="0 0 380 278" className="eng-visual">
      {/* Header — left-aligned, far from tracks on the right */}
      <text x="10" y="20"
        style={{fontFamily:"'DM Mono',monospace",fontSize:'11px',fill:'#9B9B95',letterSpacing:'0.08em',textTransform:'uppercase'}}>
        Confidence score
      </text>
      <text x="370" y="20" textAnchor="end"
        style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#5B6EF5',fontWeight:700}}>
        Conf 0.72
      </text>
      <line x1="10" y1="28" x2="370" y2="28" stroke="#E8E7E1" strokeWidth="1"/>
      {rows.map((r, i) => (
        <g key={i}>
          <rect x="10" y={ys[i]} width="14" height="14" fill={r.color} rx="2"/>
          <text x="32" y={ys[i] + 12}
            style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#4A4A46'}}>
            {r.label}
          </text>
          {/* Track — starts at x=210, well right of any label text */}
          <rect x="210" y={ys[i] + 2} width="150" height="10" fill="#E8E7E1" rx="5"/>
          <rect x="210" y={ys[i] + 2} width={r.fill} height="10" fill={r.color} rx="5"/>
        </g>
      ))}
    </svg>
  );
}

function FraudVisual() {
  // 5 rows at 42px spacing; circle r=15 cx=22; label x=46; status x=370
  const rows = [
    { label: 'Area sanity check',   status: 'Passed', pass: true  },
    { label: 'Location type match', status: 'Passed', pass: true  },
    { label: 'Value per sqft',      status: 'Passed', pass: true  },
    { label: 'Config plausibility', status: 'Passed', pass: true  },
    { label: 'Legal status',        status: 'Review', pass: false },
  ];
  const ys = [10, 52, 94, 136, 178];
  return (
    <svg viewBox="0 0 380 245" className="eng-visual">
      {rows.map((r, i) => {
        const cy  = ys[i] + 16;
        const ty  = ys[i] + 22;
        const gc  = r.pass ? '#16A34A' : '#D97706';
        const gbg = r.pass ? '#F0FDF4' : '#FFFBEB';
        return (
          <g key={i}>
            {/* Icon circle */}
            <circle cx="22" cy={cy} r="15" fill={gbg} stroke={gc} strokeWidth="2"/>
            <text x="22" y={ty} textAnchor="middle"
              style={{fontFamily:"'DM Mono',monospace",fontSize:'14px',fill:gc,fontWeight:700}}>
              {r.pass ? '✓' : '!'}
            </text>
            {/* Label — starts after circle */}
            <text x="46" y={ty}
              style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:'#4A4A46'}}>
              {r.label}
            </text>
            {/* Status — right-aligned */}
            <text x="370" y={ty} textAnchor="end"
              style={{fontFamily:"'DM Mono',monospace",fontSize:'13px',fill:gc,fontWeight:600}}>
              {r.status}
            </text>
          </g>
        );
      })}
      {/* Summary */}
      <text x="190" y="232" textAnchor="middle" style={{fontFamily:"'DM Mono',monospace",fontSize:'12px',fill:'#9B9B95'}}>4 passed · 1 flagged</text>
    </svg>
  );
}

const ENGINE_ROWS = [
  {
    index: '01', title: 'Geospatial Intelligence',
    desc: 'Before pricing anything, Collatiq maps what is around the property. The neighbourhood shapes the value just as much as the building does, so the engine checks metro access, nearby schools and hospitals, and how many similar properties are currently listed in the same area.',
    produces: 'Infrastructure score', Visual: GeoVisual,
  },
  {
    index: '02', title: 'Hedonic Valuation',
    desc: 'The government circle rate is just the starting point. Collatiq adjusts it for the building age, floor level, legal title, and how the property is currently used. Every adjustment is shown so you can follow the logic.',
    produces: 'Market value range', Visual: WaterfallVisual,
  },
  {
    index: '03', title: 'Liquidity Modelling',
    desc: 'A property might be worth a crore on paper, but how fast can you actually sell it if things go wrong? Collatiq scores every property for how quickly it would move in the market and what you would recover in a forced sale.',
    produces: 'Resale Potential Index', Visual: LiquidityVisual,
  },
  {
    index: '04', title: 'Confidence Engine',
    desc: 'When the data is thin, Collatiq says so. The confidence score tracks how much the engine is relying on assumptions versus hard data, and the loan-to-value recommendation adjusts automatically to reflect that.',
    produces: 'Confidence score', Visual: ConfidenceVisual,
  },
  {
    index: '05', title: 'Fraud Detection',
    desc: 'Before any assessment reaches your team, Collatiq checks whether the declared area makes sense for the location, whether the property type fits where it is registered, and whether the overall profile looks realistic.',
    produces: 'Fraud flags', Visual: FraudVisual,
  },
];

export function Features() {
  const [ref, visible] = useReveal(0.06);
  return (
    <section className="features-section" id="platform" ref={ref}>
      <motion.div
        className="feat-header"
        initial={{ opacity: 0, y: 24 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="section-eyebrow">The intelligence stack</div>
        <h2 className="section-heading">
          Five engines.<br /><em>One decision.</em>
        </h2>
        <p className="feat-sub">
          Every engine does one thing and does it well. You can see exactly what each one
          checked, what it found, and how that influenced the final number.
        </p>
      </motion.div>

      <div className="feat-rows">
        {ENGINE_ROWS.map((row, i) => {
          const isOdd = i % 2 === 0;
          return (
            <motion.div
              className={`feat-row ${isOdd ? 'feat-row--normal' : 'feat-row--flip'}`}
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="feat-row-text">
                <div className="feat-row-index">{row.index}</div>
                <div className="feat-row-title">{row.title}</div>
                <div className="feat-row-desc">{row.desc}</div>
                <div className="feat-row-output">
                  <span className="feat-output-label">What it produces</span>
                  <span className="feat-output-name">{row.produces}</span>
                </div>
              </div>
              <div className="feat-row-visual">
                <row.Visual />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 4 — HOW IT WORKS
   ══════════════════════════════════════════════════════════ */
const STEP_DESCRIPTIONS = [
  'The entered address resolves to precise coordinates and the correct circle rate zone is identified.',
  'Live infrastructure data from OpenStreetMap returns metro distance, hospital count, schools, and competing listings within 1200 metres.',
  'The applicable government circle rate for the detected city and zone is retrieved and a location-based market premium multiplier is applied on top of it.',
  'Twelve sequential adjustment factors apply to the baseline and produce a market value range with every factor attributed.',
  'The Resale Potential Index derives and the liquidity discount curve produces the distress sale range and time-to-exit.',
  'Declared area checks against statistical locality norms and property type verifies against the location profile.',
  'The decision matrix converts confidence and RPI into a verdict with a recommended LTV band and a credit committee memo.',
];

const VERDICT_COLORS = ['#16A34A', '#D97706', '#DC2626'];

export function HowItWorks() {
  const [ref, visible] = useReveal(0.06);
  const [active, setActive] = useState(null);

  return (
    <section className="how-section" id="how" ref={ref}>
      <motion.div
        className="how-left"
        initial={{ opacity: 0, x: -24 }}
        animate={visible ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="section-eyebrow">Process</div>
        <h2 className="how-heading">
          Seven steps.<br /><em>Thirty seconds.</em>
        </h2>

        <div className="dm-card">
          <div className="dm-title">Decision matrix</div>
          {RESEARCH.verdictMatrix.map((v, i) => (
            <div className={`dm-row ${i < 2 ? 'dm-row--border' : ''}`} key={i}>
              <div className="dm-row-main">
                <div className="dm-dot" style={{ background: VERDICT_COLORS[i] }} />
                <span className="dm-verdict">{v.verdict}</span>
                <span className="dm-ltv" style={{ color: VERDICT_COLORS[i] }}>{v.ltv}</span>
              </div>
              <div className="dm-cond">{v.condition}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="how-steps">
        {RESEARCH.engineLayers.map((step, i) => (
          <motion.div
            className={`how-step ${active === i ? 'how-step--active' : ''}`}
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="step-accent" />
            <div className="step-num">{step.step}</div>
            <div className="step-body">
              <div className="step-title">{step.label}</div>
              <div className="step-desc">{STEP_DESCRIPTIONS[i]}</div>
              <div className="step-time">{step.time}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 5 — INDIA MARKET MAP
   ══════════════════════════════════════════════════════════ */
export function BengaluruMarketSection({ onAssess }) {
  const [ref, visible] = useReveal(0.06);
  return (
    <section className="blr-section" ref={ref} id="market-map">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="section-eyebrow">Real-time coverage · 34 cities · 200+ zones</div>
        <h2 className="section-heading blr-heading">
          India <em>Market Intelligence</em>
        </h2>

        <div className="blr-callouts">
          <div className="blr-callout">
            <div className="blr-callout-num">200+</div>
            <div className="blr-callout-label">Micromarket zones across 34 cities</div>
          </div>
          <div className="blr-callout">
            <div className="blr-callout-num blr-callout-num--sm">₹3,800 – ₹42,000</div>
            <div className="blr-callout-label">Circle rate range per sqft</div>
          </div>
          <div className="blr-callout">
            <div className="blr-callout-num blr-callout-num--sm">Govt. SRO 2024–25</div>
            <div className="blr-callout-label">Multi-state data · live geocoding</div>
          </div>
        </div>

        <IndiaCitiesMap onAssess={onAssess} />

        <p className="blr-caption">
          34 Indian cities covered with micromarket-level circle rates. Click a zone to see its rate, typical liquidity score, and average time to sell. The engine works for any address across all cities shown.
        </p>
      </motion.div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 6 — CALIBRATION
   ══════════════════════════════════════════════════════════ */
export function CalibrationSection() {
  const [ref, visible] = useReveal(0.06);
  return (
    <section className="calib-section" id="output" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="section-eyebrow">Validation · 5 cities · 8 cases</div>
        <h2 className="section-heading">
          Validated against<br /><em>real prices across India.</em>
        </h2>

        <div className="calib-anchor">
          <div className="calib-anchor-num">8.5%</div>
          <div className="calib-anchor-sub">
            Tested against 8 real property transactions across Bengaluru, Mumbai, Hyderabad, Chennai and Pune.
            The 8.5% average gap between the engine range and actual sale price sits within acceptable underwriting tolerance for pre-sanction collateral assessment. Coverage now extends to 34 Indian cities with 200+ micromarket zones.
          </div>
        </div>

        <div className="calib-table">
          <div className="calib-head">
            <span>Location</span>
            <span>Type</span>
            <span>Area</span>
            <span>Known price</span>
            <span>Engine range</span>
            <span>Error</span>
          </div>
          {RESEARCH.calibrationCases.map((c, i) => {
            const errVal = parseFloat(c.error);
            const barW = Math.min((errVal / 12) * 100, 100);
            const barColor = errVal < 8 ? '#16A34A' : '#D97706';
            return (
              <motion.div
                className={`calib-row ${i % 2 === 1 ? 'calib-row--alt' : ''}`}
                key={i}
                initial={{ opacity: 0 }}
                animate={visible ? { opacity: 1 } : {}}
                transition={{ delay: 0.05 + i * 0.06 }}
              >
                <span className="calib-loc">{c.location}</span>
                <span>{c.type}</span>
                <span className="mono">{c.area} sqft</span>
                <span className="mono">{c.known}</span>
                <span className="mono calib-range">{c.engine}</span>
                <span className="calib-err-cell">
                  <span className="calib-err-val" style={{ color: barColor }}>{c.error}</span>
                  <span className="calib-err-track">
                    <span className="calib-err-fill" style={{ width: `${barW}%`, background: barColor }} />
                  </span>
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 7 — PAIN POINTS  (before / after comparison)
   ══════════════════════════════════════════════════════════ */
const COMPARISON_ROWS = [
  {
    without: 'A third-party valuation takes three to five working days. Applications stall while you wait.',
    with:    'Full assessment is ready in under 30 seconds. Same data, every time, instantly.',
  },
  {
    without: 'One broker visit costs around ₹5,000. At 20 files a day that is a lakh in daily spend before a single rupee is lent.',
    with:    'Marginal compute cost per file. Run 200 assessments for what one broker visit costs.',
  },
  {
    without: 'Two valuers looking at the same property will disagree by 30 to 40 percent. No one can explain why.',
    with:    'Same inputs always produce the same output. Fully auditable and defensible at any credit committee.',
  },
  {
    without: 'No lender in India today can tell you how fast a property will sell if the borrower defaults.',
    with:    'Every file shows a Resale Potential Index score and a time-to-liquidate range in days.',
  },
  {
    without: 'Overstated area declarations get through unchecked and sit on the books until a default surfaces.',
    with:    'Area anomalies are flagged before the file reaches your team using statistical zone norms.',
  },
  {
    without: 'There is no trail showing how a valuation number was arrived at or which assumptions drove it.',
    with:    'Every assessment logs every factor, every multiplier, and every adjustment made to reach the number.',
  },
];

export function PainPoints() {
  const [ref, visible] = useReveal(0.06);
  return (
    <section className="pain-section" id="api" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="section-eyebrow">Why Collatiq exists</div>
        <h2 className="section-heading">
          The old way.<br /><em>The better way.</em>
        </h2>
      </motion.div>

      <div className="compare-table">
        <div className="compare-head">
          <div className="compare-head-cell compare-head-bad">Without Collatiq</div>
          <div className="compare-head-cell compare-head-good">With Collatiq</div>
        </div>
        {COMPARISON_ROWS.map((row, i) => (
          <motion.div
            className={`compare-row ${i % 2 === 1 ? 'compare-row--alt' : ''}`}
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="compare-cell compare-cell--bad">{row.without}</div>
            <div className="compare-divider" />
            <div className="compare-cell compare-cell--good">{row.with}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
