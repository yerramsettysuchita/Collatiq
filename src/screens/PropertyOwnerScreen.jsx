import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { runCollatiqPipeline } from '../engine/pipeline';
import { signOut, signUpWithPassword, signInWithPassword } from '../lib/supabase';
import './PropertyOwnerScreen.css';

function fmt(n) {
  if (!n && n !== 0) return '—';
  const cr = n / 10000000;
  if (cr >= 1) return `₹${cr.toFixed(2)} Cr`;
  const lakh = n / 100000;
  return `₹${lakh.toFixed(1)} L`;
}

function HealthBadge({ score, band }) {
  const color = score >= 650 ? '#16A34A' : score >= 550 ? '#D97706' : '#DC2626';
  // Shorten verbose band text for compact display
  const shortBand = (band ?? 'N/A').split('—')[0].trim().split('.')[0].trim();
  return (
    <div className="po-health-badge" style={{ '--hc': color }}>
      <span className="po-health-score">{score ?? '—'}</span>
      <span className="po-health-band">{shortBand}</span>
    </div>
  );
}

function ConfidenceRing({ score }) {
  const pct = (score ?? 0) / 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`Confidence ${score}%`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--rule-2)" strokeWidth="3"/>
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="var(--ink-2)" strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '36px 36px' }}
      />
      <text x="36" y="40" textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: '11px', fill: 'var(--ink-3)' }}>
        {score ?? '—'}%
      </text>
    </svg>
  );
}

/* ── Derived logic ────────────────────────────────────────────────────────── */

function deriveReadiness(result) {
  let score = 100;
  const conf  = result.confidenceScore     ?? 0;
  const health = result.collateralHealthScore ?? 0;
  const rpi    = result.rpi                ?? 0;
  const ttlAvg = result.ttl_low != null && result.ttl_high != null
    ? (result.ttl_low + result.ttl_high) / 2
    : null;
  const flags  = result.fraudFlags?.length ?? 0;

  if (conf < 50)       score -= 30;
  else if (conf < 70)  score -= 15;
  else if (conf < 85)  score -= 5;

  if (health < 500)    score -= 25;
  else if (health < 600) score -= 12;
  else if (health < 650) score -= 5;

  if (rpi < 30)        score -= 20;
  else if (rpi < 50)   score -= 10;
  else if (rpi < 65)   score -= 3;

  if (ttlAvg != null) {
    if (ttlAvg > 180)  score -= 10;
    else if (ttlAvg > 90) score -= 4;
  }

  score -= flags * 15;
  score = Math.max(0, Math.min(100, score));

  let level, color, desc;
  if (score >= 80) {
    level = 'Ready';
    color = '#16A34A';
    desc  = 'Your property meets standard collateral benchmarks.';
  } else if (score >= 60) {
    level = 'Almost Ready';
    color = '#59A3E8';
    desc  = 'Minor gaps identified. A few improvements can unlock better terms.';
  } else if (score >= 40) {
    level = 'Needs Improvement';
    color = '#D97706';
    desc  = 'Significant gaps detected. Address the issues below before applying.';
  } else {
    level = 'High Risk';
    color = '#DC2626';
    desc  = 'Multiple critical issues found. Lender approval is unlikely without resolution.';
  }

  return { score, level, color, desc };
}

function deriveStrength(result) {
  const health = result.collateralHealthScore ?? 0;
  const rpi    = result.rpi ?? 0;
  if (health >= 650 && rpi >= 65) return { label: 'Strong',   color: '#16A34A', icon: '↑' };
  if (health >= 550 || rpi >= 45) return { label: 'Moderate', color: '#D97706', icon: '→' };
  return                                  { label: 'Weak',     color: '#DC2626', icon: '↓' };
}

function deriveLiquidity(result) {
  const ttlAvg = result.ttl_low != null && result.ttl_high != null
    ? (result.ttl_low + result.ttl_high) / 2
    : null;
  if (ttlAvg == null) return { label: 'Unknown', sub: 'Insufficient data', color: '#ADADAD' };
  if (ttlAvg <= 60)   return { label: 'Fast exit',     sub: `~${Math.round(ttlAvg)}d avg time-to-liquidate`, color: '#16A34A' };
  if (ttlAvg <= 120)  return { label: 'Moderate exit', sub: `~${Math.round(ttlAvg)}d avg time-to-liquidate`, color: '#D97706' };
  return                     { label: 'Slow exit',     sub: `~${Math.round(ttlAvg)}d avg time-to-liquidate`, color: '#DC2626' };
}

function deriveIssues(result) {
  const issues = [];
  const conf   = result.confidenceScore ?? 0;
  const health = result.collateralHealthScore ?? 0;
  const rpi    = result.rpi ?? 0;
  const ttlAvg = result.ttl_low != null && result.ttl_high != null
    ? (result.ttl_low + result.ttl_high) / 2
    : null;

  if (conf < 60)  issues.push('Low model confidence — upload additional documents or photos to improve accuracy.');
  if (health < 550) issues.push('Collateral health score below acceptable threshold for most lenders.');
  if (rpi < 40)   issues.push('Resale potential is low — property may be in a slow-moving micro-market.');
  if (ttlAvg != null && ttlAvg > 150) issues.push('High estimated time-to-liquidate reduces lender appeal.');

  (result.fraudFlags ?? []).forEach(f => issues.push(f));

  const drivers = result.confidenceDrivers ?? [];
  drivers.filter(d => d.direction === 'negative' || d.impact < 0)
    .forEach(d => { if (d.label) issues.push(d.label); });

  return issues.slice(0, 5);
}

function deriveActions(result) {
  const actions = [];
  const conf   = result.confidenceScore ?? 0;
  const health = result.collateralHealthScore ?? 0;
  const rpi    = result.rpi ?? 0;
  const area   = result.area;
  const flags  = result.fraudFlags?.length ?? 0;

  if (flags > 0)     actions.push({ priority: 'high',   text: 'Resolve flagged legal or documentation issues before submission.' });
  if (conf < 70)     actions.push({ priority: 'high',   text: 'Upload current photos of the property interior and exterior.' });
  if (!area || area === '1000') actions.push({ priority: 'medium', text: 'Confirm exact built-up area with sale deed or occupancy certificate.' });
  if (health < 600)  actions.push({ priority: 'medium', text: 'Obtain a fresh legal search report (last 15 years) to strengthen the file.' });
  if (rpi < 50)      actions.push({ priority: 'low',    text: 'Consider comparable listings nearby — pricing close to market may improve liquidity.' });

  actions.push({ priority: 'low', text: 'Run a full assessment for a detailed LTV report with traceable audit trail.' });
  return actions.slice(0, 5);
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function ReadinessScore({ result }) {
  const { score, level, color, desc } = deriveReadiness(result);
  const pct = score;
  return (
    <div className="po-readiness" style={{ '--rc': color }}>
      <div className="po-readiness-top">
        <div className="po-readiness-left">
          <div className="po-readiness-label">Property Readiness Score</div>
          <div className="po-readiness-level">{level}</div>
          <div className="po-readiness-desc">{desc}</div>
        </div>
        <div className="po-readiness-gauge">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="6"/>
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={color} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
              strokeDashoffset={2 * Math.PI * 32 * 0.25}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px', transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
            />
            <text x="40" y="44" textAnchor="middle"
              style={{ fontFamily: 'var(--serif)', fontSize: '16px', fill: color, fontWeight: 400 }}>
              {score}
            </text>
          </svg>
        </div>
      </div>
      <div className="po-readiness-bar-wrap">
        <div className="po-readiness-bar">
          <div className="po-readiness-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function CollateralProfile({ result }) {
  const str = deriveStrength(result);
  const liq = deriveLiquidity(result);
  return (
    <div className="po-profile">
      <div className="po-profile-cell">
        <div className="po-profile-key">Collateral Strength</div>
        <div className="po-profile-val" style={{ color: str.color }}>
          <span className="po-profile-icon">{str.icon}</span> {str.label}
        </div>
      </div>
      <div className="po-profile-divider" />
      <div className="po-profile-cell">
        <div className="po-profile-key">Liquidity Outlook</div>
        <div className="po-profile-val" style={{ color: liq.color }}>{liq.label}</div>
        <div className="po-profile-sub">{liq.sub}</div>
      </div>
    </div>
  );
}

function KeyIssues({ result }) {
  const issues = deriveIssues(result);
  if (issues.length === 0) return null;
  return (
    <div className="po-issues">
      <div className="po-issues-label">Key Issues</div>
      <ul className="po-issues-list">
        {issues.map((iss, i) => (
          <li key={i} className="po-issue-item">{iss}</li>
        ))}
      </ul>
    </div>
  );
}

function NextActions({ result, onAssess }) {
  const actions = deriveActions(result);
  return (
    <div className="po-actions">
      <div className="po-actions-label">Next Best Actions</div>
      <ul className="po-actions-list">
        {actions.map((a, i) => (
          <li key={i} className={`po-action-item po-action-item--${a.priority}`}>
            <span className="po-action-dot" />
            {a.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Chip options ─────────────────────────────────────────────────────────── */

const TYPE_OPTIONS = [
  { id: 'residential', label: 'Residential' },
  { id: 'commercial',  label: 'Commercial'  },
];

const AGE_OPTIONS = [
  { id: 'new', label: 'Under 5 years' },
  { id: 'mid', label: '5 – 15 years'  },
  { id: 'old', label: 'Above 15 years'},
];

/* ── Main screen ──────────────────────────────────────────────────────────── */

function CreateAccountSection() {
  const [tab,      setTab]      = useState('signup'); // 'signup' | 'signin'
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);
  const [needsMail,setNeedsMail]= useState(false); // email confirmation required

  const handleSignUp = async () => {
    if (!email || !pass)  { setError('Please fill in all fields.'); return; }
    if (pass.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    if (pass !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      localStorage.setItem('collatiq_pending_role', 'property_owner');
      const data = await signUpWithPassword(email.trim(), pass);
      if (!data.session) {
        setNeedsMail(true); // email confirmation required
      }
      setDone(true); // always show confirmation screen
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email taken')) {
        setError('An account with this email already exists. Switch to Sign In below.');
        setTab('signin');
      } else {
        setError(e.message || 'Sign up failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !pass) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      await signInWithPassword(email.trim(), pass);
    } catch (e) {
      const msg = e.message || '';
      setError(msg.toLowerCase().includes('invalid') ? 'Incorrect email or password.' : msg || 'Sign in failed.');
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="po-create-account po-create-account--done">
        {needsMail ? (
          <>
            <div className="po-ca-icon">✉</div>
            <h3 className="po-ca-title">Check your email</h3>
            <p className="po-ca-sub">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account and sign in.
            </p>
            <p className="po-ca-sub" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              Check your spam folder if you don't see it.
            </p>
          </>
        ) : (
          <>
            <div className="po-ca-icon">✓</div>
            <h3 className="po-ca-title">Account created!</h3>
            <p className="po-ca-sub">
              Signing you in as <strong>{email}</strong>…
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="po-create-account">
      <div className="po-ca-header">
        <h3 className="po-ca-title">Get the full detailed report</h3>
        <p className="po-ca-sub">Create a free account to access risk flags, LTV recommendations, and a shareable PDF.</p>
      </div>
      <div className="po-ca-tabs">
        <button className={`po-ca-tab ${tab === 'signup' ? 'po-ca-tab--active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>Create Account</button>
        <button className={`po-ca-tab ${tab === 'signin' ? 'po-ca-tab--active' : ''}`} onClick={() => { setTab('signin'); setError(''); }}>Sign In</button>
      </div>
      <div className="po-ca-fields">
        <input className="po-ca-input" type="email" placeholder="Email address"
          value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
        <input className="po-ca-input" type="password" placeholder="Password (min 8 chars)"
          value={pass} onChange={e => { setPass(e.target.value); setError(''); }} />
        {tab === 'signup' && (
          <input className="po-ca-input" type="password" placeholder="Confirm password"
            value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} />
        )}
      </div>
      {error && <p className="po-ca-error">{error}</p>}
      <button className="po-ca-btn" onClick={tab === 'signup' ? handleSignUp : handleSignIn} disabled={loading}>
        {loading ? (tab === 'signup' ? 'Creating account…' : 'Signing in…') : (tab === 'signup' ? 'Create Account →' : 'Sign In →')}
      </button>
    </div>
  );
}

export default function PropertyOwnerScreen({ onAssess, user, contactInfo }) {
  const [address,     setAddress]     = useState('');
  const [propType,    setPropType]    = useState('residential');
  const [age,         setAge]         = useState('mid');
  const [area,        setArea]        = useState('');
  const [running,     setRunning]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const debounceRef = useRef(null);

  const handleAddressChange = (e) => {
    const val = e.target.value;
    setAddress(val);
    setError('');
    clearTimeout(debounceRef.current);
    if (val.trim().length < 4) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&countrycodes=in&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const names = data.map(d => d.display_name);
        setSuggestions(names);
        setShowSugg(names.length > 0);
      } catch { setSuggestions([]); }
    }, 350);
  };

  const handleSuggSelect = (s) => {
    setAddress(s);
    setSuggestions([]);
    setShowSugg(false);
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || contactInfo?.name?.split(' ')[0]
    || 'there';

  const handleEstimate = async () => {
    if (!address.trim() || address.trim().length < 8) {
      setError('Please enter a valid property address.');
      return;
    }
    setError('');
    setRunning(true);
    setResult(null);
    try {
      const formInput = {
        address: address.trim(),
        type:     propType,
        subtype:  propType === 'residential' ? 'apartment' : 'office',
        area:     area ? String(area) : '1000',
        age,
        occupancy: 'self',
        legal:    'clear',
        lat: null,
        lng: null,
      };
      const res = await runCollatiqPipeline(formInput);
      setResult(res);
    } catch {
      setError('Could not generate an estimate. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="po-screen">
      {/* Topbar */}
      <header className="po-topbar">
        <div className="po-logo">
          <div className="po-logo-mark">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="5" height="5" fill="currentColor"/>
              <rect x="8" y="1" width="5" height="5" fill="currentColor" opacity="0.5"/>
              <rect x="1" y="8" width="5" height="5" fill="currentColor" opacity="0.5"/>
              <rect x="8" y="8" width="5" height="5" fill="currentColor"/>
            </svg>
          </div>
          <span className="po-logo-text">Collat<em>iq</em></span>
        </div>
        <div className="po-topbar-right">
          {user && (
            <button className="po-signout-btn" onClick={() => signOut()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="po-main">
        {/* Hero */}
        <motion.div
          className="po-hero"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="po-greeting">Welcome back, {firstName}.</div>
          <h1 className="po-title">
            Understand your<br />
            property's value.
          </h1>
          <p className="po-sub">
            Enter your property address below to get an instant market value estimate,
            liquidity score, and collateral readiness rating.
          </p>
        </motion.div>

        {/* Input card */}
        <motion.div
          className="po-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="po-field po-autocomplete-wrap">
            <label className="po-label" htmlFor="po-address">Property address</label>
            <input
              id="po-address"
              className="po-input"
              type="text"
              placeholder="e.g. Bandra West Mumbai or Koramangala Bengaluru"
              value={address}
              onChange={handleAddressChange}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSugg(false); handleEstimate(); } if (e.key === 'Escape') setShowSugg(false); }}
              onBlur={() => setTimeout(() => setShowSugg(false), 180)}
              onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
              disabled={running}
              autoComplete="off"
            />
            {showSugg && (
              <ul className="po-suggestions">
                {suggestions.map((s, i) => (
                  <li key={i} className="po-suggestion-item" onMouseDown={() => handleSuggSelect(s)}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.4 }}>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="po-row">
            <div className="po-field po-field--half">
              <label className="po-label">Property type</label>
              <div className="po-chips">
                {TYPE_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    className={`po-chip ${propType === t.id ? 'active' : ''}`}
                    onClick={() => setPropType(t.id)}
                    disabled={running}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="po-field po-field--half">
              <label className="po-label">Building age</label>
              <div className="po-chips">
                {AGE_OPTIONS.map(a => (
                  <button
                    key={a.id}
                    className={`po-chip ${age === a.id ? 'active' : ''}`}
                    onClick={() => setAge(a.id)}
                    disabled={running}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="po-field po-field--sm">
            <label className="po-label" htmlFor="po-area">Built-up area (sq ft) — optional</label>
            <input
              id="po-area"
              className="po-input po-input--sm"
              type="number"
              min="100"
              max="50000"
              placeholder="e.g. 1200"
              value={area}
              onChange={e => setArea(e.target.value)}
              disabled={running}
            />
          </div>

          {error && <p className="po-error">{error}</p>}

          <button
            className="po-estimate-btn"
            onClick={handleEstimate}
            disabled={running || !address.trim()}
          >
            {running ? (
              <span className="po-estimate-loading">
                <span className="po-spinner" />
                Analysing…
              </span>
            ) : (
              'Get instant estimate'
            )}
          </button>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              className="po-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Results header */}
              <div className="po-results-header">
                <div className="po-results-address">{address}</div>
                <div className={`po-verdict po-verdict--${(result.verdict || '').toLowerCase().replace(/\s+/g, '-')}`}>
                  {result.verdict || 'Report ready'}
                </div>
              </div>

              {/* Readiness score — top of results */}
              <ReadinessScore result={result} />

              {/* Market metrics */}
              <div className="po-metrics">
                <div className="po-metric">
                  <div className="po-metric-label">Market value</div>
                  <div className="po-metric-value">
                    {fmt(result.mv_low)} – {fmt(result.mv_high)}
                  </div>
                  <div className="po-metric-sub">Estimated resale value</div>
                </div>

                <div className="po-metric">
                  <div className="po-metric-label">Distress sale</div>
                  <div className="po-metric-value">
                    {fmt(result.dv_low)} – {fmt(result.dv_high)}
                  </div>
                  <div className="po-metric-sub">Quick liquidation range</div>
                </div>

                <div className="po-metric po-metric--health">
                  <div className="po-metric-label">Health score</div>
                  <HealthBadge score={result.collateralHealthScore} band={result.collateralHealthBand} />
                  <div className="po-metric-sub">Out of 820</div>
                </div>

                <div className="po-metric po-metric--conf">
                  <div className="po-metric-label">Confidence</div>
                  <ConfidenceRing score={result.confidenceScore} />
                  <div className="po-metric-sub">Model confidence</div>
                </div>
              </div>

              {/* Collateral profile */}
              <CollateralProfile result={result} />

              {/* Resale potential index */}
              {result.rpi != null && (
                <div className="po-rpi-row">
                  <span className="po-rpi-label">Resale potential index</span>
                  <div className="po-rpi-bar-wrap">
                    <div className="po-rpi-bar">
                      <div className="po-rpi-fill" style={{ width: `${Math.min(100, result.rpi)}%` }} />
                    </div>
                    <span className="po-rpi-num">{result.rpi}/100</span>
                  </div>
                </div>
              )}

              {/* Fraud flags */}
              {result.fraudFlags?.length > 0 && (
                <div className="po-flags">
                  <div className="po-flags-label">Attention</div>
                  {result.fraudFlags.map((f, i) => (
                    <div key={i} className="po-flag-item">&#9888; {f}</div>
                  ))}
                </div>
              )}

              {/* Key issues */}
              <KeyIssues result={result} />

              {/* Next best actions */}
              <NextActions result={result} onAssess={onAssess} />

              <p className="po-disclaimer">
                This estimate is generated by an AI model and is indicative only. It is not a formal
                valuation. Collatiq assumes no liability for decisions made on the basis of this output.
              </p>

              {/* Create account prompt — only shown in public (unauthenticated) mode */}
              {!user && (
                <CreateAccountSection />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
