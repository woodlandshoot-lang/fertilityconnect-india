-- ============================================================
-- Migration 008: Saved Hospitals + Success Stories + OTP Attempts
-- ============================================================

-- ── Saved Hospitals ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_hospitals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, hospital_id)
);
CREATE INDEX idx_saved_user ON saved_hospitals(user_id);

-- ── Success Stories / Testimonials ───────────────────────────
CREATE TABLE IF NOT EXISTS success_stories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  title       VARCHAR(255),
  story       TEXT,
  patient_name VARCHAR(100),      -- e.g. "Priya & Rajan" (anonymised)
  treatment   VARCHAR(100),
  outcome     VARCHAR(100),       -- "Twin girls born", "IVF success"
  image_url   TEXT,
  video_url   TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  status      VARCHAR(20) DEFAULT 'pending',  -- pending/approved/rejected
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stories_hospital ON success_stories(hospital_id);

-- ── OTP Attempt Tracking (brute force protection) ─────────────
CREATE TABLE IF NOT EXISTS otp_attempts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(15) NOT NULL,
  ip_address  VARCHAR(45),
  attempts    INT DEFAULT 1,
  blocked_until TIMESTAMPTZ,
  last_attempt  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_otp_phone ON otp_attempts(phone);

-- ── Callback Requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS callback_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_name VARCHAR(100),
  phone       VARCHAR(15) NOT NULL,
  city        VARCHAR(100),
  message     TEXT,
  status      VARCHAR(20) DEFAULT 'pending',   -- pending/called/closed
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_callbacks_hospital ON callback_requests(hospital_id);

SELECT 'Migration 008: saved_hospitals, success_stories, otp_attempts, callbacks ✅' AS status;
