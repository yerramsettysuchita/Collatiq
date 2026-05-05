import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../lib/auth';

const AuthContext = createContext(null);

const SUPABASE_CONFIGURED = !!(
  process.env.REACT_APP_SUPABASE_URL &&
  process.env.REACT_APP_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.REACT_APP_SUPABASE_ANON_KEY &&
  process.env.REACT_APP_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Supabase is not configured, skip auth entirely
    if (!SUPABASE_CONFIGURED) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          return getCurrentProfile().then(p => { if (!cancelled) setProfile(p); });
        }
      })
      .catch(() => {}) // network/config errors — treat as unauthenticated
      .finally(() => { if (!cancelled) setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const p = await getCurrentProfile();
          if (!cancelled) setProfile(p);
        } catch {}
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!SUPABASE_CONFIGURED) return;
    try {
      const p = await getCurrentProfile();
      setProfile(p);
    } catch {}
  };

  const handleSignOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut, supabaseConfigured: SUPABASE_CONFIGURED, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
