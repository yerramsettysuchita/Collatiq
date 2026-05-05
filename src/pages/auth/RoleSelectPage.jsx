import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import './RoleSelectPage.css';

const SUPABASE_CONFIGURED = !!(
  process.env.REACT_APP_SUPABASE_URL &&
  process.env.REACT_APP_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.REACT_APP_SUPABASE_ANON_KEY &&
  process.env.REACT_APP_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
);

const SAVE_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
    ),
  ]);
}

export default function RoleSelectPage() {
  const navigate                    = useNavigate();
  const { user, refreshProfile }    = useAuth();
  const [selected, setSelected]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const handleSelect = (role) => {
    if (saving) return;
    setSelected(role);
    setError('');
  };

  const handleContinue = async () => {
    if (!selected || saving) return;

    // Capture destination from local state immediately — never read from profile
    const destination = selected === 'lender' ? '/lender/dashboard' : '/owner/new-case';

    setSaving(true);
    setError('');

    if (SUPABASE_CONFIGURED && user) {
      try {
        const dbRole = selected === 'lender' ? 'lender' : 'borrower';

        // Upsert (not update) — works whether or not the profile row exists yet
        const fullName = user.user_metadata?.full_name || '';
        const saveOp = supabase
          .from('profiles')
          .upsert(
            { id: user.id, email: user.email, role: dbRole, full_name: fullName },
            { onConflict: 'id' }
          );

        await withTimeout(saveOp, SAVE_TIMEOUT_MS);

        // Refresh AuthContext so ProtectedRoute reads the new role immediately
        if (refreshProfile) await withTimeout(refreshProfile(), 4000);

      } catch (err) {
        // Non-fatal: show warning but don't block the user
        console.warn('[RoleSelect] save failed:', err.message);
        setError('Role could not be saved — you can still continue and update it later.');
        // Give the user 2 s to read the error, then navigate anyway
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setSaving(false);
    navigate(destination, { replace: true });
  };

  return (
    <div className="rs-page">
      <div className="rs-card">
        <Link to="/" className="rs-logo">Collat<em>iq</em></Link>

        <div className="rs-header">
          <h1 className="rs-heading">How would you like to continue?</h1>
          <p className="rs-sub">Choose your role to access the right workspace.</p>
        </div>

        {error && <div className="rs-error">{error}</div>}

        <div className="rs-options">
          {/* Owner card */}
          <button
            className={`rs-option ${selected === 'owner' ? 'rs-option--selected' : ''}`}
            onClick={() => handleSelect('owner')}
            type="button"
            disabled={saving}
          >
            <div className="rs-option-icon rs-option-icon--owner">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M4 16L16 4l12 12v12H4V16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M11 28v-8h10v8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="rs-option-body">
              <div className="rs-option-title">I'm a property owner</div>
              <div className="rs-option-desc">Submit property details, get an instant valuation report, and track your assessment status.</div>
            </div>
            <div className="rs-option-check" aria-hidden="true">
              {selected === 'owner' ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#5B6EF5"/>
                  <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#d1d5db" strokeWidth="1.5"/>
                </svg>
              )}
            </div>
          </button>

          {/* Lender card */}
          <button
            className={`rs-option ${selected === 'lender' ? 'rs-option--selected' : ''}`}
            onClick={() => handleSelect('lender')}
            type="button"
            disabled={saving}
          >
            <div className="rs-option-icon rs-option-icon--lender">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect x="3" y="10" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M10 10V8a6 6 0 0112 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="16" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M16 21.5V24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="rs-option-body">
              <div className="rs-option-title">I'm an NBFC / Lender</div>
              <div className="rs-option-desc">Review collateral cases, approve or reject valuations, and monitor your lending portfolio.</div>
            </div>
            <div className="rs-option-check" aria-hidden="true">
              {selected === 'lender' ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#16A34A"/>
                  <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#d1d5db" strokeWidth="1.5"/>
                </svg>
              )}
            </div>
          </button>
        </div>

        <button
          className={`rs-continue ${selected ? 'rs-continue--active' : ''}`}
          onClick={handleContinue}
          disabled={!selected || saving}
          type="button"
        >
          {saving
            ? <><span className="rs-spinner" /> Saving…</>
            : selected
              ? `Continue as ${selected === 'owner' ? 'Property Owner' : 'Lender'} →`
              : 'Select a role to continue'}
        </button>

        <p className="rs-footer-note">
          You can change this later in your profile.{' '}
          <Link to="/" className="rs-footer-link">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
