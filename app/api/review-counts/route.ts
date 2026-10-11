import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureInstagramColumns } from "@/lib/db";
import { getPlaceRating } from "@/lib/googlePlaces";

export const maxDuration = 60;

const BATCH = 40;
const TIME_BUDGET_MS = 45000;

// POST /api/review-counts — fills in Google rating + review count for companies
// saved before the app collected them. Does up to 40 per click.
export async function POST() {
  try {
    await ensureInstagramColumns();
    const missing = await sql<{ id: number; place_id: string }>`
      SELECT id, place_id FROM companies WHERE google_review_count IS NULL ORDER BY id LIMIT ${BATCH};
    `;

    const start = Date.now();
    let updated = 0;
    let failed = 0;
    for (const row of missing.rows) {
      if (Date.now() - start > TIME_BUDGET_MS) break;
      try {
        const r = await getPlaceRating(row.place_id);
        await sql`
          UPDATE companies SET google_rating = ${r.rating}, google_review_count = ${r.reviewCount}
          WHERE id = ${row.id};
        `;
        updated++;
      } catch {
        failed++;
      }
    }

    const left = await sql<{ n: number }>`SELECT COUNT(*)::int AS n FROM companies WHERE google_review_count IS NULL;`;
    return NextResponse.json({ ok: true, updated, failed, remaining: left.rows[0].n });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
