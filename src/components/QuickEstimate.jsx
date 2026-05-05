import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { runCollatiqPipeline } from '../engine/pipeline';
import { signInWithGoogle } from '../lib/supabase';
import './QuickEstimate.css';

function formatINR(val) {
  if (!val) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)} L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="qe-card">
      <div className="qe-card-label">{label}</div>
      <div className={`qe-card-value ${accent ? 'qe-card-value--accent' : ''}`}>{value}</div>
      {sub && <div className="qe-card-sub">{sub}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="qe-spinner-wrap">
      <div className="qe-spinner" />
      <span className="qe-spinner-label">Running partial analysis…</span>
    </div>
  );
}

export default function QuickEstimate({ address, onClose }) {
  const [status,  setStatus]  = useState('loading'); // loading | done | error
  const [results, setResults] = useState(null);
  const [signInLoading, setSignInLoading] = useState(false);

  const run = async () => {
    setStatus('loading');
    try {
      const data = await runCollatiqPipeline({
        address,
        type: 'apartment',
        age: '5',
        areaSqft: '1000',
        floor: '2',
        totalFloors: '5',
        facing: 'north',
        legalStatus: 'clear',
        occupancy: 'owner',
        loanAmount: '',
      });
      setResults(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  // Auto-run on mount
  useEffect(() => { run(); }, []); // eslint-disable-line

  const handleSignIn = async () => {
    setSignInLoading(true);
    try { await signInWithGoogle(); } catch { setSignInLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="qe-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="qe-modal"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="qe-header">
            <div className="qe-header-left">
              <div className="qe-eyebrow">Quick Estimate</div>
              <div className="qe-address">{address}</div>
            </div>
            <button className="qe-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="qe-body">
            {status === 'loading' && <Spinner />}

            {status === 'error' && (
              <div className="qe-error">
                Could not compute estimate. Check the address and try again.
              </div>
            )}

            {status === 'done' && results && (
              <>
                {/* 3 visible metric cards */}
                <div className="qe-cards">
                  <MetricCard
                    label="Market Value Range"
                    value={`${formatINR(results.mv_low)} – ${formatINR(results.mv_high)}`}
                    sub="Mid-market estimate"
                  />
                  <MetricCard
                    label="Distress Sale Value"
                    value={`${formatINR(results.dv_low)} – ${formatINR(results.dv_high)}`}
                    sub="Forced liquidation scenario"
                  />
                  <MetricCard
                    label="Resale Potential Index"
                    value={`${results.rpi ?? '—'} / 100`}
                    sub={results.rpi >= 70 ? 'High liquidity' : results.rpi >= 45 ? 'Moderate liquidity' : 'Low liquidity'}
                    accent
                  />
                </div>

                {/* Blurred locked section */}
                <div className="qe-locked-wrap">
                  <div className="qe-locked-cards" aria-hidden="true">
                    <div className="qe-card qe-card--blur">
                      <div className="qe-card-label">Confidence Score</div>
                      <div className="qe-card-value">██ / 100</div>
                      <div className="qe-card-sub">██████ tier</div>
                    </div>
                    <div className="qe-card qe-card--blur">
                      <div className="qe-card-label">Fraud Risk</div>
                      <div className="qe-card-value">██ flags</div>
                      <div className="qe-card-sub">No ████████ detected</div>
                    </div>
                    <div className="qe-card qe-card--blur">
                      <div className="qe-card-label">Verdict</div>
                      <div className="qe-card-value">████████ ████████</div>
                      <div className="qe-card-sub">LTV ██–██%</div>
                    </div>
                  </div>
                  <div className="qe-lock-gate">
                    <div className="qe-lock-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="4" y="9" width="12" height="9" rx="2"
                          stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M7 9V6.5a3 3 0 0 1 6 0V9"
                          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="qe-lock-title">Sign in to see the full report</p>
                    <p className="qe-lock-sub">
                      Confidence score, fraud flags, verdict, and recommended LTV are available after sign-in.
                    </p>
                    <button
                      className="qe-signin-btn"
                      onClick={handleSignIn}
                      disabled={signInLoading}
                    >
                      {signInLoading ? 'Redirecting…' : 'Continue with Google'}
                    </button>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="qe-disclaimer">
                  Indicative estimate only. Default assumptions used: apartment, 1,000 sq ft, 5 years old. Run a full assessment for property-specific outputs.
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
