-- ============================================================
-- Migration 005: Payments Table
-- ============================================================

CREATE TYPE payment_type   AS ENUM ('subscription', 'lead_unlock', 'featured_upgrade');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id           UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,

  type                  payment_type NOT NULL,
  amount                INT NOT NULL,           -- in paise
  currency              VARCHAR(3) DEFAULT 'INR',
  status                payment_status DEFAULT 'pending',

  -- Razorpay details
  razorpay_order_id     TEXT UNIQUE,
  razorpay_payment_id   TEXT UNIQUE,
  razorpay_signature    TEXT,

  -- What was paid for
  reference_id          UUID,                   -- lead_id or subscription_id
  reference_type        VARCHAR(50),            -- 'lead' or 'subscription'

  -- Extra info
  metadata              JSONB DEFAULT '{}',
  failure_reason        TEXT,

  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_hospital     ON payments(hospital_id);
CREATE INDEX idx_payments_status       ON payments(status);
CREATE INDEX idx_payments_type         ON payments(type);
CREATE INDEX idx_payments_razorpay_oid ON payments(razorpay_order_id);
CREATE INDEX idx_payments_created      ON payments(created_at DESC);

-- Trigger
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Migration 005: payments table created ✅' AS status;
