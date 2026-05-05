-- Collatiq — Supabase schema
-- Run in the Supabase SQL Editor (Settings → SQL Editor)
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS guards.

-- ── VALUATIONS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS valuations (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address                 text,
  verdict                 text,
  market_value            bigint,
  ltv_band                text,
  confidence              numeric(5,4),
  collateral_health_score integer,
  full_result             jsonb,
  expires_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── COLUMN MIGRATIONS (safe for existing tables) ──────────────────────────────
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS expires_at              timestamptz;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS collateral_health_score integer;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS market_value            bigint;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS ltv_band                text;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS confidence              numeric(5,4);

-- Backfill expires_at for rows that don't have it
UPDATE valuations
SET expires_at = created_at + INTERVAL '90 days'
WHERE expires_at IS NULL;

-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Primary access pattern: per-user history sorted by date
CREATE INDEX IF NOT EXISTS idx_valuations_user_created
  ON valuations (user_id, created_at DESC);

-- Monitoring screen: filter by verdict within a user's portfolio
CREATE INDEX IF NOT EXISTS idx_valuations_verdict
  ON valuations (user_id, verdict);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

-- Users see only their own rows
CREATE POLICY "Users can view own valuations"
  ON valuations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rows
CREATE POLICY "Users can insert own valuations"
  ON valuations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own rows
CREATE POLICY "Users can delete own valuations"
  ON valuations FOR DELETE
  USING (auth.uid() = user_id);

-- ── VERIFICATION QUERY ────────────────────────────────────────────────────────
-- Run this after setup to confirm RLS policies are active.
-- Expected output: 3 rows (view, insert, delete).
--
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'valuations';
