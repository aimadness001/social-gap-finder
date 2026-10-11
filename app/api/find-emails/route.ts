import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureInstagramColumns } from "@/lib/db";
import { scanWebsite } from "@/lib/instagramCheck";

export const maxDuration = 60;

const BATCH = 24;
const AT_ONCE = 6;
const TIME_BUDGET_MS = 40000;

// POST /api/find-emails — scans websites of companies saved before email
// finding existed. Does a batch per call; the app calls it until done.
export async function POST() {
  try {
    await ensureInstagramColumns();
    const todo = await sql<{ id: number; website: string }>`
      SELECT id, website FROM companies
      WHERE website IS NOT NULL AND COALESCE(email_checked, false) = false
      ORDER BY id LIMIT ${BATCH};
    `;

    const start = Date.now();
    let found = 0;
    let checked = 0;
    const rows = todo.rows;
    for (let i = 0; i < rows.length; i += AT_ONCE) {
      if (Date.now() - start > TIME_BUDGET_MS) break;
      await Promise.all(
        rows.slice(i, i + AT_ONCE).map(async (row) => {
          const scan = await scanWebsite(row.website);
          // Unreachable sites are marked checked too, so they aren't retried forever.
          await sql`UPDATE companies SET email = COALESCE(${scan.email}, email), email_checked = true WHERE id = ${row.id};`;
          checked++;
          if (scan.email) found++;
        })
      );
    }

    const left = await sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM companies
      WHERE website IS NOT NULL AND COALESCE(email_checked, false) = false;
    `;
    return NextResponse.json({ ok: true, checked, found, remaining: left.rows[0].n });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
