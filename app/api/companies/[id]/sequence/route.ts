import { NextResponse } from "next/server";
import { setEmailsSent } from "@/lib/db";

// Body: { sent: 1 | 2 | 3 } — how many sequence emails have been sent.
// Email 1 itself is recorded through /contacted (it sets the start date).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const companyId = parseInt(params.id, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 });
    }
    const body = await req.json();
    if (![1, 2, 3].includes(body.sent)) {
      return NextResponse.json({ ok: false, error: "sent must be 1, 2 or 3" }, { status: 400 });
    }
    await setEmailsSent(companyId, body.sent);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
