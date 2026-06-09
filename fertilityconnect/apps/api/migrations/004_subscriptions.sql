-- ============================================================
-- Migration 004: Subscriptions Table
-- ============================================================

CREATE TYPE subscription_plan   AS ENUM ('basic', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired', 'paused');

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,

  plan                subscription_plan NOT NULL,
  status              subscription_status DEFAULT 'trial',

  -- Pricing
  amount              INT NOT NULL,        -- in paise (₹ × 100)
  currency            VARCHAR(3) DEFAULT 'INR',
  billing_cycle       VARCHAR(20) DEFAULT 'monthly',

  -- Razorpay
  razorpay_sub_id     TEXT UNIQUE,
  razorpay_plan_id    TEXT,

  -- Dates
  trial_ends_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,

  -- Lead quota (reset monthly)
  leads_quota         INT DEFAULT 5,       -- max leads per month
  leads_used          INT DEFAULT 0,       -- leads used this month
  quota_reset_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subs_hospital  ON subscriptions(hospital_id);
CREATE INDEX idx_subs_status    ON subscriptions(status);
CREATE INDEX idx_subs_ends_at   ON subscriptions(ends_at);

-- Trigger
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Migration 004: subscriptions table created ✅' AS status;
