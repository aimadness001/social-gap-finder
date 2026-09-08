import { NextResponse } from "next/server";
import { getFlaggedReviewsForCompany, getAllReviewsForCompany } from "@/lib/db";

// By default returns only flagged reviews. Pass ?all=true to get every
// review we saved for this company, so you can check what Google actually
// returned even when nothing got flagged.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const wantAll = searchParams.get("all") === "true";

    const reviews = wantAll
      ? await getAllReviewsForCompany(companyId)
      : await getFlaggedReviewsForCompany(companyId);

    return NextResponse.json({ ok: true, reviews });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
