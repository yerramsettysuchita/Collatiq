import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import './AuthScreen.css';

/* ── Eye icon for password toggle ─────────────────────────────────────────── */
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
        stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010.4 9.5M4.2 4.3C2.8 5.3 1.5 6.8 1 8c1.2 3 4 5 7 5 1.4 0 2.7-.4 3.8-1.1M6.3 3.2C6.8 3.1 7.4 3 8 3c3 0 5.8 2 7 5-.4.9-.9 1.8-1.6 2.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Email confirmation pending screen ─────────────────────────────────────── */
function ConfirmPending({ email, onBack }) {
  return (
    <motion.div
      className="auth-confirm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="auth-confirm-icon">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="10" width="32" height="22" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 13l16 11 16-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="auth-confirm-title">Check your inbox</h2>
      <p className="auth-confirm-sub">
        We sent a confirmation link to <strong>{email}</strong>.
        Click it to activate your account, then return here to sign in.
      </p>
      <button className="auth-confirm-back" onClick={onBack}>
        Back to sign in
      </button>
    </motion.div>
  );
}

/* ── Main auth screen ──────────────────────────────────────────────────────── */
export default function AuthScreen({ onBack, onAuthSuccess }) {
  const [mode,           setMode]           = useState('signup'); // 'signup' | 'signin'
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPw,         setShowPw]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [confirmPending, setConfirmPending] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) {
          // Email confirmation disabled — auto logged in
          onAuthSuccess(data.user);
        } else {
          // Email confirmation required
          setConfirmPending(true);
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuthSuccess(data.user);
      }
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      // Make Supabase error messages friendlier
      if (msg.toLowerCase().includes('invalid login'))
        setError('Incorrect email or password. Please try again.');
      else if (msg.toLowerCase().includes('already registered'))
        setError('This email is already registered. Try signing in instead.');
      else if (msg.toLowerCase().includes('network'))
        setError('Connection error. Please check your internet and try again.');
      else
        setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (confirmPending) {
    return (
      <div className="auth-screen">
        <button className="auth-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <ConfirmPending email={email} onBack={() => { setConfirmPending(false); switchMode('signin'); }} />
      </div>
    );
  }

  return (
    <div className="auth-screen">
      {/* Back */}
      <button className="auth-back-btn" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </button>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" fill="currentColor"/>
              <rect x="8" y="1" width="5" height="5" fill="currentColor" opacity="0.5"/>
              <rect x="1" y="8" width="5" height="5" fill="currentColor" opacity="0.5"/>
              <rect x="8" y="8" width="5" height="5" fill="currentColor"/>
            </svg>
          </div>
          <span className="auth-logo-text">Collat<em>iq</em></span>
        </div>

        <h1 className="auth-headline">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="auth-sub">
          {mode === 'signup'
            ? 'Sign up to run your first collateral assessment.'
            : 'Sign in to continue your assessments.'}
        </p>

        {/* Mode tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <div className="auth-pw-wrap">
              <input
                id="auth-password"
                className="auth-input auth-input--pw"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="auth-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1.5L1 11.5h11L6.5 1.5z" stroke="currentColor"
                    strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M6.5 5.5v2.5" stroke="currentColor" strokeWidth="1.2"
                    strokeLinecap="round"/>
                  <circle cx="6.5" cy="9.5" r="0.55" fill="currentColor"/>
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : mode === 'signup' ? (
              <>Create account and run estimate
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            ) : (
              <>Sign in and continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer trust line */}
        <div className="auth-trust">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round"/>
          </svg>
          Secured by Supabase · No billing required
        </div>
      </motion.div>
    </div>
  );
}
