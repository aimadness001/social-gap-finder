import { sql } from "@vercel/postgres";

export type Company = {
  id: number;
  place_id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  // Final answer shown in the app: your manual answer if you gave one,
  // otherwise the automatic check's answer.
  has_instagram: boolean | null;
  auto_has_instagram: boolean | null; // what the automatic check found
  instagram_url: string | null; // the account link, if found
  instagram_source: "website" | "google" | null; // where the link was found
  google_checked: boolean; // did the Google search run for this company?
  manual_instagram: boolean | null; // your answer (null = you haven't checked)
  contacted_at: string | null; // when you marked this company as contacted
  checked_at: string | null;
  created_at: string;
};

// Adds the new Instagram columns to an existing database. Safe to run any
// number of times. Runs automatically once per server start, so you don't
// need to click "Initialize database" again after this update.
let columnsReady: Promise<void> | null = null;
export function ensureInstagramColumns(): Promise<void> {
  if (!columnsReady) {
    columnsReady = (async () => {
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_url TEXT;`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_source TEXT;`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_checked BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS manual_instagram BOOLEAN;`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS manual_checked_at TIMESTAMP;`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMP;`;
    })().catch((err) => {
      columnsReady = null; // retry next time
      throw err;
    });
  }
  return columnsReady;
}

// Marks a company as contacted (true) or not contacted (false).
export async function setContacted(companyId: number, contacted: boolean) {
  await ensureInstagramColumns();
  await sql`
    UPDATE companies
    SET contacted_at = ${contacted ? new Date().toISOString() : null}
    WHERE id = ${companyId};
  `;
}

// Saves (or clears, with null) your own answer for whether a company has Instagram.
export async function setManualInstagram(companyId: number, value: boolean | null) {
  await ensureInstagramColumns();
  await sql`
    UPDATE companies
    SET manual_instagram = ${value},
        manual_checked_at = ${value === null ? null : new Date().toISOString()}
    WHERE id = ${companyId};
  `;
}

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
  instagram_url: string | null;
  instagram_source: "website" | "google" | null;
  google_checked: boolean;
}): Promise<number> {
  await ensureInstagramColumns();
  // Note: manual_instagram (your own answer) is never overwritten by a re-search.
  const result = await sql<{ id: number }>`
    INSERT INTO companies (place_id, name, phone, website, address, city, has_instagram,
      instagram_url, instagram_source, google_checked, checked_at)
    VALUES (${company.place_id}, ${company.name}, ${company.phone}, ${company.website}, ${company.address}, ${company.city}, ${company.has_instagram},
      ${company.instagram_url}, ${company.instagram_source}, ${company.google_checked}, NOW())
    ON CONFLICT (place_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      website = EXCLUDED.website,
      address = EXCLUDED.address,
      has_instagram = EXCLUDED.has_instagram,
      instagram_url = EXCLUDED.instagram_url,
      instagram_source = EXCLUDED.instagram_source,
      google_checked = EXCLUDED.google_checked,
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
  await ensureInstagramColumns();
  const result = city
    ? await sql<RankedCompany>`
        SELECT c.id, c.place_id, c.name, c.phone, c.website, c.address, c.city,
          COALESCE(c.manual_instagram, c.has_instagram) AS has_instagram,
          c.has_instagram AS auto_has_instagram,
          c.instagram_url, c.instagram_source,
          COALESCE(c.google_checked, false) AS google_checked,
          c.manual_instagram, c.contacted_at, c.checked_at, c.created_at,
          COALESCE(r.flagged_count, 0)::int AS flagged_review_count,
          (CASE WHEN COALESCE(c.manual_instagram, c.has_instagram) = false THEN 2 ELSE 0 END + COALESCE(r.flagged_count, 0))::int AS social_gap_score
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
        SELECT c.id, c.place_id, c.name, c.phone, c.website, c.address, c.city,
          COALESCE(c.manual_instagram, c.has_instagram) AS has_instagram,
          c.has_instagram AS auto_has_instagram,
          c.instagram_url, c.instagram_source,
          COALESCE(c.google_checked, false) AS google_checked,
          c.manual_instagram, c.contacted_at, c.checked_at, c.created_at,
          COALESCE(r.flagged_count, 0)::int AS flagged_review_count,
          (CASE WHEN COALESCE(c.manual_instagram, c.has_instagram) = false THEN 2 ELSE 0 END + COALESCE(r.flagged_count, 0))::int AS social_gap_score
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

// Returns every review we saved for a company (flagged or not), so you can
// eyeball what Google actually returned — useful for checking whether the
// keyword detection is missing something real, or there's just nothing to
// catch in this batch of reviews.
export async function getAllReviewsForCompany(companyId: number): Promise<Review[]> {
  const result = await sql<Review>`
    SELECT * FROM reviews WHERE company_id = ${companyId} ORDER BY flagged_social_complaint DESC, id ASC;
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
  columnsReady = null;
  await ensureInstagramColumns();
}
