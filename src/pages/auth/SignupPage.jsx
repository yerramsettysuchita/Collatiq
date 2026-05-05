import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signUpWithEmailAndPassword } from '../../lib/auth';
import '../../styles/platform.css';

function friendlyError(msg) {
  if (!msg) return 'Sign up failed. Please try again.';
  if (msg.includes('Database error saving new user') || msg.includes('database error'))
    return 'Account creation failed — the database is not set up yet. Run the SQL migration in your Supabase dashboard first.';
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered'))
    return 'An account with this email already exists. Sign in instead.';
  if (msg.includes('Password should be at least'))
    return 'Password must be at least 8 characters.';
  return msg;
}

export default function SignupPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const nextParam = new URLSearchParams(location.search).get('next');
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { session } = await signUpWithEmailAndPassword(form.email, form.password, form.name);
      if (session) {
        let dest = '/owner/dashboard';
        if (nextParam === 'lender' || nextParam === 'assess') dest = '/role-select';
        if (nextParam === 'full-estimate') dest = '/owner/new-case';
        navigate(dest, { replace: true });
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <Link to="/" className="auth-left-logo">Collat<em>iq</em></Link>
          <h1 className="auth-left-heading">One more step.</h1>
          <p className="auth-left-sub">Check your inbox to confirm your email address.</p>
        </div>
        <div className="auth-right">
          <h2 className="auth-form-title">Check your email</h2>
          <p className="auth-form-sub">We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account, then sign in.</p>
          <div className="auth-footer-link" style={{ marginTop: 24 }}>
            <Link to="/login">Back to sign in →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/" className="auth-left-logo">Collat<em>iq</em></Link>
        <h1 className="auth-left-heading">Check your property's collateral value in under thirty seconds.</h1>
        <p className="auth-left-sub">Create an account to get a full indicative assessment, save your results, and track your case.</p>
      </div>
      <div className="auth-right">
        <h2 className="auth-form-title">Create account</h2>
        <p className="auth-form-sub">Free for property owners. Your data is never shared.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="plat-field">
            <label className="plat-label">Full name</label>
            <input className="plat-input" type="text" required
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="plat-field">
            <label className="plat-label">Email</label>
            <input className="plat-input" type="email" required autoComplete="email"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="plat-field">
            <label className="plat-label">Password</label>
            <div className="pw-wrapper">
              <input className="plat-input" type={showPw ? 'text' : 'password'} required autoComplete="new-password"
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
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>
        <div className="auth-footer-link">
          Already have an account? <Link to={nextParam ? `/login?next=${nextParam}` : '/login'}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
