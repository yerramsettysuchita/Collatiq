import { supabase } from './supabase';

const PENDING_KEY = 'collatiq_pending_sync';

function readPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

function writePending(items) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    // localStorage full — silently skip
  }
}

export async function saveValuation(results, userId) {
  if (!results || !userId) return;

  const row = {
    user_id:                  userId,
    address:                  results.address               ?? null,
    verdict:                  results.verdict               ?? null,
    market_value:             results.marketValue           ?? null,
    ltv_band:                 results.ltvBand               ?? null,
    confidence:               results.confidence            ?? null,
    collateral_health_score:  results.collateralHealthScore ?? null,
    full_result:              results,
    expires_at:               new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const { error } = await supabase.from('valuations').insert(row);
    if (error) throw error;
  } catch (err) {
    // Queue for later sync
    const pending = readPending();
    pending.push(row);
    writePending(pending);
  }
}

export async function syncPendingValuations() {
  const pending = readPending();
  if (pending.length === 0) return;

  const synced = [];
  for (const row of pending) {
    try {
      const { error } = await supabase.from('valuations').insert(row);
      if (!error) synced.push(row);
    } catch {
      // leave in queue for next sync attempt
    }
  }

  if (synced.length > 0) {
    const remaining = pending.filter(r => !synced.includes(r));
    writePending(remaining);
  }
}
