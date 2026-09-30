-- Social Gap Finder schema
-- This runs automatically the first time you hit /api/init-db after deploy.

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT NOT NULL,
  has_instagram BOOLEAN,
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'google',
  review_text TEXT,
  rating INTEGER,
  review_date TEXT,
  flagged_social_complaint BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(city);
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);

-- Added Sept 2026: Google Instagram search + manual "checked by you" answers.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_source TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_checked BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS manual_instagram BOOLEAN;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS manual_checked_at TIMESTAMP;
