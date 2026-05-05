import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading, supabaseConfigured } = useAuth();

  // If Supabase is not configured (no .env), show the portals in preview mode
  // so developers can see the UI without a real auth backend.
  if (!supabaseConfigured) {
    return children;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--paper)',
        fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-4)',
        flexDirection: 'column', gap: 16,
      }}>
        <div className="plat-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile) {
    if (requiredRole === 'lender' && profile.role === 'borrower') {
      return <Navigate to="/owner/dashboard" replace />;
    }
    if (requiredRole === 'borrower' && profile.role !== 'borrower') {
      return <Navigate to="/lender/dashboard" replace />;
    }
  }

  return children;
}
