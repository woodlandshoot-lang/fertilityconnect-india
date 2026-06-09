-- ============================================================
-- Migration 002: Hospitals Table
-- ============================================================

CREATE TYPE hospital_tier   AS ENUM ('basic', 'pro', 'premium');
CREATE TYPE kyc_status_type AS ENUM ('pending', 'under_review', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS hospitals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Info
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) UNIQUE NOT NULL,
  description           TEXT,
  founded_year          INT,

  -- Location
  city                  VARCHAR(100),
  state                 VARCHAR(100),
  area                  VARCHAR(100),
  address               TEXT,
  pincode               VARCHAR(10),
  lat                   DECIMAL(9,6),
  lng                   DECIMAL(9,6),

  -- Contact
  phone                 VARCHAR(15),
  email                 VARCHAR(255),
  website               VARCHAR(255),

  -- Stats
  ivf_success_rate      DECIMAL(5,2),
  success_rate_verified BOOLEAN DEFAULT FALSE,
  total_cycles          INT DEFAULT 0,

  -- Media
  logo_url              TEXT,
  cover_image_url       TEXT,
  gallery_urls          JSONB DEFAULT '[]',

  -- Details (JSON arrays)
  facilities            JSONB DEFAULT '[]',
  treatments            JSONB DEFAULT '[]',
  doctors               JSONB DEFAULT '[]',
  certifications        JSONB DEFAULT '[]',

  -- Plan & Status
  tier                  hospital_tier DEFAULT 'basic',
  is_featured           BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  is_verified           BOOLEAN DEFAULT FALSE,

  -- KYC
  kyc_status            kyc_status_type DEFAULT 'pending',
  kyc_documents         JSONB DEFAULT '[]',
  kyc_reviewed_at       TIMESTAMPTZ,
  kyc_reviewed_by       UUID REFERENCES users(id),
  kyc_notes             TEXT,

  -- SEO
  meta_title            VARCHAR(255),
  meta_description      TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hospitals_city         ON hospitals(city);
CREATE INDEX idx_hospitals_slug         ON hospitals(slug);
CREATE INDEX idx_hospitals_tier         ON hospitals(tier);
CREATE INDEX idx_hospitals_kyc          ON hospitals(kyc_status);
CREATE INDEX idx_hospitals_success_rate ON hospitals(ivf_success_rate DESC);
CREATE INDEX idx_hospitals_featured     ON hospitals(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_hospitals_active       ON hospitals(is_active) WHERE is_active = TRUE;

-- Trigger
CREATE TRIGGER hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Migration 002: hospitals table created ✅' AS status;
