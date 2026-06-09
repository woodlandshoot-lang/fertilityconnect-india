-- ============================================================
-- Migration 006: Reviews Table
-- ============================================================

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id   UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Content
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         VARCHAR(255),
  text          TEXT,
  video_url     TEXT,

  -- Privacy
  is_anonymous  BOOLEAN DEFAULT TRUE,
  display_name  VARCHAR(100),           -- e.g. "Priya S." if anonymous

  -- Verification
  is_verified   BOOLEAN DEFAULT FALSE,  -- verified patient
  treatment     VARCHAR(100),           -- "IVF", "IUI", etc.
  outcome       VARCHAR(50),            -- "successful", "ongoing"

  -- Moderation
  status        review_status DEFAULT 'pending',
  moderated_by  UUID REFERENCES users(id),
  moderated_at  TIMESTAMPTZ,
  reject_reason TEXT,

  -- Helpful votes
  helpful_count INT DEFAULT 0,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reviews_hospital  ON reviews(hospital_id);
CREATE INDEX idx_reviews_status    ON reviews(status);
CREATE INDEX idx_reviews_rating    ON reviews(rating);
CREATE INDEX idx_reviews_created   ON reviews(created_at DESC);

-- Trigger
CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Migration 006: reviews table created ✅' AS status;
