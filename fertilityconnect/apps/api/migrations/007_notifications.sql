-- ============================================================
-- Migration 007: Notifications Table
-- ============================================================

CREATE TYPE notif_type AS ENUM (
  'new_lead',
  'lead_unlocked',
  'lead_interest',       -- hospital interested in patient
  'review_approved',
  'review_rejected',
  'kyc_approved',
  'kyc_rejected',
  'subscription_expiring',
  'subscription_expired',
  'payment_success',
  'payment_failed',
  'callback_request'
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type        notif_type NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  data        JSONB DEFAULT '{}',         -- extra payload (lead_id, etc.)

  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,

  -- Delivery channels
  sent_sms    BOOLEAN DEFAULT FALSE,
  sent_email  BOOLEAN DEFAULT FALSE,
  sent_push   BOOLEAN DEFAULT FALSE,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifs_user     ON notifications(user_id);
CREATE INDEX idx_notifs_unread   ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifs_created  ON notifications(created_at DESC);

SELECT 'Migration 007: notifications table created ✅' AS status;
