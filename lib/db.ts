import { sql } from "@vercel/postgres";

export type Company = {
  id: number;
  place_id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  has_instagram: boolean | null;
  checked_at: string | null;
  created_at: string;
};

export type Review = {
  id: number;
  company_id: number;
  source: string;
  review_text: string | null;
  rating: number | null;
  review_date: string | null;
  flagged_social_complaint: boolean;
  flag_reason: string | null;
};

// Upserts a company by its Google place_id. Returns the row id.
export async function upsertCompany(company: {
  place_id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  has_instagram: boolean | null;
}): Promise<number> {
  const result = await sql<{ id: number }>`
    INSERT INTO companies (place_id, name, phone, website, address, city, has_instagram, checked_at)
    VALUES (${company.place_id}, ${company.name}, ${company.phone}, ${company.website}, ${company.address}, ${company.city}, ${company.has_instagram}, NOW())
    ON CONFLICT (place_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      website = EXCLUDED.website,
      address = EXCLUDED.address,
      has_instagram = EXCLUDED.has_instagram,
      checked_at = NOW()
    RETURNING id;
  `;
  return result.rows[0].id;
}

export async function insertReview(review: {
  company_id: number;
  source: string;
  review_text: string;
  rating: number | null;
  review_date: string | null;
  flagged_social_complaint: boolean;
  flag_reason: string | null;
}) {
  await sql`
    INSERT INTO reviews (company_id, source, review_text, rating, review_date, flagged_social_complaint, flag_reason)
    VALUES (${review.company_id}, ${review.source}, ${review.review_text}, ${review.rating}, ${review.review_date}, ${review.flagged_social_complaint}, ${review.flag_reason});
  `;
}

// Clears old reviews for a company before inserting a fresh batch (avoids duplicate
// accumulation when the same company is re-searched later).
export async function clearReviewsForCompany(companyId: number) {
  await sql`DELETE FROM reviews WHERE company_id = ${companyId};`;
}

export type RankedCompany = Company & {
  flagged_review_count: number;
  social_gap_score: number;
};

export async function getRankedCompanies(city?: string): Promise<RankedCompany[]> {
  const result = city
    ? await sql<RankedCompany>`
        SELECT c.*,
          COALESCE(r.flagged_count, 0)::int AS flagged_review_count,
          (CASE WHEN c.has_instagram = false THEN 2 ELSE 0 END + COALESCE(r.flagged_count, 0))::int AS social_gap_score
        FROM companies c
        LEFT JOIN (
          SELECT company_id, COUNT(*) AS flagged_count
          FROM reviews WHERE flagged_social_complaint = true
          GROUP BY company_id
        ) r ON r.company_id = c.id
        WHERE c.city = ${city}
        ORDER BY social_gap_score DESC, c.name ASC;
      `
    : await sql<RankedCompany>`
        SELECT c.*,
          COALESCE(r.flagged_count, 0)::int AS flagged_review_count,
          (CASE WHEN c.has_instagram = false THEN 2 ELSE 0 END + COALESCE(r.flagged_count, 0))::int AS social_gap_score
        FROM companies c
        LEFT JOIN (
          SELECT company_id, COUNT(*) AS flagged_count
          FROM reviews WHERE flagged_social_complaint = true
          GROUP BY company_id
        ) r ON r.company_id = c.id
        ORDER BY social_gap_score DESC, c.name ASC;
      `;
  return result.rows;
}

export async function getFlaggedReviewsForCompany(companyId: number): Promise<Review[]> {
  const result = await sql<Review>`
    SELECT * FROM reviews WHERE company_id = ${companyId} AND flagged_social_complaint = true;
  `;
  return result.rows;
}

export async function initSchema() {
  await sql`
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
  `;
  await sql`
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
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(city);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);`;
}
