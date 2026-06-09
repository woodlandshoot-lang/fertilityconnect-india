-- ============================================================
-- Migration 003: Leads Table (Patient Consultation Requests)
-- Patient private data is AES-256 encrypted in application layer
-- ============================================================

CREATE TYPE lead_urgency AS ENUM (
  'immediate',
  'within_1_month',
  '1_to_3_months',
  'exploring'
);

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Public info (visible to hospitals before unlock)
  age               INT,
  condition         VARCHAR(255),        -- "Low AMH", "PCOS", etc.
  budget_min        INT,                 -- in rupees
  budget_max        INT,
  city              VARCHAR(100),
  urgency           lead_urgency DEFAULT 'exploring',
  notes_public      TEXT,               -- anonymous notes

  -- Private info (AES-256 encrypted — decrypted only after payment)
  name_encrypted    TEXT,               -- encrypted full name
  phone_encrypted   TEXT,               -- encrypted phone
  email_encrypted   TEXT,               -- encrypted email
  notes_private     TEXT,               -- encrypted private notes

  -- Status
  is_active         BOOLEAN DEFAULT TRUE,
  expires_at        TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Lead Unlocks ─────────────────────────────────────────────
-- Tracks which hospital unlocked which lead (after payment)
CREATE TABLE IF NOT EXISTS lead_unlocks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  hospital_id   UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  payment_id    UUID,                    -- filled after payment confirmed
  unlocked_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lead_id, hospital_id)           -- hospital can't unlock same lead twice
);

-- Indexes
CREATE INDEX idx_leads_city       ON leads(city);
CREATE INDEX idx_leads_condition  ON leads(condition);
CREATE INDEX idx_leads_active     ON leads(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_leads_created    ON leads(created_at DESC);
CREATE INDEX idx_unlocks_hospital ON lead_unlocks(hospital_id);
CREATE INDEX idx_unlocks_lead     ON lead_unlocks(lead_id);

-- Trigger
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Migration 003: leads + lead_unlocks tables created ✅' AS status;
