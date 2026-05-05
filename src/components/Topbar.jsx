import { useState, useEffect } from 'react';
import './Topbar.css';

export default function Topbar({ onAssess, onRecent, user, onSignOut }) {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const email        = user?.email || '';
  const initials     = email ? email[0].toUpperCase() : '';
  const displayEmail = email.length > 20 ? email.slice(0, 18) + '…' : email;

  return (
    <>
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        {/* ── Logo ── */}
        <div className="topbar-logo">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'none' }}
          >
            <div className="logo-mark">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" fill="white"/>
                <rect x="8" y="1" width="5" height="5" fill="white" opacity="0.5"/>
                <rect x="1" y="8" width="5" height="5" fill="white" opacity="0.5"/>
                <rect x="8" y="8" width="5" height="5" fill="white"/>
              </svg>
            </div>
            <span className="logo-text">Collat<em>iq</em></span>
          </button>
        </div>

        {/* ── Centre nav — only shown when onRecent is provided ── */}
        <nav className="topbar-nav">
          {onRecent && (
            <button
              className="topbar-nav-link"
              onClick={e => { e.preventDefault(); onRecent(); }}
            >
              Recent assessments
            </button>
          )}
        </nav>

        {/* ── Right side ── */}
        <div className="topbar-right">
          {user ? (
            /* Signed-in state */
            <div className="topbar-user">
              <div className="topbar-avatar" title={email}>
                <span className="topbar-avatar-initials">{initials}</span>
              </div>
              <span className="topbar-user-email">{displayEmail}</span>
              <button className="topbar-signout" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            /* Anonymous state */
            <div className="engine-status">
              <span className="status-dot" />
              <span className="status-label">Engine active</span>
            </div>
          )}

          <button
            className="topbar-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Mobile full-screen overlay ── */}
      {menuOpen && (
        <div className="topbar-overlay" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            className="topbar-overlay-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          <nav className="topbar-overlay-nav">
            <button onClick={() => { setMenuOpen(false); onAssess?.(); }}>
              Assess a property
            </button>
            {onRecent && (
              <button onClick={() => { setMenuOpen(false); onRecent(); }}>
                Recent assessments
              </button>
            )}
            {user && onSignOut && (
              <button onClick={() => { setMenuOpen(false); onSignOut(); }}>
                Sign out
              </button>
            )}
          </nav>

          {user && (
            <p style={{
              fontFamily: 'var(--mono)', fontSize: '0.7rem',
              color: 'rgba(247,247,244,0.4)', letterSpacing: '0.04em',
              marginTop: '1rem',
            }}>
              {email}
            </p>
          )}
        </div>
      )}
    </>
  );
}
