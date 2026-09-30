import { NextResponse } from "next/server";
import { setManualInstagram } from "@/lib/db";

// Saves your own answer for a company's Instagram.
// Body: { value: true }  = "Yes, has Instagram"
//       { value: false } = "No, confirmed"
//       { value: null }  = undo (go back to the automatic answer)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }
    const body = await req.json();
    const value = body.value;
    if (value !== true && value !== false && value !== null) {
      return NextResponse.json({ ok: false, error: "value must be true, false or null" }, { status: 400 });
    }
    await setManualInstagram(companyId, value);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
