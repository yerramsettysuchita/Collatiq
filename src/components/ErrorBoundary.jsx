import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--paper)', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--serif)', fontSize: '1.8rem',
            letterSpacing: '-0.025em', color: 'var(--ink)',
            marginBottom: '1.6rem',
          }}>
            Collat<em style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>iq</em>
          </div>
          <h2 style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(1.4rem, 4vw, 2rem)',
            letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: '0.75rem',
            fontWeight: 400,
          }}>
            Something unexpected happened
          </h2>
          <p style={{
            fontFamily: 'var(--sans)', fontSize: '0.95rem', color: 'var(--ink-4)',
            lineHeight: '1.72', maxWidth: '380px', marginBottom: '2rem',
          }}>
            An error occurred while rendering this page. Please refresh to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--ink)', color: 'var(--paper)',
              fontFamily: 'var(--sans)', fontSize: '0.88rem', fontWeight: 400,
              letterSpacing: '0.03em', padding: '0.9rem 2rem',
              border: 'none', borderRadius: '6px', cursor: 'none',
              transition: 'background 0.2s',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
