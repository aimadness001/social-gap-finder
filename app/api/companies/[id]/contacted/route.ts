import { NextResponse } from "next/server";
import { setContacted } from "@/lib/db";

// Body: { contacted: true } to mark as contacted (saves today's date),
//       { contacted: false } to undo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }
    const body = await req.json();
    if (typeof body.contacted !== "boolean") {
      return NextResponse.json({ ok: false, error: "contacted must be true or false" }, { status: 400 });
    }
    await setContacted(companyId, body.contacted);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
