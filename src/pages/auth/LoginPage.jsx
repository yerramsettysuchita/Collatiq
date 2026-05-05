import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from '../../lib/auth';
import { getCurrentProfile, getRoleRedirect } from '../../lib/auth';
import '../../styles/platform.css';

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const nextParam = new URLSearchParams(location.search).get('next');
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(form.email, form.password);
      if (nextParam === 'lender') {
        navigate('/lender/dashboard', { replace: true });
      } else if (nextParam === 'full-estimate') {
        navigate('/owner/new-case', { replace: true });
      } else if (nextParam === 'assess') {
        navigate('/role-select', { replace: true });
      } else {
        const profile = await getCurrentProfile();
        navigate(getRoleRedirect(profile?.role), { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/" className="auth-left-logo">Collat<em>iq</em></Link>
        <h1 className="auth-left-heading">Real-time collateral intelligence for Indian lending.</h1>
        <p className="auth-left-sub">Sign in to access your property assessments or your lender workspace.</p>
      </div>
      <div className="auth-right">
        <h2 className="auth-form-title">Sign in</h2>
        <p className="auth-form-sub">Enter your email and password to continue.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="plat-field">
            <label className="plat-label">Email</label>
            <input className="plat-input" type="email" required autoComplete="email"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="plat-field">
            <label className="plat-label">Password</label>
            <div className="pw-wrapper">
              <input className="plat-input" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button className="plat-btn plat-btn--primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
        <div className="auth-footer-link">
          New here? <Link to={nextParam ? `/signup?next=${nextParam}` : '/signup'}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}
