import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AppShell.css';

const OWNER_NAV = [
  { to: '/owner/dashboard', label: 'Dashboard',     icon: '⊞' },
  { to: '/owner/new-case',  label: 'New assessment', icon: '+' },
  { to: '/owner/cases',     label: 'My cases',       icon: '≡' },
];

const LENDER_NAV = [
  { to: '/lender/dashboard',  label: 'Dashboard',     icon: '⊞' },
  { to: '/lender/cases',      label: 'All cases',     icon: '≡' },
  { to: '/lender/review',     label: 'Review queue',  icon: '◎' },
  { to: '/lender/monitoring', label: 'Monitoring',    icon: '⌖' },
];

export default function AppShell({ children, variant = 'owner' }) {
  const { user, profile, signOut, supabaseConfigured } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const nav       = variant === 'lender' ? LENDER_NAV : OWNER_NAV;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Fall back chain: profile full_name → auth metadata name → profile email → auth email → generic
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    profile?.email ||
    user?.email ||
    (supabaseConfigured ? 'User' : 'Preview');

  const displayRole = profile?.role || (variant === 'lender' ? 'lender' : 'borrower');

  return (
    <>
      {!supabaseConfigured && (
        <div className="shell-preview-banner">
          Preview mode — connect Supabase to enable real auth and data persistence.
          &nbsp;<Link to="/login" className="shell-preview-link">Set up auth →</Link>
        </div>
      )}
      <div className={`app-shell app-shell--${variant}${!supabaseConfigured ? ' shell-preview-offset' : ''}`}>
        <aside className="shell-sidebar">
          <div className="shell-brand">
            <Link to="/" className="shell-logo">Collat<em>iq</em></Link>
            <span className={`shell-role-badge shell-role-badge--${variant}`}>
              {variant === 'lender' ? 'Lender workspace' : 'My portal'}
            </span>
          </div>

          <nav className="shell-nav">
            {nav.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`shell-nav-item ${location.pathname.startsWith(item.to) ? 'active' : ''}`}
              >
                <span className="shell-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="shell-footer">
            <div className="shell-user">
              <div className="shell-avatar">
                {(displayName[0] || '?').toUpperCase()}
              </div>
              <div className="shell-user-info">
                <div className="shell-user-name">{displayName}</div>
                <div className="shell-user-role" style={{ textTransform: 'capitalize' }}>{displayRole}</div>
              </div>
            </div>
            {supabaseConfigured ? (
              <button className="shell-signout" onClick={handleSignOut}>Sign out</button>
            ) : (
              <Link to="/login" className="shell-signout" style={{ display: 'block', textAlign: 'left', textDecoration: 'none' }}>
                Sign in →
              </Link>
            )}
          </div>
        </aside>

        <main className="shell-content">
          {children}
        </main>
      </div>
    </>
  );
}
