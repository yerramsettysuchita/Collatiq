import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AccessPropertyPage.css';

export default function AccessPropertyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleLender = () => {
    // Skip login if already authenticated as a lender
    if (user && profile?.role && profile.role !== 'borrower') {
      navigate('/lender/dashboard');
    } else {
      navigate('/login?next=lender');
    }
  };

  return (
    <div className="ap-page">
      <div className="ap-wrap">
        <Link to="/" className="ap-logo">Collat<em>iq</em></Link>

        <div className="ap-header">
          <h1 className="ap-heading">How would you like to continue?</h1>
          <p className="ap-sub">
            Choose your path — owners get a free instant estimate, lenders access their secure workspace.
          </p>
        </div>

        <div className="ap-options">
          {/* ── Owner ─────────────────────────────────────── */}
          <Link to="/owner/estimate" className="ap-option ap-option--owner">
            <div className="ap-option-top">
              <div className="ap-icon ap-icon--owner">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M4 16L16 4l12 12v12H4V16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M11 28v-8h10v8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="ap-badge ap-badge--free">Free · No sign-in needed</span>
            </div>
            <div className="ap-option-title">I'm a property owner</div>
            <div className="ap-option-desc">
              Get a free indicative market-value estimate for your property in under 30 seconds.
              No account required — sign up only to unlock the full report.
            </div>
            <div className="ap-option-cta">
              Get free estimate
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>

          {/* ── Lender ─────────────────────────────────────── */}
          <button className="ap-option ap-option--lender" onClick={handleLender} type="button">
            <div className="ap-option-top">
              <div className="ap-icon ap-icon--lender">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="3" y="10" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M10 10V8a6 6 0 0112 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <circle cx="16" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M16 21.5V24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="ap-badge ap-badge--lender">Secure portal</span>
            </div>
            <div className="ap-option-title">I'm an NBFC / Lender</div>
            <div className="ap-option-desc">
              Sign in to your lender workspace. Review AI-generated collateral valuations,
              manage your pipeline, and monitor portfolio exposure.
            </div>
            <div className="ap-option-cta">
              Go to lender workspace
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>

        <p className="ap-footer">
          <Link to="/" className="ap-back">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
