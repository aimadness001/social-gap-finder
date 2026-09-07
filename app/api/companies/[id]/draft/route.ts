import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getFlaggedReviewsForCompany, Company } from "@/lib/db";
import { generateOutreachEmail } from "@/lib/emailTemplate";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }

    const companyResult = await sql<Company>`SELECT * FROM companies WHERE id = ${companyId};`;
    const company = companyResult.rows[0];
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
    }

    const flaggedReviews = await getFlaggedReviewsForCompany(companyId);

    const draft = generateOutreachEmail({
      name: company.name,
      hasInstagram: company.has_instagram,
      website: company.website,
      flaggedReviews: flaggedReviews.map((r) => ({
        review_text: r.review_text,
        flag_reason: r.flag_reason,
      })),
    });

    return NextResponse.json({ ok: true, draft });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
