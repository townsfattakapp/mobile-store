-- Giveaway campaigns + immutable entry ledger — run on prod Supabase (safe to re-run)

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, anon;

-- ─── Campaigns ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  prize_title TEXT NOT NULL,
  prize_description TEXT,
  prize_image TEXT,
  terms_and_conditions TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  max_winners INT NOT NULL DEFAULT 1 CHECK (max_winners > 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT giveaways_window CHECK (
    start_at IS NULL OR end_at IS NULL OR start_at <= end_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS giveaways_slug_unique
  ON giveaways (lower(trim(slug)));

CREATE INDEX IF NOT EXISTS giveaways_status_idx ON giveaways (status);

-- ─── Configurable entry rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_entry_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL
    CHECK (action_type IN (
      'join', 'referral', 'whatsapp_share', 'social_action',
      'purchase', 'bonus', 'admin_adjustment'
    )),
  entries INT NOT NULL CHECK (entries <> 0),
  min_order_amount NUMERIC(12, 2),
  max_order_amount NUMERIC(12, 2),
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS giveaway_entry_rules_gw_idx
  ON giveaway_entry_rules (giveaway_id, action_type)
  WHERE enabled = true;

-- ─── Participants ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  referred_by_participant_id UUID REFERENCES giveaway_participants(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disqualified', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT giveaway_participants_one_user UNIQUE (giveaway_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS giveaway_participants_ref_code_unique
  ON giveaway_participants (giveaway_id, upper(trim(referral_code)));

CREATE INDEX IF NOT EXISTS giveaway_participants_user_idx
  ON giveaway_participants (user_id);

CREATE INDEX IF NOT EXISTS giveaway_participants_referrer_idx
  ON giveaway_participants (referred_by_participant_id)
  WHERE referred_by_participant_id IS NOT NULL;

-- ─── Immutable entry ledger ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES giveaway_participants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'join', 'referral', 'whatsapp_share', 'social_action',
      'purchase', 'bonus', 'admin_adjustment', 'refund_reversal'
    )),
  source_id TEXT,
  entries INT NOT NULL CHECK (entries <> 0),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS giveaway_entries_participant_idx
  ON giveaway_entries (participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS giveaway_entries_gw_idx
  ON giveaway_entries (giveaway_id, created_at DESC);

CREATE INDEX IF NOT EXISTS giveaway_entries_source_idx
  ON giveaway_entries (source_type, source_id);

-- One JOIN credit per participant
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_join_once
  ON giveaway_entries (participant_id)
  WHERE source_type = 'join';

-- One referral reward per referred participant (source_id = referred participant uuid)
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_referral_once
  ON giveaway_entries (giveaway_id, source_id)
  WHERE source_type = 'referral' AND source_id IS NOT NULL;

-- One purchase credit per order
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_purchase_once
  ON giveaway_entries (giveaway_id, source_id)
  WHERE source_type = 'purchase' AND source_id IS NOT NULL;

-- One refund reversal per order
CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_refund_once
  ON giveaway_entries (giveaway_id, source_id)
  WHERE source_type = 'refund_reversal' AND source_id IS NOT NULL;

-- ─── Risk flags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES giveaway_participants(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS giveaway_risk_flags_gw_idx
  ON giveaway_risk_flags (giveaway_id, status);

-- ─── Audit log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS giveaway_audit_gw_idx
  ON giveaway_audit_log (giveaway_id, created_at DESC);

-- ─── Draws & winners ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giveaway_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  total_eligible_entries INT NOT NULL CHECK (total_eligible_entries >= 0),
  eligible_participant_count INT NOT NULL DEFAULT 0,
  algorithm TEXT NOT NULL DEFAULT 'weighted_crypto_random',
  algorithm_seed TEXT,
  snapshot JSONB,
  executed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT giveaway_draws_one_per_giveaway UNIQUE (giveaway_id)
);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  draw_id UUID NOT NULL REFERENCES giveaway_draws(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES giveaway_participants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  prize_title TEXT,
  status TEXT NOT NULL DEFAULT 'selected'
    CHECK (status IN ('selected', 'verified', 'rejected', 'announced')),
  publicly_announced BOOLEAN NOT NULL DEFAULT false,
  winner_photo TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT giveaway_winners_participant_once UNIQUE (draw_id, participant_id)
);

CREATE INDEX IF NOT EXISTS giveaway_winners_public_idx
  ON giveaway_winners (giveaway_id)
  WHERE publicly_announced = true;

-- Curated previous winners gallery (optional manual + auto-announced)
CREATE TABLE IF NOT EXISTS giveaway_previous_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE SET NULL,
  prize_title TEXT NOT NULL,
  display_name TEXT NOT NULL,
  winner_photo TEXT,
  announced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entry_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_previous_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage giveaways" ON giveaways;
CREATE POLICY "Staff manage giveaways" ON giveaways
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Public read published giveaways" ON giveaways;
CREATE POLICY "Public read published giveaways" ON giveaways
  FOR SELECT USING (
    status IN ('scheduled', 'active', 'paused', 'completed')
  );

DROP POLICY IF EXISTS "Staff manage giveaway rules" ON giveaway_entry_rules;
CREATE POLICY "Staff manage giveaway rules" ON giveaway_entry_rules
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Public read giveaway rules" ON giveaway_entry_rules;
CREATE POLICY "Public read giveaway rules" ON giveaway_entry_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM giveaways g
      WHERE g.id = giveaway_id
        AND g.status IN ('scheduled', 'active', 'paused', 'completed')
    )
  );

DROP POLICY IF EXISTS "Staff manage participants" ON giveaway_participants;
CREATE POLICY "Staff manage participants" ON giveaway_participants
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Users read own participation" ON giveaway_participants;
CREATE POLICY "Users read own participation" ON giveaway_participants
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff manage giveaway entries" ON giveaway_entries;
CREATE POLICY "Staff manage giveaway entries" ON giveaway_entries
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Users read own entries" ON giveaway_entries;
CREATE POLICY "Users read own entries" ON giveaway_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM giveaway_participants p
      WHERE p.id = participant_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff manage risk flags" ON giveaway_risk_flags;
CREATE POLICY "Staff manage risk flags" ON giveaway_risk_flags
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Staff manage giveaway audit" ON giveaway_audit_log;
CREATE POLICY "Staff manage giveaway audit" ON giveaway_audit_log
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Staff manage draws" ON giveaway_draws;
CREATE POLICY "Staff manage draws" ON giveaway_draws
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Staff manage winners" ON giveaway_winners;
CREATE POLICY "Staff manage winners" ON giveaway_winners
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Public read announced winners" ON giveaway_winners;
CREATE POLICY "Public read announced winners" ON giveaway_winners
  FOR SELECT USING (publicly_announced = true);

DROP POLICY IF EXISTS "Staff manage previous winners" ON giveaway_previous_winners;
CREATE POLICY "Staff manage previous winners" ON giveaway_previous_winners
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Public read previous winners" ON giveaway_previous_winners;
CREATE POLICY "Public read previous winners" ON giveaway_previous_winners
  FOR SELECT USING (true);

COMMENT ON TABLE giveaways IS 'Giveaway campaigns with prize + schedule';
COMMENT ON TABLE giveaway_entries IS 'Immutable entry ledger; balances = SUM(entries)';
COMMENT ON TABLE giveaway_draws IS 'Auditable weighted winner draw; one per giveaway';
