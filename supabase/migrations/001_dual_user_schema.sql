-- ══════════════════════════════════════════════════════════════
-- COLLATIQ DUAL-USER PLATFORM — Schema Migration v1
-- Run this in Supabase SQL editor (Dashboard → SQL editor)
-- ══════════════════════════════════════════════════════════════

-- Profiles (one per auth user, auto-created on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'borrower'
    CHECK (role IN ('borrower','lender','lender_officer','credit_manager','risk_reviewer','admin')),
  org_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organizations (lender institutions)
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'nbfc'
    CHECK (type IN ('lender','bank','nbfc','hfc','other')),
  created_at timestamptz DEFAULT now()
);

-- Add FK from profiles → organizations (separate step, both tables must exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_org_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Organization members (links users to orgs with a role)
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Cases (central entity — one per collateral assessment)
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES profiles(id),
  owner_user_id uuid REFERENCES profiles(id),
  org_id uuid REFERENCES organizations(id),
  intake_mode text NOT NULL CHECK (intake_mode IN ('borrower','lender')),
  source text DEFAULT 'web',
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','decision_pending','approved','conditional','rejected','closed')),
  property_payload jsonb NOT NULL DEFAULT '{}',
  result_payload jsonb,
  summary_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Case documents
CREATE TABLE IF NOT EXISTS case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES profiles(id),
  doc_type text,
  file_path text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Case activity log (audit trail)
CREATE TABLE IF NOT EXISTS case_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id),
  actor_role text,
  event_type text NOT NULL,
  event_label text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Case decisions (valuation engine output + lender decisions)
CREATE TABLE IF NOT EXISTS case_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE UNIQUE,
  recommendation text,
  confidence_score numeric,
  resale_potential_index numeric,
  ttl_days_min integer,
  ttl_days_max integer,
  market_value_min numeric,
  market_value_max numeric,
  distress_value_min numeric,
  distress_value_max numeric,
  ltv_band text,
  risk_flags jsonb DEFAULT '[]',
  value_drivers jsonb DEFAULT '[]',
  internal_notes text,
  borrower_summary text,
  full_result_payload jsonb,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── TRIGGERS ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS case_decisions_updated_at ON case_decisions;
CREATE TRIGGER case_decisions_updated_at BEFORE UPDATE ON case_decisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'borrower'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── HELPER FUNCTIONS ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION belongs_to_org(target_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND org_id = target_org_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_case(target_case_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = target_case_id
    AND (
      c.owner_user_id = auth.uid()
      OR (p.org_id IS NOT NULL AND p.org_id = c.org_id AND p.role != 'borrower')
      OR p.role = 'admin'
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_decisions ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_admin" ON profiles;
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (is_admin());

-- organizations
DROP POLICY IF EXISTS "orgs_members_view" ON organizations;
CREATE POLICY "orgs_members_view" ON organizations FOR SELECT
  USING (belongs_to_org(id) OR is_admin());
DROP POLICY IF EXISTS "orgs_admin" ON organizations;
CREATE POLICY "orgs_admin" ON organizations FOR ALL USING (is_admin());

-- organization_members
DROP POLICY IF EXISTS "org_members_view" ON organization_members;
CREATE POLICY "org_members_view" ON organization_members FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "org_members_admin" ON organization_members;
CREATE POLICY "org_members_admin" ON organization_members FOR ALL USING (is_admin());

-- cases: borrower sees own, lender sees org cases, admin sees all
DROP POLICY IF EXISTS "cases_borrower_own" ON cases;
CREATE POLICY "cases_borrower_own" ON cases FOR ALL
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "cases_lender_select" ON cases;
CREATE POLICY "cases_lender_select" ON cases FOR SELECT
  USING (
    org_id IS NOT NULL
    AND belongs_to_org(org_id)
    AND get_my_role() != 'borrower'
  );

DROP POLICY IF EXISTS "cases_lender_update" ON cases;
CREATE POLICY "cases_lender_update" ON cases FOR UPDATE
  USING (
    org_id IS NOT NULL
    AND belongs_to_org(org_id)
    AND get_my_role() != 'borrower'
  );

DROP POLICY IF EXISTS "cases_admin" ON cases;
CREATE POLICY "cases_admin" ON cases FOR ALL USING (is_admin());

-- case_documents
DROP POLICY IF EXISTS "docs_access" ON case_documents;
CREATE POLICY "docs_access" ON case_documents FOR ALL
  USING (can_access_case(case_id));

-- case_activity
DROP POLICY IF EXISTS "activity_select" ON case_activity;
CREATE POLICY "activity_select" ON case_activity FOR SELECT
  USING (can_access_case(case_id));
DROP POLICY IF EXISTS "activity_insert" ON case_activity;
CREATE POLICY "activity_insert" ON case_activity FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- case_decisions
DROP POLICY IF EXISTS "decisions_borrower" ON case_decisions;
CREATE POLICY "decisions_borrower" ON case_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "decisions_lender" ON case_decisions;
CREATE POLICY "decisions_lender" ON case_decisions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = case_id
      AND c.org_id IS NOT NULL
      AND p.org_id = c.org_id
      AND p.role != 'borrower'
    ) OR is_admin()
  );

-- ── HOW TO PROMOTE A USER TO LENDER / ADMIN ─────────────────────
-- Run in SQL editor:
-- UPDATE profiles SET role = 'lender', org_id = '<org_uuid>' WHERE email = 'user@example.com';
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
