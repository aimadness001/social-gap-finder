import { NextResponse } from "next/server";
import { getFlaggedReviewsForCompany } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }

    const reviews = await getFlaggedReviewsForCompany(companyId);
    return NextResponse.json({ ok: true, reviews });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
