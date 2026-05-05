import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import { signInWithPassword, signUpWithPassword } from '../lib/supabase';
import 'leaflet/dist/leaflet.css';
import './EntryScreen.css';

const LETTERS = ['C', 'O', 'L', 'L', 'A', 'T', 'I', 'Q'];

/* ── Pan-India property assessment pins ─────────────────────────────────────── */

const BLR_PROPERTIES = [
  { pos: [12.9784, 77.6408], id: 'KA-0551', loc: 'Indiranagar, BLR',      val: '₹2.74 Cr', status: 'APPROVED' },
  { pos: [12.9352, 77.6245], id: 'KA-2103', loc: 'Koramangala, BLR',      val: '₹1.89 Cr', status: 'REVIEW'   },
  { pos: [19.0544, 72.8322], id: 'MH-0891', loc: 'Bandra West, MUM',      val: '₹3.24 Cr', status: 'APPROVED' },
  { pos: [17.4156, 78.4347], id: 'TS-1102', loc: 'Banjara Hills, HYD',    val: '₹2.90 Cr', status: 'APPROVED' },
  { pos: [13.0827, 80.2707], id: 'TN-0734', loc: 'Anna Nagar, CHN',       val: '₹0.88 Cr', status: 'REVIEW'   },
  { pos: [18.5362, 73.8972], id: 'MH-1204', loc: 'Koregaon Park, PUN',    val: '₹1.65 Cr', status: 'APPROVED' },
  { pos: [28.5672, 77.2100], id: 'DL-0667', loc: 'Defence Colony, DEL',   val: '₹3.45 Cr', status: 'FLAGGED'  },
  { pos: [23.0335, 72.5606], id: 'GJ-0320', loc: 'Satellite, AMD',        val: '₹1.12 Cr', status: 'APPROVED' },
  { pos: [22.5726, 88.3639], id: 'WB-0881', loc: 'Salt Lake, CCU',        val: '₹1.34 Cr', status: 'REVIEW'   },
];

const STATUS_COLOR = { APPROVED: '#4ADE80', REVIEW: '#FCD34D', FLAGGED: '#F87171' };

const TICKER_ROWS = [
  { id: 'KA-0551', loc: 'Indiranagar, Bengaluru',     val: '₹2.74 Cr', ltv: 68, status: 'APPROVED' },
  { id: 'MH-0891', loc: 'Bandra West, Mumbai',        val: '₹3.24 Cr', ltv: 65, status: 'APPROVED' },
  { id: 'TS-1102', loc: 'Banjara Hills, Hyderabad',   val: '₹2.90 Cr', ltv: 64, status: 'APPROVED' },
  { id: 'TN-0734', loc: 'Anna Nagar, Chennai',        val: '₹0.88 Cr', ltv: 71, status: 'REVIEW'   },
  { id: 'MH-1204', loc: 'Koregaon Park, Pune',        val: '₹1.65 Cr', ltv: 67, status: 'APPROVED' },
  { id: 'DL-0667', loc: 'Defence Colony, Delhi',      val: '₹3.45 Cr', ltv: 58, status: 'FLAGGED'  },
  { id: 'GJ-0320', loc: 'Satellite, Ahmedabad',       val: '₹1.12 Cr', ltv: 70, status: 'APPROVED' },
  { id: 'WB-0881', loc: 'Salt Lake, Kolkata',         val: '₹1.34 Cr', ltv: 66, status: 'REVIEW'   },
  { id: 'KA-2103', loc: 'Koramangala, Bengaluru',     val: '₹1.89 Cr', ltv: 72, status: 'REVIEW'   },
  { id: 'RJ-0412', loc: 'Vaishali Nagar, Jaipur',     val: '₹0.98 Cr', ltv: 69, status: 'APPROVED' },
];

/* ── Pan-India portfolio live map ───────────────────────────────────────────── */

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function BengaluruMap() {
  return (
    <MapContainer
      center={[20.5, 78.9]}
      zoom={5}
      zoomControl={false}
      scrollWheelZoom={true}
      dragging={true}
      touchZoom={true}
      doubleClickZoom={true}
      boxZoom={true}
      keyboard={true}
      attributionControl={false}
      style={{ width: '100%', height: '100%', background: '#e8e0d8' }}
    >
      <MapResizer />
      <ZoomControl position="bottomright" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      {BLR_PROPERTIES.map((p, i) => (
        <CircleMarker
          key={i}
          center={p.pos}
          radius={11}
          pathOptions={{
            color: '#ffffff',
            fillColor: STATUS_COLOR[p.status],
            fillOpacity: 1,
            weight: 2.5,
          }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            <span className="cin-map-tip">
              {p.id} · {p.loc}<br />{p.val}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

/* ── Scrolling data ticker ───────────────────────────────────────────────────── */

function DataTicker() {
  const rows = [...TICKER_ROWS, ...TICKER_ROWS];
  return (
    <div className="cin-ticker-wrap">
      <div className="cin-ticker-inner">
        {rows.map((row, i) => (
          <span key={i} className="cin-ticker-item">
            <span className="cin-ticker-id">{row.id}</span>
            <span className="cin-ticker-sep"> · </span>
            <span className="cin-ticker-loc">{row.loc}</span>
            <span className="cin-ticker-sep"> · </span>
            <span className="cin-ticker-val">{row.val}</span>
            <span className="cin-ticker-sep"> · </span>
            <span className="cin-ticker-ltv">LTV {row.ltv}%</span>
            <span className="cin-ticker-sep"> · </span>
            <span className={`cin-ticker-status cin-ticker-status--${row.status.toLowerCase()}`}>
              {row.status}
            </span>
            <span className="cin-ticker-gap" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 3D floating property cards ──────────────────────────────────────────────── */

const FCARDS = [
  { id: 'KA-0551', loc: 'Indiranagar', val: '₹2.74 Cr', status: 'APPROVED', ltv: 68 },
  { id: 'KA-2103', loc: 'Koramangala', val: '₹1.89 Cr', status: 'REVIEW',   ltv: 72 },
  { id: 'KA-0667', loc: 'HSR Layout',  val: '₹1.95 Cr', status: 'FLAGGED',  ltv: 75 },
];

function FloatingCards() {
  return (
    <motion.div
      className="cin-decor-wrap"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.8, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {FCARDS.map((c, i) => (
        <div key={c.id} className={`cin-fcard cin-fcard--${i + 1}`}>
          <div className="cin-fcard-head">
            <span className="cin-fcard-id">{c.id}</span>
            <span className={`cin-fcard-badge cin-fcard-badge--${c.status}`}>{c.status}</span>
          </div>
          <div className="cin-fcard-loc">{c.loc}</div>
          <div className="cin-fcard-val">{c.val}</div>
          {i === 0 && (
            <div className="cin-fcard-bar">
              <div className="cin-fcard-bar-fill" style={{ width: `${c.ltv}%` }} />
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
}

function IsoBuildingDecor() {
  return (
    <motion.div
      className="cin-iso-wrap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.85 }}
      transition={{ delay: 1.2, duration: 1.2 }}
    >
      <svg width="170" height="110" viewBox="0 0 170 110" fill="none" aria-hidden="true">
        <polygon points="40,8 70,22 70,22 40,36 10,22" fill="#DBEAFE" />
        <polygon points="10,22 10,82 40,96 40,36" fill="#93C5FD" />
        <polygon points="70,22 70,82 40,96 40,36" fill="#60A5FA" />
        <rect x="16" y="36" width="7" height="9" rx="1" fill="#BFDBFE" opacity="0.9" />
        <rect x="16" y="52" width="7" height="9" rx="1" fill="#BFDBFE" opacity="0.9" />
        <rect x="16" y="68" width="7" height="9" rx="1" fill="#BFDBFE" opacity="0.9" />
        <rect x="27" y="36" width="7" height="9" rx="1" fill="#BFDBFE" opacity="0.9" />
        <rect x="27" y="52" width="7" height="9" rx="1" fill="#BFDBFE" opacity="0.9" />
        <polygon points="90,28 120,14 150,28 120,42" fill="#EDE9FE" />
        <polygon points="120,42 120,88 150,74 150,28" fill="#C4B5FD" />
        <polygon points="90,28 90,74 120,88 120,42" fill="#A78BFA" />
        <rect x="95" y="44" width="7" height="8" rx="1" fill="#DDD6FE" opacity="0.9" />
        <rect x="95" y="58" width="7" height="8" rx="1" fill="#DDD6FE" opacity="0.9" />
        <rect x="95" y="72" width="7" height="8" rx="1" fill="#DDD6FE" opacity="0.9" />
        <polygon points="55,60 78,48 100,60 78,72" fill="#D1FAE5" />
        <polygon points="55,60 55,90 78,102 78,72" fill="#6EE7B7" />
        <polygon points="100,60 100,90 78,102 78,72" fill="#34D399" />
      </svg>
    </motion.div>
  );
}

/* ── Part A: Cinematic opening ───────────────────────────────────────────────── */

function CinematicStage({ onAdvance }) {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(2), 6000);
    const t2 = setTimeout(() => setPhase(3), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="cin-stage">
      <div className="cin-grid" />
      <div className="cin-glow" />
      <IsoBuildingDecor />
      <FloatingCards />

      <motion.div
        className="cin-top-bar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 1 }}
      >
        <span className="cin-brand-tag">COLLATIQ · INTELLIGENCE PLATFORM</span>
        <div className="cin-live-indicator">
          <span className="cin-live-dot" />
          <span className="cin-live-tag">LIVE DATA</span>
        </div>
      </motion.div>

      <div className="cin-body">
        <div className="cin-main">
          <div className="cin-wordmark" aria-label="COLLATIQ">
            {LETTERS.map((l, i) => (
              <motion.span
                key={i}
                className="cin-letter"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                {l}
              </motion.span>
            ))}
          </div>

          <motion.div
            className="cin-divider"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />

          <AnimatePresence mode="wait">
            {phase === 1 && (
              <motion.p key="p1" className="cin-tagline"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.4 } }}
                transition={{ delay: 2.2, duration: 0.8 }}
              >
                ₹14 lakh crore in property-backed lending.
              </motion.p>
            )}
            {phase === 2 && (
              <motion.p key="p2" className="cin-tagline"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.4 } }}
                transition={{ delay: 0.1, duration: 0.8 }}
              >
                Priced by brokers. Decided in days. Built on guesswork.
              </motion.p>
            )}
            {phase === 3 && (
              <motion.div key="p3" className="cin-phase3"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
              >
                <motion.p className="cin-resolution"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.8 }}
                >
                  There is a better way.
                </motion.p>
                <motion.button className="cin-continue-btn" onClick={onAdvance}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  GET STARTED →
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="cin-map-panel">
          <div className="cin-map-vignette" />
          <motion.div className="cin-map-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
          >
            <span className="cin-map-city">BENGALURU</span>
            <span className="cin-map-count">{BLR_PROPERTIES.length} active assessments</span>
          </motion.div>
          <div className="cin-map-legend">
            {[['APPROVED','#4ADE80'],['REVIEW','#FCD34D'],['FLAGGED','#F87171']].map(([label, color]) => (
              <span key={label} className="cin-map-legend-item">
                <span className="cin-map-legend-dot" style={{ background: color }} />
                <span className="cin-map-legend-label">{label}</span>
              </span>
            ))}
          </div>
          <BengaluruMap />
        </div>
      </div>

      <DataTicker />
    </div>
  );
}

/* ── Part B: Mode selection ──────────────────────────────────────────────────── */

function ModeSelectStage({ onPropertyOwner, onPoSignIn, onLenderSignIn, onLenderSignUp, onBack }) {
  return (
    <div className="mode-stage">
      <motion.div className="mode-header"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mode-eyebrow">Choose your mode</div>
        <h2 className="mode-title">How will you use Collatiq?</h2>
        <p className="mode-sub">Both modes access the same AI-powered collateral engine.</p>
      </motion.div>

      <div className="mode-cards">
        <motion.div className="mode-card mode-card--po"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mode-card-head">
            <div className="mode-card-icon">
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <path d="M3 15L15 3l12 12v12H3V15z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M11 27V19h8v8" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="mode-card-tag mode-card-tag--free">No account needed</span>
          </div>
          <div className="mode-card-name">Public / Property Owner</div>
          <p className="mode-card-desc">
            Get an instant market value estimate, liquidity score, and collateral
            readiness rating for your property — before you sign up.
          </p>
          <div className="mode-card-access">
            <span className="mode-access-label">Who can use</span>
            <span>Homeowners · Plot owners · Anyone planning to sell or refinance</span>
          </div>
          <div className="mode-card-actions">
            <button className="mode-card-btn mode-card-btn--primary" onClick={onPropertyOwner}>
              Estimate My Property →
            </button>
            <button className="mode-card-btn mode-card-btn--ghost" onClick={onPoSignIn}>
              Sign In
            </button>
          </div>
        </motion.div>

        <motion.div className="mode-card mode-card--lender"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mode-card-head">
            <div className="mode-card-icon">
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="24" height="19" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 14h24" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 4v3M19 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 21h6M9 24.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="mode-card-tag mode-card-tag--auth">Account required</span>
          </div>
          <div className="mode-card-name">Internal Lender</div>
          <p className="mode-card-desc">
            Run structured collateral due diligence with LTV bands, fraud flags,
            risk scores, and full exportable audit reports.
          </p>
          <div className="mode-card-access">
            <span className="mode-access-label">Who can use</span>
            <span>NBFC officers · Loan managers · Credit risk analysts</span>
          </div>
          <div className="mode-card-actions">
            <button className="mode-card-btn mode-card-btn--primary" onClick={onLenderSignIn}>
              Sign In →
            </button>
            <button className="mode-card-btn mode-card-btn--ghost" onClick={onLenderSignUp}>
              Create Account
            </button>
          </div>
        </motion.div>
      </div>

      <button className="mode-back-btn" onClick={onBack}>← Back</button>
    </div>
  );
}

/* ── Part C: Property owner contact form ─────────────────────────────────────── */

function PropertyOwnerFormStage({ onSubmit, onBack }) {
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim())                          { setError('Please enter your name'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Please enter a valid 10-digit phone number'); return; }
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() });
  };

  return (
    <div className="po-entry-stage">
      <motion.div className="po-entry-header"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="po-entry-eyebrow">Property Owner</div>
        <h2 className="po-entry-title">Tell us about yourself</h2>
        <p className="po-entry-sub">
          Your details personalise the estimate report. No account needed — create one later for a full PDF report.
        </p>
      </motion.div>

      <motion.div className="po-entry-fields"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <input className="po-entry-input" type="text" placeholder="Full name"
          value={name} onChange={e => { setName(e.target.value); setError(''); }}
          autoComplete="name"
        />
        <input className="po-entry-input" type="email" placeholder="Email address"
          value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
          autoComplete="email"
        />
        <div className="po-entry-phone">
          <span className="po-entry-phone-prefix">+91</span>
          <input className="po-entry-input po-entry-input--phone" type="tel"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
            autoComplete="tel"
          />
        </div>
      </motion.div>

      {error && (
        <motion.p className="po-entry-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.p>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <button className="po-entry-submit" onClick={handleSubmit}>
          Get Property Estimate →
        </button>
        <p className="po-entry-note">
          No sign-up required. Create an account later for a full detailed PDF report.
        </p>
      </motion.div>

      <button className="po-entry-back" onClick={onBack}>← Back</button>
    </div>
  );
}

/* ── Part D: Lender sign in / sign up ────────────────────────────────────────── */

function LenderAuthStage({ onBack, role = 'lending_professional', initialTab = 'signin' }) {
  const [tab,          setTab]          = useState(initialTab);
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [pass,         setPass]         = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const switchTab = (t) => { setTab(t); setError(''); setNeedsConfirm(false); };

  const handleSignIn = async () => {
    if (!email || !pass) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      await signInWithPassword(email.trim(), pass);
      // onAuthStateChange SIGNED_IN in App.jsx handles navigation
    } catch (e) {
      const msg = e.message || '';
      setError(msg.toLowerCase().includes('invalid') ? 'Incorrect email or password.' : msg || 'Sign in failed.');
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name || !email || !pass) { setError('Please fill in all fields.'); return; }
    if (pass.length < 8)          { setError('Password must be at least 8 characters.'); return; }
    if (pass !== confirm)         { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      localStorage.setItem('collatiq_pending_role', role);
      const data = await signUpWithPassword(email.trim(), pass);
      if (!data.session) {
        setNeedsConfirm(true);
        setLoading(false);
      }
      // if session exists, onAuthStateChange fires SIGNED_IN → App.jsx navigates
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email taken')) {
        setError('An account with this email already exists. Switch to Sign In.');
        switchTab('signin');
      } else {
        setError(e.message || 'Sign up failed. Please try again.');
      }
      setLoading(false);
    }
  };

  if (needsConfirm) {
    return (
      <div className="lender-auth-stage">
        <motion.div className="lender-confirm"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div className="lender-confirm-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="6" width="24" height="18" rx="3" stroke="#111" strokeWidth="1.5"/>
              <path d="M2 11l12 7.5L26 11" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="lender-confirm-title">Confirm your email</h2>
          <p className="lender-confirm-sub">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account and sign in.
          </p>
          <p className="lender-confirm-hint">Check your spam folder if you don't see it within a minute.</p>
          <button className="lender-back-btn" onClick={onBack}>← Back to mode selection</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="lender-auth-stage">
      <motion.div className="lender-auth-header"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="lender-auth-eyebrow">
          {role === 'property_owner' ? 'Property Owner' : 'Internal Lender'}
        </div>
        <h2 className="lender-auth-title">
          {tab === 'signin' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="lender-auth-sub">
          {tab === 'signin'
            ? (role === 'property_owner'
                ? 'Sign in to view your saved property reports.'
                : 'Sign in to access the full collateral assessment suite.')
            : (role === 'property_owner'
                ? 'Create a free account to save and share your property reports.'
                : 'Set up your lending professional account.')}
        </p>
      </motion.div>

      <motion.div className="lender-tabs"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <button className={`lender-tab ${tab === 'signin' ? 'lender-tab--active' : ''}`}
          onClick={() => switchTab('signin')}>Sign In</button>
        <button className={`lender-tab ${tab === 'signup' ? 'lender-tab--active' : ''}`}
          onClick={() => switchTab('signup')}>Sign Up</button>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div className="lender-fields" key={tab}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'signup' && (
            <input className="lender-input" type="text" placeholder="Full name"
              value={name} onChange={e => { setName(e.target.value); setError(''); }}
              autoComplete="name"
            />
          )}
          <input className="lender-input" type="email" placeholder="Email address"
            value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
          />
          <input className="lender-input" type="password" placeholder="Password"
            value={pass} onChange={e => { setPass(e.target.value); setError(''); }}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            onKeyDown={e => { if (e.key === 'Enter' && tab === 'signin') handleSignIn(); }}
          />
          {tab === 'signup' && (
            <input className="lender-input" type="password" placeholder="Confirm password"
              value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
              autoComplete="new-password"
              onKeyDown={e => { if (e.key === 'Enter') handleSignUp(); }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <motion.p className="lender-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.p>
      )}

      <button className="lender-submit-btn"
        onClick={tab === 'signin' ? handleSignIn : handleSignUp}
        disabled={loading}
      >
        {loading
          ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
          : (tab === 'signin' ? 'Sign In →' : 'Create Account →')}
      </button>

      <button className="lender-back-btn" onClick={onBack} disabled={loading}>← Back</button>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────────── */

export default function EntryScreen({ authLoading, onPropertyOwner }) {
  const [stage,      setStage]      = useState('cinematic');
  const [lenderTab,  setLenderTab]  = useState('signin');

  useEffect(() => {
    window.history.replaceState({ stage: 'cinematic' }, '');
    const onPop = (e) => setStage(e.state?.stage || 'cinematic');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const pushHistory = (s) => window.history.pushState({ stage: s }, '');

  if (authLoading) {
    return (
      <div className="entry-screen entry-screen--loading">
        <div className="entry-center">
          <div className="entry-wordmark" aria-label="COLLATIQ">
            {LETTERS.map((l, i) => <span key={i} className="entry-letter">{l}</span>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="entry-screen">
      <AnimatePresence mode="wait">
        {stage === 'cinematic' && (
          <motion.div key="cinematic" style={{ position: 'absolute', inset: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <CinematicStage onAdvance={() => { pushHistory('mode-select'); setStage('mode-select'); }} />
          </motion.div>
        )}

        {stage === 'mode-select' && (
          <motion.div key="mode-select" className="entry-light-stage"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <ModeSelectStage
              onPropertyOwner={() => setStage('po-form')}
              onPoSignIn={() => setStage('po-signin')}
              onLenderSignIn={() => { setLenderTab('signin'); setStage('lender-auth'); }}
              onLenderSignUp={() => { setLenderTab('signup'); setStage('lender-auth'); }}
              onBack={() => { pushHistory('cinematic'); setStage('cinematic'); }}
            />
          </motion.div>
        )}

        {stage === 'po-form' && (
          <motion.div key="po-form" className="entry-light-stage"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <PropertyOwnerFormStage
              onSubmit={(info) => onPropertyOwner(info)}
              onBack={() => setStage('mode-select')}
            />
          </motion.div>
        )}

        {stage === 'po-signin' && (
          <motion.div key="po-signin" className="entry-light-stage"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <LenderAuthStage role="property_owner" onBack={() => setStage('mode-select')} />
          </motion.div>
        )}

        {stage === 'lender-auth' && (
          <motion.div key="lender-auth" className="entry-light-stage"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <LenderAuthStage initialTab={lenderTab} onBack={() => setStage('mode-select')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
