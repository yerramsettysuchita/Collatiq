import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseKey  = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Bypass navigator.locks — v2.x uses it for cross-tab token refresh coordination
// which causes "lock stolen" errors on page reload. A simple mutex is sufficient
// for a single-page app where only one tab normally runs at a time.
let _lockHolder = null;
function simpleLock(_name, _timeout, fn) {
  if (_lockHolder) return _lockHolder.then(() => fn());
  let release;
  _lockHolder = new Promise(resolve => { release = resolve; });
  return fn().finally(() => { _lockHolder = null; release(); });
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { lock: simpleLock },
});

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data; // { user, session }
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
