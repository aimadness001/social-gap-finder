import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureInstagramColumns, Company } from "@/lib/db";
import { generateSequenceEmail, SequenceStep } from "@/lib/emailTemplate";

// GET /api/companies/:id/draft?step=1|2|3
// Without ?step, returns the next email in the sequence for this company.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }

    await ensureInstagramColumns();
    const companyResult = await sql<Company>`SELECT * FROM companies WHERE id = ${companyId};`;
    const company = companyResult.rows[0];
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
    }

    const sent = company.contacted_at ? Math.max(company.emails_sent || 0, 1) : 0;
    const requested = parseInt(new URL(req.url).searchParams.get("step") || "", 10);
    const step = ([1, 2, 3].includes(requested) ? requested : Math.min(sent + 1, 3)) as SequenceStep;

    const draft = generateSequenceEmail(step, company.name);
    return NextResponse.json({ ok: true, step, draft });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
